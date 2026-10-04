import { OrderStatus } from '@prisma/client';

export class OrderPolicy {
  canEdit(status: OrderStatus, afterCutoff: boolean, hasOverridePermission: boolean): boolean {
    if (hasOverridePermission) return status === OrderStatus.DRAFT || status === OrderStatus.PLACED;
    return !afterCutoff && (status === OrderStatus.DRAFT || status === OrderStatus.PLACED);
  }

  canCancel(status: OrderStatus, afterCutoff: boolean, hasOverridePermission: boolean): boolean {
    if (hasOverridePermission) {
      return !([
        OrderStatus.DISPATCH_READY,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
      ] as OrderStatus[]).includes(status);
    }
    return !afterCutoff && (status === OrderStatus.DRAFT || status === OrderStatus.PLACED);
  }

  canOverrideDelivery(status: OrderStatus, hasOverridePermission: boolean): boolean {
    return hasOverridePermission && ([
      OrderStatus.CONFIRMED,
      OrderStatus.KITCHEN_IN_PROGRESS,
      OrderStatus.KITCHEN_READY,
    ] as OrderStatus[]).includes(status);
  }

}
