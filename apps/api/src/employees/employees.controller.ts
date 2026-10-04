import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@project/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { MenuService } from '../menu/menu.service';
import { CreateEmployeeDto, EmployeeListQueryDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly menuService: MenuService,
  ) {}

  @Get()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async findAll(@Query() query: EmployeeListQueryDto) {
    return this.employeesService.findAll(query.page, query.limit);
  }

  @Get(':id/menu')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getEmployeeMenu(@Param('id') id: string) {
    return this.menuService.getMenuForEmployee(id);
  }

  @Get(':id/menu/preview')
  @RequirePermissions(Permission.ORDER_CREATE)
  async previewEmployeeMenu(@Param('id') id: string) {
    return this.menuService.getMenuForEmployee(id);
  }

  @Get(':id/menu/categories/:categoryId')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getEmployeeMenuCategory(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menuService.getMenuForEmployee(id, categoryId);
  }

  @Get(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async create(@Body() data: CreateEmployeeDto) {
    return this.employeesService.create(data);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EMPLOYEE_MANAGE)
  async update(@Param('id') id: string, @Body() data: UpdateEmployeeDto) {
    return this.employeesService.update(id, data);
  }
}
