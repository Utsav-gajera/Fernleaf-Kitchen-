import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('dispatch')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('drops')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  async getDrops(@Query('date') date?: string) {
    return this.dispatchService.getDrops(date);
  }

  @Patch('drops/:id/assign')
  @RequirePermissions(Permission.DISPATCH_UPDATE)
  async assignDriver(@Param('id') dropId: string, @Body('driverId') driverId: string) {
    return this.dispatchService.assignDriver(dropId, driverId);
  }

  @Get('driver/:driverId')
  @RequirePermissions(Permission.DRIVER_VIEW_OWN)
  async getDriverDeliveries(@Param('driverId') driverId: string) {
    return this.dispatchService.getDriverDeliveries(driverId);
  }
}
