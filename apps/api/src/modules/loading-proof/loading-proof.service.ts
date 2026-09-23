import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LoadingProofType } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface UploadProofParams {
  bookingId: string;
  matchGroupId: string;
  proofType: LoadingProofType;
  shipmentId?: string;
  layerIndex?: number;
  notes?: string;
  fileBuffer: Buffer;
  originalName: string;
  user: {
    userId: string;
    companyId: string;
    role: string;
  };
}

@Injectable()
export class LoadingProofService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Upload proof with validation:
   * - Max 10MB (in storage.service)
   * - Whitelist magic bytes for JPEG/PNG/WEBP (in storage.service)
   * - Server-side UUID file key (Adjustment 2)
   * - Max 50 photos per booking (Adjustment 2)
   * - Role check
   */
  async uploadProof(params: UploadProofParams) {
    const {
      bookingId,
      matchGroupId,
      proofType,
      shipmentId,
      layerIndex,
      notes,
      fileBuffer,
      originalName,
      user,
    } = params;

    // 1. Role validation
    const canUpload = [
      'CFS_ADMIN',
      'CFS_OPERATOR',
      'PLATFORM_ADMIN',
      'ADMIN',
    ].includes(user.role);
    if (!canUpload) {
      throw new ForbiddenException(
        'Chỉ nhân viên kho CFS hoặc Quản trị viên mới có quyền tải lên ảnh nghiệm thu.',
      );
    }

    // 2. Booking validation
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId },
      include: {
        matchGroup: {
          include: {
            matchGroupShipments: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy booking hợp lệ.');
    }

    // If CFS user, verify warehouse assignment (or auto-assign if unassigned)
    if (
      ['CFS_ADMIN', 'CFS_OPERATOR'].includes(user.role) &&
      booking.cfsCompanyId &&
      booking.cfsCompanyId !== user.companyId
    ) {
      throw new ForbiddenException(
        'Booking này thuộc quyền quản lý của một kho CFS khác.',
      );
    }

    // If booking CFS is unassigned, assign to this CFS company
    if (['CFS_ADMIN', 'CFS_OPERATOR'].includes(user.role) && !booking.cfsCompanyId) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { cfsCompanyId: user.companyId },
      });
    }

    // 3. Max 50 photos per booking guard (Adjustment 2)
    const existingProofCount = await this.prisma.loadingProof.count({
      where: { bookingId },
    });
    if (existingProofCount >= 50) {
      throw new BadRequestException(
        'Đã đạt giới hạn tối đa 50 ảnh nghiệm thu cho container / booking này.',
      );
    }

    // 4. Validate proofType specific requirements
    if (proofType === LoadingProofType.INBOUND_INSPECTION) {
      if (!shipmentId) {
        throw new BadRequestException(
          'Ảnh kiểm đếm nhập kho (INBOUND_INSPECTION) bắt buộc phải gắn với một lô hàng (shipmentId).',
        );
      }
      const shipmentBelongsToGroup = booking.matchGroup.matchGroupShipments.some(
        (mgs: any) => mgs.shipmentId === shipmentId,
      );
      if (!shipmentBelongsToGroup) {
        throw new BadRequestException(
          'Lô hàng chỉ định không nằm trong nhóm ghép của container này.',
        );
      }
    }

    // 5. Validate magic bytes and get extension
    const validated = this.storage.validateImageBuffer(fileBuffer);

    // 6. Generate server-side UUID key (Adjustment 2)
    const proofUuid = randomUUID();
    const serverFileKey = `proofs/${bookingId}/${proofUuid}.${validated.extension}`;

    // 7. Upload to MinIO
    await this.storage.uploadFile(
      serverFileKey,
      fileBuffer,
      validated.mimeType,
    );

    // 8. Save record to database
    const proof = await this.prisma.loadingProof.create({
      data: {
        id: proofUuid,
        bookingId,
        matchGroupId,
        shipmentId:
          proofType === LoadingProofType.INBOUND_INSPECTION ? shipmentId : null,
        companyId: user.companyId,
        proofType,
        layerIndex:
          proofType === LoadingProofType.LAYER_PACKED
            ? (layerIndex ? Number(layerIndex) : null)
            : null,
        fileKey: serverFileKey,
        fileName: originalName || `${proofUuid}.${validated.extension}`,
        fileSize: fileBuffer.length,
        mimeType: validated.mimeType,
        notes: notes || null,
      },
    });

    // Generate presigned URL (15m = 900s)
    const presignedUrl = await this.storage.getPresignedDownloadUrl(
      proof.fileKey,
      900,
    );

    return {
      ...proof,
      presignedUrl,
    };
  }

  /**
   * Get all proofs for a booking with presigned URLs, filtered by caller tenancy
   */
  async getProofsForBooking(bookingId: string, customExpiresIn = 900) {
    const proofs = await this.prisma.loadingProof.findMany({
      where: { bookingId },
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            companyId: true,
            totalPackages: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      proofs.map(async (p: any) => ({
        ...p,
        presignedUrl: await this.storage.getPresignedDownloadUrl(
          p.fileKey,
          customExpiresIn,
        ),
      })),
    );
  }

  /**
   * Get single proof by ID with presigned URL
   * Tenant isolation guard in PrismaService ensures Shipper B cannot see Shipper A's inbound inspection photo.
   */
  async getProofById(id: string, customExpiresIn = 900) {
    const proof = await this.prisma.loadingProof.findUnique({
      where: { id },
      include: {
        shipment: {
          select: {
            id: true,
            trackingCode: true,
            companyId: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!proof) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập ảnh nghiệm thu này hoặc ảnh không tồn tại.',
      );
    }

    const presignedUrl = await this.storage.getPresignedDownloadUrl(
      proof.fileKey,
      customExpiresIn,
    );

    return {
      ...proof,
      presignedUrl,
    };
  }
}
