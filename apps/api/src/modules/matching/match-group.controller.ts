import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MatchingService } from './matching.service';
import {
  CreateMatchGroupDto,
  ProposeMatchingDto,
  MatchGroupQueryDto,
} from './dto/match-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@logix/shared';

@Controller('match-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchGroupController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('stats')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
    UserRole.CFS_ADMIN,
    UserRole.CFS_OPERATOR,
  )
  async getStats() {
    return this.matchingService.getStats();
  }

  @Get('unassigned-shipments')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async getUnassignedShipments(@Query('laneId') laneId?: string) {
    return this.matchingService.getUnassignedShipments(laneId);
  }

  @Get()
  async findAll(
    @Query() query: MatchGroupQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.matchingService.findAll(query, user);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.matchingService.findById(id, user);
  }

  @Post('propose')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async proposeMatches(@Body() dto: ProposeMatchingDto) {
    return this.matchingService.proposeMatches(dto);
  }

  @Post()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async createManualMatchGroup(@Body() dto: CreateMatchGroupDto) {
    return this.matchingService.createManualMatchGroup(dto);
  }

  @Post(':id/confirm')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async confirmMatchGroup(@Param('id') id: string) {
    return this.matchingService.confirmMatchGroup(id);
  }

  @Post(':id/cancel')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async cancelMatchGroup(@Param('id') id: string) {
    return this.matchingService.cancelMatchGroup(id);
  }
}
