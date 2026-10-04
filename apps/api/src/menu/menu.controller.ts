import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('menu')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('preview')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getMenuPreview(@Query('employeeId') employeeId: string) {
    return this.menuService.getMenuForEmployee(employeeId);
  }

  @Get('employee/:employeeId')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getEmployeeMenu(@Param('employeeId') employeeId: string) {
    return this.menuService.getMenuForEmployee(employeeId);
  }

  @Get('employee/:employeeId/categories/:categoryId')
  @RequirePermissions(Permission.ORDER_CREATE)
  async getEmployeeMenuCategory(
    @Param('employeeId') employeeId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menuService.getMenuForEmployee(employeeId, categoryId);
  }

  @Get('categories')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getCategories() {
    return this.menuService.getCategories();
  }
}
