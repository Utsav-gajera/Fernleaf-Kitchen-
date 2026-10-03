import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async create(@Body() data: Record<string, unknown>) {
    return this.employeesService.create(data);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.employeesService.update(id, data);
  }
}
