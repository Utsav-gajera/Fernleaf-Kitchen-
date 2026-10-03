import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll() {
    return this.employeesService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() data: Record<string, unknown>) {
    return this.employeesService.create(data);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.employeesService.update(id, data);
  }
}
