import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { PackingService } from './packing.service';
import { CalculatePackingDto } from './dto/packing-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('packing')
@UseGuards(JwtAuthGuard)
export class PackingController {
  constructor(private readonly packingService: PackingService) {}

  @Post('calculate')
  async calculatePacking(
    @Body() dto: CalculatePackingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.packingService.calculatePacking(dto);
    res.status(result.statusCode);
    return result;
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.packingService.getJobStatus(jobId);
  }
}
