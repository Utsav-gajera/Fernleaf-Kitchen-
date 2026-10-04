import type { Role } from '../types';

export type Capability =
  | 'ORDER_VIEW'
  | 'ORDER_CREATE'
  | 'ORDER_OVERRIDE'
  | 'KITCHEN_VIEW'
  | 'DISPATCH_VIEW'
  | 'DRIVER_VIEW_OWN'
  | 'BILLING_MANAGE'
  | 'SETTINGS_MANAGE'
  | 'STAFF_MANAGE'
  | 'ADMIN_WORKSPACE';

const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  ADMIN: ['ORDER_VIEW', 'ORDER_CREATE', 'ORDER_OVERRIDE', 'KITCHEN_VIEW', 'DISPATCH_VIEW', 'BILLING_MANAGE', 'SETTINGS_MANAGE', 'STAFF_MANAGE', 'ADMIN_WORKSPACE'],
  KITCHEN: ['ORDER_VIEW', 'KITCHEN_VIEW'],
  DISPATCH: ['ORDER_VIEW', 'DISPATCH_VIEW'],
  DRIVER: ['DRIVER_VIEW_OWN'],
};

export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; capability: Capability; id: string }> = [
  { href: '/dashboard/orders', label: 'Orders', capability: 'ORDER_VIEW', id: 'nav-orders-btn' },
  { href: '/dashboard/kitchen', label: 'Kitchen', capability: 'KITCHEN_VIEW', id: 'nav-kitchen-btn' },
  { href: '/dashboard/dispatch', label: 'Dispatch', capability: 'DISPATCH_VIEW', id: 'nav-dispatch-btn' },
  { href: '/dashboard/billing', label: 'Billing', capability: 'BILLING_MANAGE', id: 'nav-billing-btn' },
  { href: '/dashboard/settings', label: 'Settings', capability: 'SETTINGS_MANAGE', id: 'nav-settings-btn' },
  { href: '/dashboard/staff', label: 'Staff', capability: 'STAFF_MANAGE', id: 'nav-staff-btn' },
  { href: '/dashboard/driver', label: 'My deliveries', capability: 'DRIVER_VIEW_OWN', id: 'nav-driver-btn' },
];

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function requiredCapability(pathname: string): Capability | null {
  const adminRoots = ['/dashboard/companies', '/dashboard/employees', '/dashboard/catalogue', '/dashboard/pricing', '/dashboard/menu'];
  if (adminRoots.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return 'ADMIN_WORKSPACE';
  const item = NAV_ITEMS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  return item?.capability ?? null;
}
