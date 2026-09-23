import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  QuoteStatus,
  BookingStatus,
  MatchGroupStatus,
  ShipmentStatus,
  roundDiv,
  calculateAllocatedQuotes,
  ShipperShipmentAllocationInput,
} from '@logix/shared';
import { CreateQuoteDto, QuoteQueryDto } from './dto/quote.dto';

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique booking number in format BKGyyMMddxxx
   */
  private async generateBookingNumber(): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const prefix = `BKG${yy}${mm}${dd}`;

    const countToday = await (this.prisma.unsafeGlobal as any).booking.count({
      where: {
        bookingNumber: { startsWith: prefix },
      },
    });

    const seq = String(countToday + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  }

  /**
   * FWD creates a container quote for a proposed match group.
   */
  async create(dto: CreateQuoteDto, user: any) {
    if (!['FWD_ADMIN', 'FWD_OPERATOR', 'PLATFORM_ADMIN', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only FWD operators can create quotes.');
    }

    // Verify MatchGroup exists
    const matchGroup = await (this.prisma.unsafeGlobal as any).matchGroup.findUnique({
      where: { id: dto.matchGroupId },
      include: {
        matchGroupShipments: {
          include: {
            shipment: {
              include: { company: true },
            },
          },
        },
      },
    });

    if (!matchGroup) {
      throw new NotFoundException('Match group not found');
    }

    if (matchGroup.status === MatchGroupStatus.CLOSED || matchGroup.status === MatchGroupStatus.CANCELLED) {
      throw new BadRequestException(`Cannot quote on a match group with status ${matchGroup.status}`);
    }

    const oceanFreight = BigInt(Math.max(0, Math.round(Number(dto.oceanFreight))));
    const handlingFee = BigInt(Math.max(0, Math.round(Number(dto.handlingFee))));
    const documentationFee = BigInt(Math.max(0, Math.round(Number(dto.documentationFee))));
    const surcharges = BigInt(Math.max(0, Math.round(Number(dto.surcharges))));
    const vatRateBps = dto.vatRateBps ?? 1000;

    const subtotal = oceanFreight + handlingFee + documentationFee + surcharges;
    const vatAmount = roundDiv(subtotal * BigInt(vatRateBps), 10000n);
    const totalAmount = subtotal + vatAmount;

    const validUntil = new Date(dto.validUntil);
    if (isNaN(validUntil.getTime())) {
      throw new BadRequestException('Invalid validUntil date format');
    }

    const created = await (this.prisma as any).quote.create({
      data: {
        matchGroupId: dto.matchGroupId,
        fwdCompanyId: user.companyId,
        status: QuoteStatus.PENDING,
        oceanFreight,
        handlingFee,
        documentationFee,
        surcharges,
        vatRateBps,
        vatAmount,
        totalAmount,
        transitDays: Number(dto.transitDays) || 3,
        validUntil,
        notes: dto.notes || null,
      },
      include: {
        fwdCompany: {
          select: { id: true, name: true, taxCode: true },
        },
        matchGroup: {
          include: {
            matchGroupShipments: {
              include: {
                shipment: {
                  include: { company: true },
                },
              },
            },
          },
        },
      },
    });

    return this.formatQuote(created, user);
  }

  /**
   * Retrieves quotes. Multi-tenant isolation is automatically enforced by PrismaService:
   * - FWD: only sees their own quotes
   * - Shipper: only sees quotes for match groups their shipments belong to
   */
  async findAll(query: QuoteQueryDto, user: any) {
    const where: any = {};
    if (query.matchGroupId) {
      where.matchGroupId = query.matchGroupId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const quotes = await (this.prisma as any).quote.findMany({
      where,
      include: {
        fwdCompany: {
          select: { id: true, name: true, taxCode: true },
        },
        matchGroup: {
          include: {
            matchGroupShipments: {
              include: {
                shipment: {
                  include: { company: true },
                },
              },
            },
          },
        },
        bookings: {
          select: { id: true, bookingNumber: true, status: true, confirmedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return quotes.map((q: any) => this.formatQuote(q, user));
  }

  /**
   * Retrieve single quote by ID with IDOR protection.
   */
  async findById(id: string, user: any) {
    const quote = await (this.prisma as any).quote.findUnique({
      where: { id },
      include: {
        fwdCompany: {
          select: { id: true, name: true, taxCode: true },
        },
        matchGroup: {
          include: {
            matchGroupShipments: {
              include: {
                shipment: {
                  include: { company: true },
                },
              },
            },
          },
        },
        bookings: {
          select: { id: true, bookingNumber: true, status: true, confirmedAt: true },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found or you do not have permission to view it');
    }

    return this.formatQuote(quote, user);
  }

  /**
   * FWD confirms the quote into a Booking (Chốt booking).
   */
  async acceptBooking(id: string, user: any) {
    if (!['FWD_ADMIN', 'FWD_OPERATOR', 'PLATFORM_ADMIN', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Only FWD operators can confirm bookings.');
    }

    const quote = await (this.prisma as any).quote.findUnique({
      where: { id },
      include: {
        matchGroup: {
          include: {
            matchGroupShipments: {
              include: {
                shipment: true,
              },
            },
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found or does not belong to your company');
    }

    if (quote.status !== QuoteStatus.PENDING) {
      throw new BadRequestException(`Cannot accept quote in status ${quote.status}`);
    }

    const group = quote.matchGroup;
    if (!group || !group.matchGroupShipments || group.matchGroupShipments.length === 0) {
      throw new BadRequestException('Không thể chốt booking khi nhóm không có lô hàng nào.');
    }

    const totalPackages = group.matchGroupShipments.reduce((sum: number, mgs: any) => {
      const pkgCount = mgs.shipment?.packages?.length ?? mgs.shipment?.totalPackages ?? 0;
      return sum + pkgCount;
    }, 0);

    if (totalPackages === 0) {
      throw new BadRequestException('Không thể chốt booking khi nhóm không có kiện hàng nào.');
    }

    const shipmentIds = quote.matchGroup.matchGroupShipments.map((m: any) => m.shipmentId);
    const bookingNumber = await this.generateBookingNumber();

    // Run state transitions and booking creation in transaction
    const [updatedQuote, booking] = await (this.prisma.unsafeGlobal as any).$transaction(async (tx: any) => {
      // 1. Accept this quote
      const accepted = await tx.quote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.ACCEPTED },
      });

      // 2. Reject all other pending quotes on this match group
      await tx.quote.updateMany({
        where: {
          matchGroupId: quote.matchGroupId,
          id: { not: quote.id },
          status: QuoteStatus.PENDING,
        },
        data: { status: QuoteStatus.REJECTED },
      });

      // 3. Set MatchGroup to CONFIRMED
      await tx.matchGroup.update({
        where: { id: quote.matchGroupId },
        data: { status: MatchGroupStatus.CONFIRMED },
      });

      // 4. Set all constituent Shipments to CONFIRMED
      await tx.shipment.updateMany({
        where: { id: { in: shipmentIds } },
        data: { status: ShipmentStatus.CONFIRMED },
      });

      // 5. Create Booking
      const newBooking = await tx.booking.create({
        data: {
          bookingNumber,
          matchGroupId: quote.matchGroupId,
          quoteId: quote.id,
          fwdCompanyId: quote.fwdCompanyId,
          status: BookingStatus.CONFIRMED,
          totalAmount: quote.totalAmount,
          notes: quote.notes,
          confirmedAt: new Date(),
        },
      });

      return [accepted, newBooking];
    });

    return {
      success: true,
      message: `Booking ${booking.bookingNumber} confirmed successfully`,
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        totalAmount: BigInt(booking.totalAmount).toString(),
        confirmedAt: booking.confirmedAt.toISOString(),
      },
      quote: this.formatQuote({ ...quote, status: updatedQuote.status }, user),
    };
  }

  /**
   * Serializes a Quote with proportional breakdown calculated via shared library.
   */
  private formatQuote(q: any, user?: any) {
    const oceanFreight = BigInt(q.oceanFreight);
    const handlingFee = BigInt(q.handlingFee);
    const documentationFee = BigInt(q.documentationFee);
    const surcharges = BigInt(q.surcharges);
    const vatAmount = BigInt(q.vatAmount);
    const totalAmount = BigInt(q.totalAmount);

    // Prepare shipment inputs for calculateAllocatedQuotes
    const mgShipments = q.matchGroup?.matchGroupShipments || [];
    const shipmentInputs: ShipperShipmentAllocationInput[] = mgShipments.map((m: any) => {
      const s = m.shipment;
      return {
        shipmentId: s.id,
        companyId: s.companyId,
        companyName: s.company?.name || 'Shipper',
        trackingCode: s.trackingCode,
        volumeMm3: BigInt(s.volumeMm3),
        weightGrams: BigInt(s.weightGrams),
        baseFreightCost: BigInt(s.totalAmount),
      };
    });

    const allocatedResult = calculateAllocatedQuotes({
      quote: {
        oceanFreight,
        handlingFee,
        documentationFee,
        surcharges,
        vatRateBps: q.vatRateBps,
        vatAmount,
        totalAmount,
      },
      shipments: shipmentInputs,
    });

    // Format allocations for JSON response
    const formattedAllocations = allocatedResult.allocations.map((a) => ({
      shipmentId: a.shipmentId,
      companyId: a.companyId,
      companyName: a.companyName,
      trackingCode: a.trackingCode,
      volumeMm3: a.volumeMm3.toString(),
      weightGrams: a.weightGrams.toString(),
      baseFreightCost: a.baseFreightCost.toString(),
      costShareBps: a.costShareBps,
      costSharePercent: Number((a.costShareBps / 100).toFixed(2)),
      allocatedAmount: a.allocatedAmount.toString(),
      breakdown: {
        oceanFreight: a.breakdown.oceanFreight.toString(),
        handlingFee: a.breakdown.handlingFee.toString(),
        documentationFee: a.breakdown.documentationFee.toString(),
        surcharges: a.breakdown.surcharges.toString(),
        vatAmount: a.breakdown.vatAmount.toString(),
        totalAmount: a.breakdown.totalAmount.toString(),
      },
    }));

    // If caller is a Shipper, find their allocated share
    let myAllocation = null;
    if (user?.companyId) {
      myAllocation = formattedAllocations.find((a) => a.companyId === user.companyId) || null;
    }

    return {
      id: q.id,
      matchGroupId: q.matchGroupId,
      fwdCompanyId: q.fwdCompanyId,
      fwdCompany: q.fwdCompany
        ? {
            id: q.fwdCompany.id,
            name: q.fwdCompany.name,
            taxCode: q.fwdCompany.taxCode,
          }
        : undefined,
      status: q.status,
      oceanFreight: oceanFreight.toString(),
      handlingFee: handlingFee.toString(),
      documentationFee: documentationFee.toString(),
      surcharges: surcharges.toString(),
      vatRateBps: q.vatRateBps,
      vatAmount: vatAmount.toString(),
      totalAmount: totalAmount.toString(),
      transitDays: q.transitDays,
      validUntil: q.validUntil.toISOString(),
      notes: q.notes,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
      booking: q.bookings?.[0]
        ? {
            id: q.bookings[0].id,
            bookingNumber: q.bookings[0].bookingNumber,
            status: q.bookings[0].status,
            confirmedAt: q.bookings[0].confirmedAt?.toISOString(),
          }
        : undefined,
      allocations: formattedAllocations,
      myAllocation,
    };
  }
}
