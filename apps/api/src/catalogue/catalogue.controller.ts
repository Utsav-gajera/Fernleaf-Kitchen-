import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get()
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findAllDishes() {
    return this.catalogueService.findAllDishes();
  }

  @Get(':id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async findOneDish(@Param('id') id: string) {
    return this.catalogueService.findOneDish(id);
  }

  @Post()
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async createDish(@Body() data: Record<string, unknown>) {
    return this.catalogueService.createDish(data);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async updateDish(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.catalogueService.updateDish(id, data);
  }
}
