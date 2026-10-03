import { OrderStatus } from '@prisma/client';

export class OrderPolicy {
  canEdit(status: OrderStatus, afterCutoff: boolean, isAdmin: boolean): boolean {
    if (isAdmin) return status === OrderStatus.DRAFT || status === OrderStatus.PLACED;
    return !afterCutoff && (status === OrderStatus.DRAFT || status === OrderStatus.PLACED);
  }

  canCancel(status: OrderStatus, afterCutoff: boolean, isAdmin: boolean): boolean {
    if (isAdmin) return status === OrderStatus.DRAFT || status === OrderStatus.PLACED;
    return !afterCutoff && (status === OrderStatus.DRAFT || status === OrderStatus.PLACED);
  }

  canOverride(isAdmin: boolean): boolean {
    return isAdmin;
  }
}
