import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShipmentService } from './shipment.service';
import {
  CreateShipmentDto,
  AddPackageDto,
  ShipmentQueryDto,
} from './dto/shipment.dto';

@Controller('shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  async createShipment(@Body() dto: CreateShipmentDto) {
    return this.shipmentService.createShipment(dto);
  }

  @Get()
  async findAll(@Query() query: ShipmentQueryDto) {
    return this.shipmentService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.shipmentService.getStats();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.shipmentService.findById(id);
  }

  @Post(':id/packages')
  async addPackage(
    @Param('id') shipmentId: string,
    @Body() dto: AddPackageDto,
  ) {
    return this.shipmentService.addPackage(shipmentId, dto);
  }

  @Post(':id/packages/batch')
  async addPackagesBatch(
    @Param('id') shipmentId: string,
    @Body() body: { packages?: AddPackageDto[] } | AddPackageDto[],
  ) {
    const packages = Array.isArray(body) ? body : (body.packages ?? []);
    return this.shipmentService.addPackagesBatch(shipmentId, packages);
  }


  @Delete(':id/packages/:packageId')
  async deletePackage(
    @Param('id') shipmentId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.shipmentService.deletePackage(shipmentId, packageId);
  }

  @Post(':id/packages/import-excel')
  @UseInterceptors(FileInterceptor('file'))
  async importPackagesFromExcel(
    @Param('id') shipmentId: string,
    @UploadedFile() file: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng tải lên file Excel/CSV hợp lệ');
    }
    return this.shipmentService.importPackagesFromExcel(
      shipmentId,
      file.buffer,
    );
  }

  @Post(':id/submit')
  async submitShipment(@Param('id') shipmentId: string) {
    return this.shipmentService.submitShipment(shipmentId);
  }
}
