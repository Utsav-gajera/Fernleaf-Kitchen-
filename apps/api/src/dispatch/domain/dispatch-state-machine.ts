import { DropStatus } from '@prisma/client';

export class DispatchStateMachine {
  assertTransition(from: DropStatus, to: DropStatus): void {
    if (
      (from === DropStatus.KITCHEN_READY && to === DropStatus.DISPATCH_READY) ||
      (from === DropStatus.DISPATCH_READY && to === DropStatus.OUT_FOR_DELIVERY) ||
      (from === DropStatus.OUT_FOR_DELIVERY && to === DropStatus.DELIVERED)
    ) {
      return;
    }
    throw new Error(`Invalid drop transition from ${from} to ${to}`);
  }
}
