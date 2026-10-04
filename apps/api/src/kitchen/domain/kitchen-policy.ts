import { KitchenUnitStatus, OrderStatus } from '@prisma/client';

export class KitchenPolicy {
  assertOrderConfirmed(status: OrderStatus): void {
    if (status !== OrderStatus.CONFIRMED && status !== OrderStatus.KITCHEN_IN_PROGRESS) {
      throw new Error('Kitchen units can only be changed for confirmed orders.');
    }
  }

  canTransition(status: KitchenUnitStatus, target: KitchenUnitStatus): boolean {
    return (
      (status === KitchenUnitStatus.PENDING && target === KitchenUnitStatus.STARTED) ||
      (status === KitchenUnitStatus.STARTED && target === KitchenUnitStatus.DONE) ||
      (status === KitchenUnitStatus.PENDING && target === KitchenUnitStatus.DONE)
    );
  }
}
