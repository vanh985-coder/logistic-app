import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoadingProofService } from './loading-proof.service';
import { LoadingProofType } from '@prisma/client';

@Controller('loading-proofs')
@UseGuards(JwtAuthGuard)
export class LoadingProofController {
  constructor(private readonly loadingProofService: LoadingProofService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadProof(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      bookingId: string;
      matchGroupId: string;
      proofType: LoadingProofType;
      shipmentId?: string;
      layerIndex?: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp ảnh tải lên.');
    }

    if (!body.bookingId || !body.matchGroupId || !body.proofType) {
      throw new BadRequestException(
        'Thiếu thông tin bắt buộc: bookingId, matchGroupId, proofType.',
      );
    }

    return this.loadingProofService.uploadProof({
      bookingId: body.bookingId,
      matchGroupId: body.matchGroupId,
      proofType: body.proofType,
      shipmentId: body.shipmentId,
      layerIndex: body.layerIndex ? parseInt(body.layerIndex, 10) : undefined,
      notes: body.notes,
      fileBuffer: file.buffer,
      originalName: file.originalname,
      user: req.user,
    });
  }

  @Get('booking/:bookingId')
  async getProofsForBooking(
    @Param('bookingId') bookingId: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const parsedExpiresIn = expiresIn ? parseInt(expiresIn, 10) : 900;
    return this.loadingProofService.getProofsForBooking(
      bookingId,
      parsedExpiresIn,
    );
  }

  @Get(':id')
  async getProofById(
    @Param('id') id: string,
    @Query('expiresIn') expiresIn?: string,
  ) {
    const parsedExpiresIn = expiresIn ? parseInt(expiresIn, 10) : 900;
    return this.loadingProofService.getProofById(id, parsedExpiresIn);
  }
}
