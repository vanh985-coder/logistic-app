import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ShipmentStatus,
  PackageType,
  calculateShipmentPricing,
  calcVolumeMm3,
} from '@logix/shared';
import { CreateShipmentDto, AddPackageDto, ShipmentQueryDto } from './dto/shipment.dto';
import { PackageExcelParserService } from './excel/package-excel-parser.service';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelParser: PackageExcelParserService,
  ) {}

  async createShipment(dto: CreateShipmentDto) {
    // 1. Find lane and active pricing config
    const lane = await (this.prisma as any).lane.findUnique({
      where: { id: dto.laneId },
      include: {
        pricingConfigs: {
          where: { effectiveTo: null },
          take: 1,
        },
      },
    });

    if (!lane || !lane.isActive) {
      throw new BadRequestException('Lane not found or is currently inactive');
    }

    const activeConfig = lane.pricingConfigs[0];
    if (!activeConfig) {
      throw new BadRequestException(
        `Lane "${lane.code}" has no active pricing config version`,
      );
    }

    // 2. Generate unique tracking code
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const trackingCode = `SHP-${dateStr}-${randSuffix}`;

    // 3. Initial calculation with 0 packages
    const initialPricing = calculateShipmentPricing([], activeConfig);

    // 4. Create draft shipment
    const shipment = await (this.prisma as any).shipment.create({
      data: {
        laneId: lane.id,
        pricingConfigId: activeConfig.id,
        trackingCode,
        status: ShipmentStatus.DRAFT,
        totalPackages: 0,
        volumeMm3: 0n,
        weightGrams: 0n,
        chargeableBasis: initialPricing.chargeableBasis,
        baseAmount: initialPricing.winningBaseAmount,
        surchargedAmount: initialPricing.surchargedAmount,
        totalAmount: initialPricing.totalAmount,
        pricingSnapshot: initialPricing,
      },
      include: {
        lane: true,
        pricingConfig: true,
      },
    });

    return shipment;
  }

  async findAll(query: ShipmentQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const items = await (this.prisma as any).shipment.findMany({
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      where: query.status ? { status: query.status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        lane: true,
        pricingConfig: true,
      },
    });

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async findById(id: string) {
    const shipment = await (this.prisma as any).shipment.findUnique({
      where: { id },
      include: {
        lane: true,
        pricingConfig: true,
        packages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID "${id}" not found`);
    }

    return shipment;
  }

  async addPackage(shipmentId: string, dto: AddPackageDto) {
    const shipment = await this.findById(shipmentId);
    if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.PRICED) {
      throw new BadRequestException('Cannot add package to a non-draft shipment');
    }

    if (dto.lengthMm <= 0 || dto.widthMm <= 0 || dto.heightMm <= 0 || dto.weightGrams <= 0) {
      throw new BadRequestException('Dimensions and weight must be positive numbers');
    }

    const volumeMm3 = calcVolumeMm3(dto.lengthMm, dto.widthMm, dto.heightMm);

    // Create the package
    await (this.prisma as any).package.create({
      data: {
        shipmentId,
        packageCode: dto.packageCode.trim(),
        lengthMm: Math.round(dto.lengthMm),
        widthMm: Math.round(dto.widthMm),
        heightMm: Math.round(dto.heightMm),
        volumeMm3,
        weightGrams: Math.round(dto.weightGrams),
        isFragile: Boolean(dto.isFragile),
        noStack: Boolean(dto.noStack),
        packageType: dto.packageType ?? PackageType.BOX,
      },
    });

    // Recalculate shipment pricing
    await this.recalculateShipment(shipmentId);

    return this.findById(shipmentId);
  }

  async addPackagesBatch(shipmentId: string, packagesDto: AddPackageDto[]) {
    const shipment = await this.findById(shipmentId);
    if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.PRICED) {
      throw new BadRequestException('Cannot add packages to a non-draft shipment');
    }

    if (!Array.isArray(packagesDto) || packagesDto.length === 0) {
      throw new BadRequestException('Packages array cannot be empty');
    }

    for (const p of packagesDto) {
      if (p.lengthMm <= 0 || p.widthMm <= 0 || p.heightMm <= 0 || p.weightGrams <= 0) {
        throw new BadRequestException(`Dimensions and weight must be positive for package "${p.packageCode}"`);
      }
    }

    const packageData = packagesDto.map((dto) => ({
      shipmentId,
      packageCode: dto.packageCode.trim(),
      lengthMm: Math.round(dto.lengthMm),
      widthMm: Math.round(dto.widthMm),
      heightMm: Math.round(dto.heightMm),
      volumeMm3: calcVolumeMm3(dto.lengthMm, dto.widthMm, dto.heightMm),
      weightGrams: Math.round(dto.weightGrams),
      isFragile: Boolean(dto.isFragile),
      noStack: Boolean(dto.noStack),
      packageType: dto.packageType ?? PackageType.BOX,
    }));

    await (this.prisma as any).package.createMany({
      data: packageData,
    });

    // Recalculate ONCE after inserting all packages in batch
    await this.recalculateShipment(shipmentId);

    return this.findById(shipmentId);
  }


  async deletePackage(shipmentId: string, packageId: string) {
    const shipment = await this.findById(shipmentId);
    if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.PRICED) {
      throw new BadRequestException('Cannot delete package from a non-draft shipment');
    }

    await (this.prisma as any).package.delete({
      where: { id: packageId },
    });

    await this.recalculateShipment(shipmentId);

    return this.findById(shipmentId);
  }

  async importPackagesFromExcel(shipmentId: string, buffer: Buffer) {
    const shipment = await this.findById(shipmentId);
    if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.PRICED) {
      throw new BadRequestException('Cannot import packages to a non-draft shipment');
    }

    const parseResult = this.excelParser.parseBuffer(buffer);

    if (!parseResult.success) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Lỗi xác thực dữ liệu file Excel',
        errors: parseResult.errors,
      });
    }

    if (parseResult.packages.length === 0) {
      throw new BadRequestException('File Excel không có dữ liệu kiện hàng hợp lệ');
    }

    // Insert packages
    const packageData = parseResult.packages.map((p) => ({
      shipmentId,
      packageCode: p.packageCode,
      lengthMm: p.lengthMm,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      volumeMm3: p.volumeMm3,
      weightGrams: p.weightGrams,
      isFragile: p.isFragile,
      noStack: p.noStack,
      packageType: p.packageType,
    }));

    await (this.prisma as any).package.createMany({
      data: packageData,
    });

    await this.recalculateShipment(shipmentId);

    return {
      success: true,
      importedCount: parseResult.packages.length,
      shipment: await this.findById(shipmentId),
    };
  }

  async recalculateShipment(shipmentId: string) {
    const shipment = await (this.prisma as any).shipment.findUnique({
      where: { id: shipmentId },
      include: {
        pricingConfig: true,
        packages: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment "${shipmentId}" not found`);
    }

    const pricingResult = calculateShipmentPricing(
      shipment.packages,
      shipment.pricingConfig,
    );

    const updated = await (this.prisma as any).shipment.update({
      where: { id: shipmentId },
      data: {
        totalPackages: pricingResult.totalPackages,
        volumeMm3: pricingResult.totalVolumeMm3,
        weightGrams: pricingResult.totalWeightGrams,
        chargeableBasis: pricingResult.chargeableBasis,
        baseAmount: pricingResult.winningBaseAmount,
        surchargedAmount: pricingResult.surchargedAmount,
        totalAmount: pricingResult.totalAmount,
        pricingSnapshot: pricingResult,
        status:
          shipment.status === ShipmentStatus.DRAFT && pricingResult.totalPackages > 0
            ? ShipmentStatus.PRICED
            : shipment.status,
      },
    });

    return updated;
  }

  async submitShipment(shipmentId: string) {
    const shipment = await this.findById(shipmentId);
    if (shipment.packages.length === 0) {
      throw new BadRequestException('Cannot submit shipment without packages');
    }

    if (shipment.status !== ShipmentStatus.DRAFT && shipment.status !== ShipmentStatus.PRICED) {
      throw new BadRequestException('Shipment is already submitted or confirmed');
    }

    const updated = await (this.prisma as any).shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.SUBMITTED,
      },
      include: {
        lane: true,
        pricingConfig: true,
        packages: true,
      },
    });

    return updated;
  }
}
