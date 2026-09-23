import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto, QuoteQueryDto } from './dto/quote.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@logix/shared';

@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async create(
    @Body() dto: CreateQuoteDto,
    @CurrentUser() user: any,
  ) {
    return this.quoteService.create(dto, user);
  }

  @Get()
  async findAll(
    @Query() query: QuoteQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.quoteService.findAll(query, user);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.quoteService.findById(id, user);
  }

  @Post(':id/accept-booking')
  @Roles(
    UserRole.PLATFORM_ADMIN,
    UserRole.ADMIN,
    UserRole.FWD_ADMIN,
    UserRole.FWD_OPERATOR,
  )
  async acceptBooking(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.quoteService.acceptBooking(id, user);
  }
}
