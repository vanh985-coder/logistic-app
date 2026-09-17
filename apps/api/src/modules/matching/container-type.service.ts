import { Injectable, OnModuleInit, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cbmFromVolumeMm3, kgFromWeightGrams } from '@logix/shared';

export const STANDARD_CONTAINERS = [
  {
    code: '20DC',
    name: 'Container 20ft Tiêu Chuẩn (20DC)',
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: BigInt(5898) * BigInt(2352) * BigInt(2393), // 33,200,854,752 mm3
    maxPayloadGram: 28200000n, // 28,200 kg
    tareWeightGram: 2280000n, // 2,280 kg
    isActive: true,
  },
  {
    code: '40DC',
    name: 'Container 40ft Tiêu Chuẩn (40DC)',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    volumeMm3: BigInt(12032) * BigInt(2352) * BigInt(2393), // 67,722,866,688 mm3
    maxPayloadGram: 26700000n, // 26,700 kg
    tareWeightGram: 3780000n, // 3,780 kg
    isActive: true,
  },
  {
    code: '40HC',
    name: 'Container 40ft Cao (40HC)',
    innerLengthMm: 12032,
    innerWidthMm: 2352,
    innerHeightMm: 2698,
    volumeMm3: BigInt(12032) * BigInt(2352) * BigInt(2698), // 76,351,699,968 mm3
    maxPayloadGram: 26500000n, // 26,500 kg
    tareWeightGram: 3980000n, // 3,980 kg
    isActive: true,
  },
];

@Injectable()
export class ContainerTypeService implements OnModuleInit {
  private readonly logger = new Logger(ContainerTypeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultContainers();
  }

  async seedDefaultContainers() {
    try {
      const count = await this.prisma.unsafeGlobal.containerType.count();
      if (count === 0) {
        this.logger.log('Seeding standard ISO container types (20DC, 40DC, 40HC)...');
        for (const c of STANDARD_CONTAINERS) {
          await this.prisma.unsafeGlobal.containerType.upsert({
            where: { code: c.code },
            update: {},
            create: c,
          });
        }
        this.logger.log('Standard ISO container types seeded successfully');
      }
    } catch (err) {
      this.logger.warn(`Failed to auto-seed container types: ${(err as Error).message}`);
    }
  }

  async findAll(activeOnly = true) {
    const containers = await (this.prisma as any).containerType.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { code: 'asc' },
    });

    return containers.map((c: any) => this.formatContainer(c));
  }

  async findById(id: string) {
    const container = await (this.prisma as any).containerType.findUnique({
      where: { id },
    });

    if (!container) {
      throw new NotFoundException(`Container type with ID "${id}" not found`);
    }

    return this.formatContainer(container);
  }

  async findByCode(code: string) {
    const container = await (this.prisma as any).containerType.findUnique({
      where: { code },
    });

    if (!container) {
      return null;
    }

    return this.formatContainer(container);
  }

  private formatContainer(c: any) {
    const volumeBigInt = BigInt(c.volumeMm3);
    const maxPayloadBigInt = BigInt(c.maxPayloadGram);
    const tareWeightBigInt = BigInt(c.tareWeightGram);

    return {
      id: c.id,
      code: c.code,
      name: c.name,
      innerLengthMm: c.innerLengthMm,
      innerWidthMm: c.innerWidthMm,
      innerHeightMm: c.innerHeightMm,
      volumeMm3: volumeBigInt.toString(),
      volumeCbm: cbmFromVolumeMm3(volumeBigInt),
      maxPayloadGram: maxPayloadBigInt.toString(),
      maxPayloadKg: kgFromWeightGrams(maxPayloadBigInt),
      tareWeightGram: tareWeightBigInt.toString(),
      tareWeightKg: kgFromWeightGrams(tareWeightBigInt),
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
