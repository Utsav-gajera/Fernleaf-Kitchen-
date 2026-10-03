import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('board')
  @Roles(Role.ADMIN, Role.KITCHEN)
  async getPrepBoard(@Query('date') date?: string) {
    return this.kitchenService.getPrepBoard(date);
  }

  @Patch('units/:id/status')
  @Roles(Role.ADMIN, Role.KITCHEN)
  async updateUnitStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.kitchenService.updateUnitStatus(id, status);
  }
}
