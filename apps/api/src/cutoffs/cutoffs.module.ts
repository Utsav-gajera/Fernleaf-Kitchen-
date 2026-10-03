import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CutoffsController } from './cutoffs.controller';

@Module({
  imports: [OrdersModule],
  controllers: [CutoffsController],
})
export class CutoffsModule {}
