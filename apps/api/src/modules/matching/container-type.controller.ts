import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ContainerTypeService } from './container-type.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('containers')
@UseGuards(JwtAuthGuard)
export class ContainerTypeController {
  constructor(private readonly containerService: ContainerTypeService) {}

  @Get()
  async findAll() {
    return this.containerService.findAll(true);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.containerService.findById(id);
  }
}
