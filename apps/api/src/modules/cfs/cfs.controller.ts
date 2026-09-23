import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CfsService } from './cfs.service';

@Controller('cfs')
@UseGuards(JwtAuthGuard)
export class CfsController {
  constructor(private readonly cfsService: CfsService) {}

  @Get('metrics')
  async getMetrics(@Req() req: any) {
    return this.cfsService.getMetrics(req.user);
  }

  @Get('tasks')
  async getCfsTasks(@Req() req: any) {
    return this.cfsService.getCfsTasks(req.user);
  }

  @Post('tally/:matchGroupId/shipment/:shipmentId')
  async tallyShipment(
    @Param('matchGroupId') matchGroupId: string,
    @Param('shipmentId') shipmentId: string,
    @Body()
    body: {
      actualPackageCount: number;
      isDiscrepant?: boolean;
      discrepancyReason?: string;
    },
    @Req() req: any,
  ) {
    if (typeof body.actualPackageCount !== 'number' || body.actualPackageCount < 0) {
      throw new BadRequestException('Số kiện thực nhận phải là số nguyên không âm.');
    }

    return this.cfsService.tallyShipment({
      matchGroupId,
      shipmentId,
      actualPackageCount: body.actualPackageCount,
      isDiscrepant: !!body.isDiscrepant,
      discrepancyReason: body.discrepancyReason,
      user: req.user,
    });
  }

  @Post('seal-container/:bookingId')
  async sealContainer(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
      containerNo: string;
      sealNo: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    return this.cfsService.sealContainer({
      bookingId,
      containerNo: body.containerNo,
      sealNo: body.sealNo,
      notes: body.notes,
      user: req.user,
    });
  }
}
