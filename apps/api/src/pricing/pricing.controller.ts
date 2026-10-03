import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  @Roles(Role.ADMIN)
  async getTiers() {
    return this.pricingService.getTiers();
  }

  @Get('calculate')
  @Roles(Role.ADMIN)
  async calculateDishPrice(@Query('dishId') dishId: string, @Query('tierId') tierId?: string) {
    return this.pricingService.calculateDishPrice(dishId, tierId);
  }
}
