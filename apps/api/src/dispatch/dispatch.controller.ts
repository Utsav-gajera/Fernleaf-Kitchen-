import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Permission } from '@project/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { DispatchService } from './dispatch.service';
import { DeliverDropDto } from './dto/deliver-drop.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('dispatch-board')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  getDrops(@Query('date') date?: string) {
    return this.dispatchService.getDrops(date);
  }

  @Get('dispatch-drivers')
  @RequirePermissions(Permission.DISPATCH_VIEW)
  getDrivers() {
    return this.dispatchService.getDrivers();
  }

  @Post('drops/:id/assign-driver')
  @RequirePermissions(Permission.DISPATCH_UPDATE)
  assignDriver(@Param('id') dropId: string, @Body('driverId') driverId: string) {
    return this.dispatchService.assignDriver(dropId, driverId);
  }

  @Post('drops/:id/dispatch-ready')
  @RequirePermissions(Permission.DISPATCH_UPDATE)
  markDispatchReady(@Param('id') dropId: string) {
    return this.dispatchService.markDispatchReady(dropId);
  }

  @Post('drops/:id/out-for-delivery')
  @RequirePermissions(Permission.DISPATCH_UPDATE)
  markOutForDelivery(@Param('id') dropId: string) {
    return this.dispatchService.markOutForDelivery(dropId);
  }

  @Post('drops/:id/delivered')
  @RequirePermissions(Permission.DISPATCH_UPDATE)
  markDelivered(@Param('id') dropId: string) {
    return this.dispatchService.markDelivered(dropId);
  }

  @Get('driver/drops/today')
  @RequirePermissions(Permission.DRIVER_VIEW_OWN)
  getDriverDropsToday(@Request() request: { user: { id: string } }) {
    return this.dispatchService.getDriverDropsToday(request.user.id);
  }

  @Post('driver/drops/:id/deliver')
  @RequirePermissions(Permission.DRIVER_DELIVER)
  deliverDrop(
    @Param('id') dropId: string,
    @Body() data: DeliverDropDto,
    @Request() request: { user: { id: string } },
  ) {
    return this.dispatchService.deliverDrop(dropId, request.user.id, data);
  }
}
