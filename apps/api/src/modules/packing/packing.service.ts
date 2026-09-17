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
import { ContainerDimension, PackageItem, PackingResult } from '@logix/packing';

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
        for (const pkg of mgs.shipment.packages) {
          packages.push({
            id: pkg.id,
            sku: pkg.packageCode,
            name: pkg.description || undefined,
            lengthMm: pkg.lengthMm,
            widthMm: pkg.widthMm,
            heightMm: pkg.heightMm,
            weightGram: Number(pkg.weightGrams),
            fragile: pkg.isFragile,
            noStack: pkg.noStack,
            rotatable: true,
            dropOrder: dropIdx,
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
   * Enqueues a 3D packing job or returns cached result if available.
   */
  async calculatePacking(dto: CalculatePackingDto) {
    const { container, packages } = await this.resolvePackingInput(dto);
    const inputHash = this.computeInputHash(container, packages);

    // 1. Check Redis Cache (TTL = 1 hour)
    const cacheKey = `packing:result:${inputHash}`;
    const cachedData = await this.redisService.getClient().get(cacheKey);

    if (cachedData) {
      this.logger.log(`Cache HIT for packing inputHash: ${inputHash}`);
      const parsedResult = JSON.parse(cachedData) as PackingResult;
      return {
        statusCode: 200,
        status: 'completed',
        cached: true,
        inputHash,
        result: parsedResult,
      };
    }

    // 2. Cache MISS: Enqueue BullMQ job
    this.logger.log(`Cache MISS for packing inputHash: ${inputHash}. Enqueuing job in BullMQ...`);
    const job = await this.packingQueue.add(
      '3d_packing_calculation',
      {
        container,
        packages,
        options: dto.options,
        inputHash,
      },
      {
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );

    return {
      statusCode: 202,
      status: 'processing',
      jobId: job.id,
      inputHash,
      message: 'Packing calculation job accepted. Poll /packing/jobs/:jobId for status.',
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
