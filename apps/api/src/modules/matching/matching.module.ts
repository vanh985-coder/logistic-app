import { Module } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { MatchGroupController } from './match-group.controller';
import { ContainerTypeService } from './container-type.service';
import { ContainerTypeController } from './container-type.controller';

@Module({
  controllers: [MatchGroupController, ContainerTypeController],
  providers: [MatchingService, ContainerTypeService],
  exports: [MatchingService, ContainerTypeService],
})
export class MatchingModule {}
