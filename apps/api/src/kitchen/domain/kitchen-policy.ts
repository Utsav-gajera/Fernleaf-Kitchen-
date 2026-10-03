import { KitchenUnitStatus, OrderStatus } from '@prisma/client';

export class KitchenPolicy {
  assertOrderConfirmed(status: OrderStatus): void {
    if (status !== OrderStatus.CONFIRMED) {
      throw new Error('Kitchen units can only be changed for confirmed orders.');
    }
  }

  canForceComplete(isAdmin: boolean): boolean {
    return isAdmin;
  }

  canTransition(status: KitchenUnitStatus, target: KitchenUnitStatus): boolean {
    return (
      (status === KitchenUnitStatus.PENDING && target === KitchenUnitStatus.STARTED) ||
      (status === KitchenUnitStatus.STARTED && target === KitchenUnitStatus.DONE) ||
      (status === KitchenUnitStatus.PENDING && target === KitchenUnitStatus.DONE)
    );
  }
}
