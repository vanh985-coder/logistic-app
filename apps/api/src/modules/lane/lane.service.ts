import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaneDto, CreatePricingConfigDto } from './dto/lane.dto';

export const DEFAULT_LANES = [
  {
    code: 'SGN-HPH',
    name: 'Sài Gòn - Hải Phòng',
    origin: 'SGN',
    destination: 'HPH',
    cbmRate: 2_500_000n,
    weightRateKg: 6_000n,
    fixedFee: 50_000n,
  },
  {
    code: 'SGN-DAD',
    name: 'Sài Gòn - Đà Nẵng',
    origin: 'SGN',
    destination: 'DAD',
    cbmRate: 1_800_000n,
    weightRateKg: 4_500n,
    fixedFee: 40_000n,
  },
  {
    code: 'HAN-SGN',
    name: 'Hà Nội - Sài Gòn',
    origin: 'HAN',
    destination: 'SGN',
    cbmRate: 2_800_000n,
    weightRateKg: 7_000n,
    fixedFee: 60_000n,
  },
];

@Injectable()
export class LaneService implements OnModuleInit {
  private readonly logger = new Logger(LaneService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultLanes();
  }

  async seedDefaultLanes() {
    try {
      for (const item of DEFAULT_LANES) {
        const lane = await this.prisma.unsafeGlobal.lane.upsert({
          where: { code: item.code },
          update: {
            name: item.name,
            origin: item.origin,
            destination: item.destination,
            isActive: true,
          },
          create: {
            code: item.code,
            name: item.name,
            origin: item.origin,
            destination: item.destination,
            isActive: true,
          },
        });

        const activePricing = await this.prisma.unsafeGlobal.pricingConfig.findFirst({
          where: {
            laneId: lane.id,
            effectiveTo: null,
          },
        });

        if (!activePricing) {
          await this.prisma.unsafeGlobal.pricingConfig.create({
            data: {
              laneId: lane.id,
              version: 1,
              cbmRate: item.cbmRate,
              weightRateKg: item.weightRateKg,
              fixedFee: item.fixedFee,
              standardSurchargeBps: 10000,
              irregularSurchargeBps: 11500,
              noStackSurchargeBps: 13000,
              maxEdgeRatioThreshold: 5,
              effectiveFrom: new Date(),
              effectiveTo: null,
            },
          });
        }
      }
      this.logger.log('Default canonical lanes verified/seeded successfully');
    } catch (err) {
      this.logger.warn(`Failed to auto-seed default lanes: ${(err as Error).message}`);
    }
  }

  async findAll(activeOnly = false) {
    const lanes = await (this.prisma as any).lane.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { code: 'asc' },
      include: {
        pricingConfigs: {
          where: { effectiveTo: null },
          take: 1,
        },
      },
    });

    return lanes.map((lane: any) => {
      const { pricingConfigs, ...laneData } = lane;
      return {
        ...laneData,
        currentPricingConfig: pricingConfigs[0] ?? null,
      };
    });
  }

  async findById(id: string) {
    const lane = await (this.prisma as any).lane.findUnique({
      where: { id },
      include: {
        pricingConfigs: {
          where: { effectiveTo: null },
          take: 1,
        },
      },
    });

    if (!lane) {
      throw new NotFoundException(`Lane with ID "${id}" not found`);
    }

    const { pricingConfigs, ...laneData } = lane;
    return {
      ...laneData,
      currentPricingConfig: pricingConfigs[0] ?? null,
    };
  }

  async getPricingHistory(laneId: string) {
    const lane = await (this.prisma as any).lane.findUnique({
      where: { id: laneId },
    });

    if (!lane) {
      throw new NotFoundException(`Lane with ID "${laneId}" not found`);
    }

    return (this.prisma as any).pricingConfig.findMany({
      where: { laneId },
      orderBy: { version: 'desc' },
    });
  }

  async createLane(dto: CreateLaneDto) {
    if (!dto.code || !dto.name || !dto.origin || !dto.destination) {
      throw new BadRequestException('Code, name, origin, and destination are required');
    }

    const existing = await (this.prisma as any).lane.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Lane with code "${dto.code}" already exists`);
    }

    return (this.prisma as any).$transaction(async (tx: any) => {
      const lane = await tx.lane.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          origin: dto.origin.trim(),
          destination: dto.destination.trim(),
        },
      });

      const pricingConfig = await tx.pricingConfig.create({
        data: {
          laneId: lane.id,
          version: 1,
          cbmRate: BigInt(dto.cbmRate),
          weightRateKg: BigInt(dto.weightRateKg),
          fixedFee: BigInt(dto.fixedFee ?? 0),
          standardSurchargeBps: dto.standardSurchargeBps ?? 10000,
          irregularSurchargeBps: dto.irregularSurchargeBps ?? 11500,
          noStackSurchargeBps: dto.noStackSurchargeBps ?? 13000,
          maxEdgeRatioThreshold: dto.maxEdgeRatioThreshold ?? 5,
          effectiveFrom: new Date(),
          effectiveTo: null,
        },
      });

      return {
        ...lane,
        currentPricingConfig: pricingConfig,
      };
    });
  }

  async createPricingConfigVersion(laneId: string, dto: CreatePricingConfigDto) {
    const lane = await (this.prisma as any).lane.findUnique({
      where: { id: laneId },
    });

    if (!lane) {
      throw new NotFoundException(`Lane with ID "${laneId}" not found`);
    }

    return (this.prisma as any).$transaction(async (tx: any) => {
      const now = new Date();

      // Close the current active pricing config
      await tx.pricingConfig.updateMany({
        where: {
          laneId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: now,
        },
      });

      // Find max version
      const latest = await tx.pricingConfig.findFirst({
        where: { laneId },
        orderBy: { version: 'desc' },
      });

      const nextVersion = (latest?.version ?? 0) + 1;

      // Insert new version
      const newConfig = await tx.pricingConfig.create({
        data: {
          laneId,
          version: nextVersion,
          cbmRate: BigInt(dto.cbmRate),
          weightRateKg: BigInt(dto.weightRateKg),
          fixedFee: BigInt(dto.fixedFee ?? 0),
          standardSurchargeBps: dto.standardSurchargeBps ?? 10000,
          irregularSurchargeBps: dto.irregularSurchargeBps ?? 11500,
          noStackSurchargeBps: dto.noStackSurchargeBps ?? 13000,
          maxEdgeRatioThreshold: dto.maxEdgeRatioThreshold ?? 5,
          effectiveFrom: now,
          effectiveTo: null,
        },
      });

      return newConfig;
    });
  }
}
