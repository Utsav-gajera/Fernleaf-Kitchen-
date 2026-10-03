import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() data: Record<string, unknown>) {
    return this.staffService.create(data);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(@Param('id') id: string, @Body('role') role: string) {
    return this.staffService.updateRole(id, role);
  }
}
