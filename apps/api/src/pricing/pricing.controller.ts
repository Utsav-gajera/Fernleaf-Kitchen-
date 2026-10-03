import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('pricing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getTiers() {
    return this.pricingService.getTiers();
  }

  @Get('calculate')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async calculateDishPrice(@Query('dishId') dishId: string, @Query('tierId') tierId?: string) {
    return this.pricingService.calculateDishPrice(dishId, tierId);
  }
}
