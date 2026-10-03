import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { MenuModule } from '../menu/menu.module';
import { PricingModule } from '../pricing/pricing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CutoffProcessor } from './cutoff-processor.service';

@Module({
  imports: [AuthorizationModule, MenuModule, PricingModule],
  controllers: [OrdersController],
  providers: [OrdersService, CutoffProcessor],
  exports: [OrdersService, CutoffProcessor],
})
export class OrdersModule {}
