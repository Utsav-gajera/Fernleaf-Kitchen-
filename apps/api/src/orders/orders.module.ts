import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MenuModule } from '../menu/menu.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CutoffProcessor } from './cutoff-processor.service';
import { KitchenModule } from '../kitchen/kitchen.module';

@Module({
  imports: [AuthorizationModule, MenuModule, PricingModule, KitchenModule],
  controllers: [OrdersController],
  providers: [OrdersService, CutoffProcessor],
  exports: [OrdersService, CutoffProcessor],
})
export class OrdersModule {}
