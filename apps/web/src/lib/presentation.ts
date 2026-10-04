const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  KITCHEN_IN_PROGRESS: 'Being prepared',
  KITCHEN_READY: 'Ready in kitchen',
  DISPATCH_READY: 'Ready to dispatch',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  PENDING: 'To prepare',
  STARTED: 'In progress',
  DONE: 'Completed',
};

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export function moneyFromMinor(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}
