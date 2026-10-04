import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';
import { CreatePriceTierDto, UpdatePriceTierDto } from './dto/price-tier.dto';

@Controller('pricing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('tiers')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getTiers() {
    return this.pricingService.getTiers();
  }

  @Post('tiers')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  createTier(@Body() data: CreatePriceTierDto) {
    return this.pricingService.createTier(data);
  }

  @Patch('tiers/:id')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  updateTier(@Param('id') id: string, @Body() data: UpdatePriceTierDto) {
    return this.pricingService.updateTier(id, data);
  }

  @Get('calculate')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async calculateDishPrice(@Query('dishId') dishId: string, @Query('tierId') tierId?: string) {
    return this.pricingService.calculateDishPrice(dishId, tierId);
  }

  @Get('missing')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getMissingPrices(@Query('tierId') tierId?: string) {
    return this.pricingService.getMissingPrices(tierId);
  }

  @Get('overrides')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async getTierPriceOverrides(@Query('tierId') tierId: string) {
    return this.pricingService.getTierPriceOverrides(tierId);
  }

  @Post('dish-price')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async upsertDishPriceOverride(@Body() body: { tierId: string; dishId: string; priceMinor: number }) {
    return this.pricingService.upsertDishPriceOverride(body.tierId, body.dishId, Number(body.priceMinor));
  }

  @Post('option-price')
  @RequirePermissions(Permission.CATALOGUE_MANAGE)
  async upsertOptionPriceOverride(@Body() body: { tierId: string; optionId: string; priceMinor: number }) {
    return this.pricingService.upsertOptionPriceOverride(body.tierId, body.optionId, Number(body.priceMinor));
  }
}
