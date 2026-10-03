import { OrderStatus } from '@prisma/client';

export class OrderStateMachine {
  assertCanPlace(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT) {
      throw new Error(`Order cannot be placed from ${status}`);
    }
  }

  assertCanCancel(status: OrderStatus): void {
    if (status !== OrderStatus.DRAFT && status !== OrderStatus.PLACED) {
      throw new Error(`Order cannot be cancelled from ${status}`);
    }
  }

  assertCanTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === OrderStatus.DRAFT && to === OrderStatus.PLACED) return;
    if (from === OrderStatus.PLACED && to === OrderStatus.CONFIRMED) return;
    if (
      (from === OrderStatus.DRAFT || from === OrderStatus.PLACED) &&
      to === OrderStatus.CANCELLED
    ) return;
    throw new Error(`Invalid order transition from ${from} to ${to}`);
  }
}
