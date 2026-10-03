import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('staff')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @RequirePermissions(Permission.STAFF_MANAGE)
  async findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.STAFF_MANAGE)
  async findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.STAFF_MANAGE)
  async create(@Body() data: Record<string, unknown>) {
    return this.staffService.create(data);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.STAFF_MANAGE)
  async updateRole(@Param('id') id: string, @Body('role') role: string) {
    return this.staffService.updateRole(id, role);
  }
}
