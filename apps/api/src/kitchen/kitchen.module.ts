import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { KitchenBoardController, KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [KitchenController, KitchenBoardController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}
