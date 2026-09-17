import { Module } from '@nestjs/common';
import { LaneController } from './lane.controller';
import { LaneService } from './lane.service';

@Module({
  controllers: [LaneController],
  providers: [LaneService],
  exports: [LaneService],
})
export class LaneModule {}
