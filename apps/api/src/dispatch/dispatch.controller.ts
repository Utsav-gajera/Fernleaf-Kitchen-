import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('dispatch')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('drops')
  @Roles(Role.ADMIN, Role.DISPATCH)
  async getDrops(@Query('date') date?: string) {
    return this.dispatchService.getDrops(date);
  }

  @Patch('drops/:id/assign')
  @Roles(Role.ADMIN, Role.DISPATCH)
  async assignDriver(@Param('id') dropId: string, @Body('driverId') driverId: string) {
    return this.dispatchService.assignDriver(dropId, driverId);
  }

  @Get('driver/:driverId')
  @Roles(Role.ADMIN, Role.DISPATCH, Role.DRIVER)
  async getDriverDeliveries(@Param('driverId') driverId: string) {
    return this.dispatchService.getDriverDeliveries(driverId);
  }
}
