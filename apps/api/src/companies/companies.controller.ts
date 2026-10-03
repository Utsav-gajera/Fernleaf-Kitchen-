import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() data: Record<string, unknown>) {
    return this.companiesService.create(data);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.companiesService.update(id, data);
  }
}
