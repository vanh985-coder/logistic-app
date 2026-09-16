import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, CompanyStatus } from '@logix/shared';

@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Roles(UserRole.PLATFORM_ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CompanyStatus,
  ) {
    return this.companyService.updateStatus(id, status);
  }
}
