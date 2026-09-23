import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus, ShipmentStatus, LoadingProofType } from '@prisma/client';

@Injectable()
export class CfsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get CFS warehouse real dashboard metrics
   */
  async getMetrics(user: { companyId: string; role: string }) {
    const isGlobal = ['PLATFORM_ADMIN', 'ADMIN'].includes(user.role);
    const bookingWhere = isGlobal ? {} : { cfsCompanyId: user.companyId };

    // 1. Nhóm ghép chờ nhận hàng (CONFIRMED bookings)
    const waitingConsolidations = await this.prisma.booking.count({
      where: {
        ...bookingWhere,
        status: BookingStatus.CONFIRMED,
      },
    });

    // 2. Container đã niêm chì (SEALED bookings)
    const sealedContainers = await this.prisma.booking.count({
      where: {
        ...bookingWhere,
        status: BookingStatus.SEALED,
      },
    });

    // 3. Find all bookings under this CFS to inspect shipment tally status
    const bookings = await this.prisma.booking.findMany({
      where: bookingWhere,
      include: {
        matchGroup: {
          include: {
            matchGroupShipments: {
              include: {
                shipment: {
                  select: { totalPackages: true },
                },
              },
            },
          },
        },
      },
    });

    let tallyPendingShipments = 0;
    let totalPackagesHandled = 0;

    for (const b of bookings) {
      for (const mgs of b.matchGroup.matchGroupShipments) {
        if (mgs.tallyStatus === 'PENDING') {
          tallyPendingShipments++;
        } else {
          totalPackagesHandled +=
            mgs.actualPackageCount || mgs.shipment.totalPackages || 0;
        }
      }
    }

    return {
      waitingConsolidations,
      tallyPendingShipments,
      sealedContainers,
      totalPackagesHandled,
    };
  }

  /**
   * Get list of match groups / bookings assigned to this CFS
   */
  async getCfsTasks(user: { companyId: string; role: string }) {
    const isGlobal = ['PLATFORM_ADMIN', 'ADMIN'].includes(user.role);
    const whereClause: any = isGlobal
      ? {}
      : {
          OR: [
            { cfsCompanyId: user.companyId },
            { cfsCompanyId: null }, // Unassigned bookings that CFS can claim
          ],
        };

    const bookings = await this.prisma.booking.findMany({
      where: whereClause,
      include: {
        matchGroup: {
          include: {
            lane: true,
            targetContainerType: true,
            matchGroupShipments: {
              include: {
                shipment: {
                  include: {
                    packages: true,
                    company: {
                      select: { id: true, name: true, phone: true },
                    },
                  },
                },
              },
            },
          },
        },
        fwdCompany: {
          select: { id: true, name: true, phone: true },
        },
        cfsCompany: {
          select: { id: true, name: true },
        },
        loadingProofs: {
          select: {
            id: true,
            proofType: true,
            fileName: true,
            layerIndex: true,
            shipmentId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings;
  }

  /**
   * Tally individual shipment package count at CFS
   */
  async tallyShipment(params: {
    matchGroupId: string;
    shipmentId: string;
    actualPackageCount: number;
    isDiscrepant: boolean;
    discrepancyReason?: string;
    user: { companyId: string; role: string };
  }) {
    const {
      matchGroupId,
      shipmentId,
      actualPackageCount,
      isDiscrepant,
      discrepancyReason,
      user,
    } = params;

    const canOperate = [
      'CFS_ADMIN',
      'CFS_OPERATOR',
      'PLATFORM_ADMIN',
      'ADMIN',
    ].includes(user.role);
    if (!canOperate) {
      throw new ForbiddenException(
        'Chỉ nhân viên kho CFS hoặc Quản trị viên mới có quyền thực hiện kiểm đếm lô hàng.',
      );
    }

    const mgs = await this.prisma.matchGroupShipment.findUnique({
      where: {
        matchGroupId_shipmentId: {
          matchGroupId,
          shipmentId,
        },
      },
      include: {
        shipment: true,
        matchGroup: {
          include: {
            bookings: true,
          },
        },
      },
    });

    if (!mgs) {
      throw new NotFoundException('Không tìm thấy lô hàng trong nhóm ghép này.');
    }

    // Update MatchGroupShipment tally data
    const updatedMgs = await this.prisma.matchGroupShipment.update({
      where: { id: mgs.id },
      data: {
        actualPackageCount,
        isDiscrepant,
        discrepancyReason: isDiscrepant ? (discrepancyReason || 'Sai lệch số lượng kiện thực nhận') : null,
        tallyStatus: isDiscrepant ? 'DISCREPANT' : 'VERIFIED',
        tallyAt: new Date(),
      },
    });

    // Update shipment status to RECEIVED_CFS using unsafeGlobal for cross-tenant consolidation update
    await (this.prisma.unsafeGlobal as any).shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.RECEIVED_CFS,
      },
    });

    return updatedMgs;
  }

  /**
   * Confirm sealing and finalize container (Adjustment 1)
   */
  async sealContainer(params: {
    bookingId: string;
    containerNo: string;
    sealNo: string;
    notes?: string;
    user: { companyId: string; role: string };
  }) {
    const { bookingId, containerNo, sealNo, notes, user } = params;

    const canOperate = [
      'CFS_ADMIN',
      'CFS_OPERATOR',
      'PLATFORM_ADMIN',
      'ADMIN',
    ].includes(user.role);
    if (!canOperate) {
      throw new ForbiddenException(
        'Chỉ nhân viên kho CFS hoặc Quản trị viên mới có quyền xác nhận niêm chì đóng container.',
      );
    }

    if (!containerNo || !containerNo.trim()) {
      throw new BadRequestException('Vui lòng nhập mã container thực tế.');
    }

    if (!sealNo || !sealNo.trim()) {
      throw new BadRequestException('Vui lòng nhập số chì niêm phong (seal number).');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        matchGroup: {
          include: {
            matchGroupShipments: true,
          },
        },
        loadingProofs: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking để đóng container.');
    }

    // Verify at least one SEAL_CLOSED photo exists
    const hasSealProof = booking.loadingProofs.some(
      (p: any) => p.proofType === LoadingProofType.SEAL_CLOSED,
    );
    if (!hasSealProof) {
      throw new BadRequestException(
        'Vui lòng tải lên ít nhất một ảnh nghiệm thu kẹp chì (SEAL_CLOSED) trước khi xác nhận niêm chì đóng container.',
      );
    }

    // Update Booking to SEALED
    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        containerNo: containerNo.trim().toUpperCase(),
        sealNo: sealNo.trim().toUpperCase(),
        sealedAt: new Date(),
        status: BookingStatus.SEALED,
        notes: notes ? `${booking.notes ? booking.notes + '\n' : ''}${notes}` : booking.notes,
      },
    });

    // Update all shipments in the match group to SEALED using unsafeGlobal
    const shipmentIds = booking.matchGroup.matchGroupShipments.map(
      (mgs: any) => mgs.shipmentId,
    );
    if (shipmentIds.length > 0) {
      await (this.prisma.unsafeGlobal as any).shipment.updateMany({
        where: { id: { in: shipmentIds } },
        data: { status: ShipmentStatus.SEALED },
      });
    }

    return {
      ...updatedBooking,
      totalAmount: updatedBooking.totalAmount ? updatedBooking.totalAmount.toString() : '0',
    };
  }
}
