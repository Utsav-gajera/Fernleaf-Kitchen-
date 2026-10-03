import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  @RequirePermissions(Permission.ORDER_VIEW)
  async getMenuForEmployee(@Query('companyId') companyId?: string) {
    return this.menuService.getMenuForEmployee(companyId);
  }

  @Get('categories')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getCategories() {
    return this.menuService.getCategories();
  }
}
