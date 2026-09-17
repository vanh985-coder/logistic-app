import { Module } from '@nestjs/common';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';
import { PackageExcelParserService } from './excel/package-excel-parser.service';

@Module({
  controllers: [ShipmentController],
  providers: [ShipmentService, PackageExcelParserService],
  exports: [ShipmentService, PackageExcelParserService],
})
export class ShipmentModule {}
