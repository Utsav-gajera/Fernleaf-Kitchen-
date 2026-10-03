import { DropStatus } from '@prisma/client';

export class DispatchPolicy {
  assertDriverAssigned(driverId: string | null): void {
    if (!driverId) throw new Error('A driver must be assigned before dispatch.');
  }

  canAssignDriver(status: DropStatus): boolean {
    return status === DropStatus.KITCHEN_READY;
  }
}
