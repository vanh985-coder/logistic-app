import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MatchGroupStatus,
  ShipmentStatus,
  UserRole,
  cbmFromVolumeMm3,
  kgFromWeightGrams,
} from '@logix/shared';
import {
  CreateMatchGroupDto,
  ProposeMatchingDto,
  MatchGroupQueryDto,
} from './dto/match-group.dto';
import {
  MatchingEngine,
  CandidateShipment,
  ContainerSpec,
} from './matching-engine';
import { ContainerTypeService } from './container-type.service';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly containerService: ContainerTypeService,
  ) {}

  /**
   * Generates a unique match group code in format MGyyMMddxxx (e.g. MG260917001).
   */
  async generateCode(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `MG${yy}${mm}${dd}`;

    const countToday = await (this.prisma as any).matchGroup.count({
      where: {
        code: { startsWith: prefix },
      },
    });

    const seq = String(countToday + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  }

  /**
   * Evaluates all unassigned SUBMITTED shipments and generates optimal consol proposals.
   */
  async proposeMatches(dto: ProposeMatchingDto) {
    // 1. Fetch available container types
    const rawContainers = await (this.prisma as any).containerType.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    if (rawContainers.length === 0) {
      throw new BadRequestException('No active container types found in system');
    }

    const containerSpecs: ContainerSpec[] = rawContainers.map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      innerLengthMm: c.innerLengthMm,
      innerWidthMm: c.innerWidthMm,
      innerHeightMm: c.innerHeightMm,
      volumeMm3: BigInt(c.volumeMm3),
      maxPayloadGram: BigInt(c.maxPayloadGram),
      tareWeightGram: BigInt(c.tareWeightGram),
    }));

    // 2. Fetch unassigned SUBMITTED shipments
    const candidateShipments = await this.getUnassignedShipmentsInternal(dto.laneId);
    if (candidateShipments.length === 0) {
      return {
        success: true,
        message: 'No unassigned submitted shipments available for consolidation matching',
        proposals: [],
      };
    }

    // 3. Group shipments by laneId
    const laneGroups = new Map<string, CandidateShipment[]>();
    for (const s of candidateShipments) {
      const list = laneGroups.get(s.laneId) || [];
      list.push(s);
      laneGroups.set(s.laneId, list);
    }

    const createdGroups = [];

    // 4. Process each lane
    for (const [laneId, shipments] of laneGroups.entries()) {
      let remaining = [...shipments];

      while (remaining.length > 0) {
        const bestContainer = MatchingEngine.selectBestContainer(remaining, containerSpecs);
        if (!bestContainer) break;

        const plan = MatchingEngine.buildConsolidationPlan(remaining, bestContainer);
        if (!plan || plan.shipments.length === 0) break;

        const code = await this.generateCode();
        const cutoffTime = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h default

        // Persist MatchGroup and links in transaction
        const group = await (this.prisma.unsafeGlobal as any).$transaction(async (tx: any) => {
          const mg = await tx.matchGroup.create({
            data: {
              code,
              laneId,
              targetContainerTypeId: plan.container.id,
              status: MatchGroupStatus.PROPOSED,
              cutoffTime,
              totalCbmMm3: plan.totalVolumeMm3,
              totalWeightGrams: plan.totalWeightGrams,
              volumeFillBps: plan.volumeFillBps,
              weightFillBps: plan.weightFillBps,
            },
          });

          for (const s of plan.shipments) {
            await tx.matchGroupShipment.create({
              data: {
                companyId: s.companyId,
                matchGroupId: mg.id,
                shipmentId: s.id,
              },
            });

            await tx.shipment.update({
              where: { id: s.id },
              data: { status: ShipmentStatus.MATCHING },
            });
          }

          return mg;
        });

        createdGroups.push(await this.findById(group.id, null));

        // Remove matched shipments from remaining
        const selectedIds = new Set(plan.shipments.map((s) => s.id));
        remaining = remaining.filter((s) => !selectedIds.has(s.id));
      }
    }

    return {
      success: true,
      proposalsCount: createdGroups.length,
      proposals: createdGroups,
    };
  }

  /**
   * Allows forwarders to manually assemble a consol group.
   */
  async createManualMatchGroup(dto: CreateMatchGroupDto) {
    if (!dto.shipmentIds || dto.shipmentIds.length === 0) {
      throw new BadRequestException('At least one shipment is required to create a match group');
    }

    // 1. Fetch container
    const container = await (this.prisma as any).containerType.findUnique({
      where: { id: dto.targetContainerTypeId },
    });
    if (!container || !container.isActive) {
      throw new BadRequestException(`Container type "${dto.targetContainerTypeId}" not found or inactive`);
    }

    // 2. Fetch and validate shipments
    const shipments = await (this.prisma.unsafeGlobal as any).shipment.findMany({
      where: { id: { in: dto.shipmentIds } },
      include: { packages: true },
    });

    if (shipments.length !== dto.shipmentIds.length) {
      throw new BadRequestException('One or more specified shipments could not be found');
    }

    for (const s of shipments) {
      if (s.laneId !== dto.laneId) {
        throw new BadRequestException(`Shipment "${s.trackingCode}" belongs to a different lane`);
      }
      if (s.status !== ShipmentStatus.SUBMITTED) {
        throw new BadRequestException(
          `Shipment "${s.trackingCode}" has status "${s.status}". Only SUBMITTED shipments can be consolidated.`,
        );
      }
    }

    // 3. Compute aggregate volume and weight
    let totalVolumeMm3 = 0n;
    let totalWeightGrams = 0n;
    for (const s of shipments) {
      totalVolumeMm3 += BigInt(s.volumeMm3);
      totalWeightGrams += BigInt(s.weightGrams);
    }

    const containerVolume = BigInt(container.volumeMm3);
    const containerPayload = BigInt(container.maxPayloadGram);

    if (totalWeightGrams > containerPayload) {
      throw new BadRequestException(
        `Total cargo weight (${kgFromWeightGrams(totalWeightGrams)} kg) exceeds container max payload (${kgFromWeightGrams(containerPayload)} kg)`,
      );
    }

    const volumeFillBps = Number((totalVolumeMm3 * 10000n) / containerVolume);
    const weightFillBps = Number((totalWeightGrams * 10000n) / containerPayload);

    const code = await this.generateCode();
    const cutoffTime = dto.cutoffTime ? new Date(dto.cutoffTime) : new Date(Date.now() + 72 * 60 * 60 * 1000);

    const group = await (this.prisma.unsafeGlobal as any).$transaction(async (tx: any) => {
      const mg = await tx.matchGroup.create({
        data: {
          code,
          laneId: dto.laneId,
          targetContainerTypeId: container.id,
          status: MatchGroupStatus.PROPOSED,
          cutoffTime,
          totalCbmMm3: totalVolumeMm3,
          totalWeightGrams,
          volumeFillBps,
          weightFillBps,
        },
      });

      for (const s of shipments) {
        await tx.matchGroupShipment.create({
          data: {
            companyId: s.companyId,
            matchGroupId: mg.id,
            shipmentId: s.id,
          },
        });

        await tx.shipment.update({
          where: { id: s.id },
          data: { status: ShipmentStatus.MATCHING },
        });
      }

      return mg;
    });

    return this.findById(group.id, null);
  }

  /**
   * Confirms a proposed consolidation group.
   */
  async confirmMatchGroup(id: string) {
    const group = await (this.prisma as any).matchGroup.findUnique({
      where: { id },
      include: { matchGroupShipments: true },
    });

    if (!group) {
      throw new NotFoundException(`Match group with ID "${id}" not found`);
    }

    if (group.status !== MatchGroupStatus.PROPOSED) {
      throw new BadRequestException(
        `Cannot confirm match group with status "${group.status}". Only PROPOSED groups can be confirmed.`,
      );
    }

    await (this.prisma.unsafeGlobal as any).$transaction(async (tx: any) => {
      await tx.matchGroup.update({
        where: { id },
        data: { status: MatchGroupStatus.CONFIRMED },
      });

      const shipmentIds = group.matchGroupShipments.map((m: any) => m.shipmentId);
      await tx.shipment.updateMany({
        where: { id: { in: shipmentIds } },
        data: { status: ShipmentStatus.GROUPED },
      });
    });

    return this.findById(id, null);
  }

  /**
   * Cancels a proposed or confirmed consolidation group and frees shipments.
   */
  async cancelMatchGroup(id: string) {
    const group = await (this.prisma as any).matchGroup.findUnique({
      where: { id },
      include: { matchGroupShipments: true },
    });

    if (!group) {
      throw new NotFoundException(`Match group with ID "${id}" not found`);
    }

    if (group.status === MatchGroupStatus.CLOSED || group.status === MatchGroupStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel match group with status "${group.status}"`);
    }

    await (this.prisma.unsafeGlobal as any).$transaction(async (tx: any) => {
      await tx.matchGroup.update({
        where: { id },
        data: { status: MatchGroupStatus.CANCELLED },
      });

      const shipmentIds = group.matchGroupShipments.map((m: any) => m.shipmentId);
      await tx.shipment.updateMany({
        where: { id: { in: shipmentIds } },
        data: { status: ShipmentStatus.SUBMITTED },
      });
    });

    return this.findById(id, null);
  }

  /**
   * Lists match groups with filtering and multi-tenant authorization.
   */
  async findAll(
    query: MatchGroupQueryDto,
    user: { role: string; companyId: string } | null,
  ) {
    const where: any = {};

    if (query.laneId) {
      where.laneId = query.laneId;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Multi-tenant check: Shippers only see groups containing their company's shipments
    if (
      user &&
      (user.role === UserRole.SHIPPER_ADMIN || user.role === UserRole.SHIPPER_MEMBER)
    ) {
      where.matchGroupShipments = {
        some: {
          companyId: user.companyId,
        },
      };
    }

    const limit = Math.min(query.limit ?? 20, 100);

    const groups = await (this.prisma as any).matchGroup.findMany({
      where,
      take: limit + 1,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        lane: true,
        targetContainerType: true,
        matchGroupShipments: {
          include: {
            shipment: {
              include: {
                company: {
                  select: { id: true, name: true, taxCode: true },
                },
              },
            },
          },
        },
      },
    });

    const hasMore = groups.length > limit;
    if (hasMore) {
      groups.pop();
    }

    const nextCursor = hasMore && groups.length > 0 ? groups[groups.length - 1].id : null;

    return {
      items: groups.map((g: any) => this.formatMatchGroup(g)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Retrieves full details of a specific match group.
   */
  async findById(
    id: string,
    user: { role: string; companyId: string } | null,
  ) {
    const group = await (this.prisma as any).matchGroup.findUnique({
      where: { id },
      include: {
        lane: true,
        targetContainerType: true,
        matchGroupShipments: {
          include: {
            shipment: {
              include: {
                company: {
                  select: { id: true, name: true, taxCode: true },
                },
                packages: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Match group with ID "${id}" not found`);
    }

    // Shipper authorization check
    if (
      user &&
      (user.role === UserRole.SHIPPER_ADMIN || user.role === UserRole.SHIPPER_MEMBER)
    ) {
      const hasAccess = group.matchGroupShipments.some(
        (m: any) => m.companyId === user.companyId || m.shipment?.companyId === user.companyId,
      );
      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to view this consolidation group');
      }
    }

    return this.formatMatchGroup(group);
  }

  /**
   * Retrieves summary statistics for forwarder / CFS dashboard.
   */
  async getStats() {
    const groups = await (this.prisma as any).matchGroup.findMany({
      include: {
        matchGroupShipments: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let totalGroupedShipments = 0;
    let totalGroupedCbmMm3 = 0n;
    let totalGroupedWeightGrams = 0n;
    let totalVolumeFillBps = 0;
    let totalWeightFillBps = 0;
    let activeGroupCount = 0;

    for (const g of groups) {
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;

      if (g.status === MatchGroupStatus.PROPOSED || g.status === MatchGroupStatus.CONFIRMED) {
        activeGroupCount++;
        totalGroupedShipments += g.matchGroupShipments.length;
        totalGroupedCbmMm3 += BigInt(g.totalCbmMm3);
        totalGroupedWeightGrams += BigInt(g.totalWeightGrams);
        totalVolumeFillBps += g.volumeFillBps;
        totalWeightFillBps += g.weightFillBps;
      }
    }

    const avgVolumeFillBps = activeGroupCount > 0 ? Math.round(totalVolumeFillBps / activeGroupCount) : 0;
    const avgWeightFillBps = activeGroupCount > 0 ? Math.round(totalWeightFillBps / activeGroupCount) : 0;

    return {
      totalMatchGroups: groups.length,
      activeMatchGroups: activeGroupCount,
      byStatus,
      totalGroupedShipments,
      totalGroupedCbmMm3: totalGroupedCbmMm3.toString(),
      totalGroupedCbm: cbmFromVolumeMm3(totalGroupedCbmMm3),
      totalGroupedWeightGrams: totalGroupedWeightGrams.toString(),
      totalGroupedWeightKg: kgFromWeightGrams(totalGroupedWeightGrams),
      avgVolumeFillBps,
      avgVolumeFillRate: Number((avgVolumeFillBps / 100).toFixed(1)),
      avgWeightFillBps,
      avgWeightFillRate: Number((avgWeightFillBps / 100).toFixed(1)),
    };
  }

  /**
   * Fetches unassigned SUBMITTED shipments available for consolidation.
   */
  async getUnassignedShipments(laneId?: string) {
    const internal = await this.getUnassignedShipmentsInternal(laneId);
    return internal.map((s) => ({
      id: s.id,
      trackingCode: s.trackingCode,
      laneId: s.laneId,
      volumeMm3: s.volumeMm3.toString(),
      volumeCbm: cbmFromVolumeMm3(s.volumeMm3),
      weightGrams: s.weightGrams.toString(),
      weightKg: kgFromWeightGrams(s.weightGrams),
      totalPackages: s.totalPackages,
      companyId: s.companyId,
    }));
  }

  /**
   * Internal helper to retrieve CandidateShipment objects.
   */
  private async getUnassignedShipmentsInternal(laneId?: string): Promise<CandidateShipment[]> {
    const where: any = {
      status: ShipmentStatus.SUBMITTED,
    };

    if (laneId) {
      where.laneId = laneId;
    }

    // Filter out shipments already in PROPOSED or CONFIRMED match groups
    const shipments = await (this.prisma.unsafeGlobal as any).shipment.findMany({
      where: {
        ...where,
        matchGroupShipments: {
          none: {
            matchGroup: {
              status: { in: [MatchGroupStatus.PROPOSED, MatchGroupStatus.CONFIRMED] },
            },
          },
        },
      },
      include: {
        packages: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return shipments.map((s: any) => ({
      id: s.id,
      trackingCode: s.trackingCode,
      laneId: s.laneId,
      volumeMm3: BigInt(s.volumeMm3),
      weightGrams: BigInt(s.weightGrams),
      totalPackages: s.totalPackages,
      companyId: s.companyId,
      packages: s.packages.map((p: any) => ({
        id: p.id,
        lengthMm: p.lengthMm,
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        weightGrams: p.weightGrams,
        isFragile: p.isFragile,
        noStack: p.noStack,
      })),
    }));
  }

  /**
   * Formats a MatchGroup record for API response.
   */
  private formatMatchGroup(g: any) {
    const totalVolumeMm3 = BigInt(g.totalCbmMm3);
    const totalWeightGrams = BigInt(g.totalWeightGrams);

    return {
      id: g.id,
      code: g.code,
      laneId: g.laneId,
      lane: g.lane
        ? {
            id: g.lane.id,
            code: g.lane.code,
            name: g.lane.name,
            origin: g.lane.origin,
            destination: g.lane.destination,
          }
        : undefined,
      targetContainerTypeId: g.targetContainerTypeId,
      targetContainerType: g.targetContainerType
        ? {
            id: g.targetContainerType.id,
            code: g.targetContainerType.code,
            name: g.targetContainerType.name,
            innerLengthMm: g.targetContainerType.innerLengthMm,
            innerWidthMm: g.targetContainerType.innerWidthMm,
            innerHeightMm: g.targetContainerType.innerHeightMm,
            volumeMm3: BigInt(g.targetContainerType.volumeMm3).toString(),
            volumeCbm: cbmFromVolumeMm3(BigInt(g.targetContainerType.volumeMm3)),
            maxPayloadGram: BigInt(g.targetContainerType.maxPayloadGram).toString(),
            maxPayloadKg: kgFromWeightGrams(BigInt(g.targetContainerType.maxPayloadGram)),
            tareWeightGram: BigInt(g.targetContainerType.tareWeightGram).toString(),
            tareWeightKg: kgFromWeightGrams(BigInt(g.targetContainerType.tareWeightGram)),
            isActive: g.targetContainerType.isActive,
          }
        : undefined,
      status: g.status,
      cutoffTime: g.cutoffTime ? g.cutoffTime.toISOString() : null,
      totalCbmMm3: totalVolumeMm3.toString(),
      totalCbm: cbmFromVolumeMm3(totalVolumeMm3),
      totalWeightGrams: totalWeightGrams.toString(),
      totalWeightKg: kgFromWeightGrams(totalWeightGrams),
      volumeFillBps: g.volumeFillBps,
      volumeFillRate: Number((g.volumeFillBps / 100).toFixed(1)),
      weightFillBps: g.weightFillBps,
      weightFillRate: Number((g.weightFillBps / 100).toFixed(1)),
      shipmentCount: g.matchGroupShipments ? g.matchGroupShipments.length : 0,
      shipments: g.matchGroupShipments?.map((m: any) => ({
        id: m.id,
        shipmentId: m.shipmentId,
        joinedAt: m.joinedAt.toISOString(),
        shipment: m.shipment
          ? {
              id: m.shipment.id,
              trackingCode: m.shipment.trackingCode,
              companyId: m.shipment.companyId,
              company: m.shipment.company,
              status: m.shipment.status,
              totalPackages: m.shipment.totalPackages,
              volumeMm3: BigInt(m.shipment.volumeMm3).toString(),
              volumeCbm: cbmFromVolumeMm3(BigInt(m.shipment.volumeMm3)),
              weightGrams: BigInt(m.shipment.weightGrams).toString(),
              weightKg: kgFromWeightGrams(BigInt(m.shipment.weightGrams)),
              totalAmount: BigInt(m.shipment.totalAmount).toString(),
              chargeableBasis: m.shipment.chargeableBasis,
              packages: m.shipment.packages,
            }
          : undefined,
      })),
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    };
  }
}
