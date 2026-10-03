import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('preview')
  async getMenuForEmployee(@Query('companyId') companyId?: string) {
    return this.menuService.getMenuForEmployee(companyId);
  }

  @Get('categories')
  async getCategories() {
    return this.menuService.getCategories();
  }
}
