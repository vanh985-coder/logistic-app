import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CalculatePackingDto } from './dto/packing-request.dto';
import {
  ContainerDimension,
  PackageItem,
  PackingResult,
  MultiStrategyPackingResult,
  packMultiStrategies,
} from '@logix/packing';

export const PACKING_QUEUE_NAME = 'packing_queue';

@Injectable()
export class PackingService implements OnModuleDestroy {
  private readonly logger = new Logger(PackingService.name);
  private readonly packingQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const parsed = new URL(redisUrl);

    this.packingQueue = new Queue(PACKING_QUEUE_NAME, {
      connection: {
        host: parsed.hostname || 'localhost',
        port: parseInt(parsed.port || '6379', 10),
        password: parsed.password || undefined,
      },
    });

    this.logger.log(`Initialized Packing BullMQ Queue: "${PACKING_QUEUE_NAME}"`);
  }

  async onModuleDestroy() {
    await this.packingQueue.close();
  }

  getQueue(): Queue {
    return this.packingQueue;
  }

  /**
   * Computes a deterministic SHA-256 hash for container + packages configuration.
   */
  computeInputHash(container: ContainerDimension, packages: PackageItem[]): string {
    const normalized = JSON.stringify({
      container: [
        container.innerLengthMm,
        container.innerWidthMm,
        container.innerHeightMm,
        container.maxPayloadGram,
      ],
      packages: packages
        .map((p) => [
          p.id,
          p.lengthMm,
          p.widthMm,
          p.heightMm,
          p.weightGram,
          p.fragile,
          p.noStack,
          p.rotatable,
          p.dropOrder ?? 1,
          p.companyId ?? '',
        ])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    });

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Resolves container dimension and package items from either DTO or database IDs.
   */
  async resolvePackingInput(dto: CalculatePackingDto): Promise<{
    container: ContainerDimension;
    packages: PackageItem[];
  }> {
    // 1. Direct container and packages passed in body
    if (dto.container && dto.packages && dto.packages.length > 0) {
      return {
        container: dto.container,
        packages: dto.packages,
      };
    }

    // 2. From MatchGroup
    if (dto.matchGroupId) {
      const matchGroup = await (this.prisma as any).matchGroup.findUnique({
        where: { id: dto.matchGroupId },
        include: {
          targetContainerType: true,
          matchGroupShipments: {
            include: {
              shipment: {
                include: {
                  packages: true,
                },
              },
            },
          },
        },
      });

      if (!matchGroup) {
        throw new NotFoundException(`Match group "${dto.matchGroupId}" not found`);
      }

      const c = matchGroup.targetContainerType;
      const container: ContainerDimension = {
        innerLengthMm: c.innerLengthMm,
        innerWidthMm: c.innerWidthMm,
        innerHeightMm: c.innerHeightMm,
        maxPayloadGram: Number(c.maxPayloadGram),
      };

      const packages: PackageItem[] = [];
      let dropIdx = 1;

      for (const mgs of matchGroup.matchGroupShipments) {
        const dropOrder = mgs.dropOrder ?? dropIdx;
        for (const pkg of mgs.shipment.packages) {
          packages.push({
            id: pkg.id,
            sku: pkg.packageCode,
            name: pkg.description || undefined,
            companyId: mgs.companyId,
            lengthMm: pkg.lengthMm,
            widthMm: pkg.widthMm,
            heightMm: pkg.heightMm,
            weightGram: Number(pkg.weightGrams),
            fragile: pkg.isFragile,
            noStack: pkg.noStack,
            rotatable: true,
            dropOrder,
          });
        }
        dropIdx++;
      }

      return { container, packages };
    }

    throw new BadRequestException(
      'Must provide either (container + packages) or a valid matchGroupId',
    );
  }

  /**
   * Computes multi-strategy 3D packing with Redis caching (v2 key).
   */
  async calculatePacking(dto: CalculatePackingDto) {
    const { container, packages } = await this.resolvePackingInput(dto);
    const inputHash = this.computeInputHash(container, packages);

    // 1. Check Redis Cache (TTL = 1 hour, key: packing:v2:multi:{hash})
    const cacheKey = `packing:v2:multi:${inputHash}`;
    let cachedData: string | null = null;
    try {
      cachedData = await this.redisService.getClient().get(cacheKey);
    } catch (e: any) {
      this.logger.warn(`Redis get cache error: ${e.message}`);
    }

    if (cachedData) {
      this.logger.log(`Cache HIT for packing inputHash: ${inputHash}`);
      const parsedResult = JSON.parse(cachedData) as MultiStrategyPackingResult;
      return {
        statusCode: 200,
        status: 'completed',
        cached: true,
        inputHash,
        result: parsedResult,
      };
    }

    // 2. Direct fast calculation across all 3 strategies (~510ms)
    this.logger.log(`Computing 3 packing strategies for inputHash: ${inputHash}...`);
    const multiResult = packMultiStrategies(container, packages, dto.options);

    try {
      await this.redisService.getClient().setex(cacheKey, 3600, JSON.stringify(multiResult));
    } catch (e: any) {
      this.logger.warn(`Redis set cache error: ${e.message}`);
    }

    return {
      statusCode: 200,
      status: 'completed',
      cached: false,
      inputHash,
      result: multiResult,
    };
  }

  /**
   * Polls BullMQ job status.
   */
  async getJobStatus(jobId: string) {
    const job = await this.packingQueue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Packing job "${jobId}" not found`);
    }

    const state = await job.getState();

    if (state === 'completed') {
      return {
        jobId,
        status: 'completed',
        result: job.returnvalue,
      };
    }

    if (state === 'failed') {
      return {
        jobId,
        status: 'failed',
        error: job.failedReason,
      };
    }

    return {
      jobId,
      status: 'processing',
      state,
    };
  }
}
