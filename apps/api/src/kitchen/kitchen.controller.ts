import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { KitchenService } from './kitchen.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('kitchen')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class KitchenController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('board')
  @RequirePermissions(Permission.KITCHEN_VIEW)
  async getPrepBoard(@Query('date') date?: string, @Query('station') station?: string) {
    return this.kitchenService.getPrepBoard(date, station);
  }

  @Get('stations')
  @RequirePermissions(Permission.KITCHEN_VIEW)
  getStations() {
    return this.kitchenService.getStations();
  }

  @Patch('units/:id/status')
  @RequirePermissions(Permission.KITCHEN_UPDATE)
  async updateUnitStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.kitchenService.updateUnitStatus(id, status);
  }

}

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class KitchenBoardController {
  constructor(private readonly kitchenService: KitchenService) {}

  @Get('kitchen-board')
  @RequirePermissions(Permission.KITCHEN_VIEW)
  getKitchenBoard(@Query('date') date?: string, @Query('station') station?: string) {
    return this.kitchenService.getBoard(date, station);
  }
}
