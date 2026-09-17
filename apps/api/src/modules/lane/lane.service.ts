import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLaneDto, CreatePricingConfigDto } from './dto/lane.dto';

@Injectable()
export class LaneService {
  constructor(private readonly prisma: PrismaService) {}

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

    return lanes.map((lane: any) => ({
      ...lane,
      currentPricingConfig: lane.pricingConfigs[0] ?? null,
    }));
  }

  async findById(id: string) {
    const lane = await (this.prisma as any).lane.findUnique({
      where: { id },
      include: {
        pricingConfigs: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!lane) {
      throw new NotFoundException(`Lane with ID "${id}" not found`);
    }

    const currentPricingConfig =
      lane.pricingConfigs.find((pc: any) => pc.effectiveTo === null) ?? null;

    return {
      ...lane,
      currentPricingConfig,
    };
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
