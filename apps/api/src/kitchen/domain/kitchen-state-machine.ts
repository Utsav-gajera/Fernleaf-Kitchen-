import { KitchenUnitStatus } from '@prisma/client';

export class KitchenStateMachine {
  assertTransition(from: KitchenUnitStatus, to: KitchenUnitStatus): void {
    if (
      (from === KitchenUnitStatus.PENDING && to === KitchenUnitStatus.STARTED) ||
      (from === KitchenUnitStatus.STARTED && to === KitchenUnitStatus.DONE) ||
      (from === KitchenUnitStatus.PENDING && to === KitchenUnitStatus.DONE)
    ) {
      return;
    }
    throw new Error(`Invalid kitchen unit transition from ${from} to ${to}`);
  }
}
