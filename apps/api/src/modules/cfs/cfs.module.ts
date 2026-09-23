import { Module } from '@nestjs/common';
import { CfsController } from './cfs.controller';
import { CfsService } from './cfs.service';

@Module({
  controllers: [CfsController],
  providers: [CfsService],
  exports: [CfsService],
})
export class CfsModule {}
