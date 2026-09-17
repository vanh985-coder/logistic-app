import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { LaneService } from './lane.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@logix/shared';
import { CreateLaneDto, CreatePricingConfigDto } from './dto/lane.dto';

@Controller('lanes')
export class LaneController {
  constructor(private readonly laneService: LaneService) {}

  @Get()
  async findAll(@Query('activeOnly') activeOnly?: string) {
    return this.laneService.findAll(activeOnly === 'true');
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.laneService.findById(id);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post()
  async createLane(@Body() dto: CreateLaneDto) {
    return this.laneService.createLane(dto);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Post(':id/pricing-configs')
  async createPricingConfigVersion(
    @Param('id') id: string,
    @Body() dto: CreatePricingConfigDto,
  ) {
    return this.laneService.createPricingConfigVersion(id, dto);
  }
}
