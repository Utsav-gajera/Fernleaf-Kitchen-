import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async create(@Body() data: Record<string, unknown>) {
    return this.companiesService.create(data);
  }

  @Patch(':id')
  @RequirePermissions(Permission.COMPANY_MANAGE)
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.companiesService.update(id, data);
  }
}
