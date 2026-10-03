import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogueService } from './catalogue.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get()
  @Roles(Role.ADMIN, Role.KITCHEN)
  async findAllDishes() {
    return this.catalogueService.findAllDishes();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.KITCHEN)
  async findOneDish(@Param('id') id: string) {
    return this.catalogueService.findOneDish(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async createDish(@Body() data: Record<string, unknown>) {
    return this.catalogueService.createDish(data);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async updateDish(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.catalogueService.updateDish(id, data);
  }
}
