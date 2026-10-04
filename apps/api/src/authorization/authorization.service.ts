import { Injectable } from '@nestjs/common';
import { Permission, Role } from '@project/shared';

const ROLE_TO_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: [
    Permission.STAFF_MANAGE,
    Permission.CATALOGUE_MANAGE,
    Permission.COMPANY_MANAGE,
    Permission.EMPLOYEE_MANAGE,
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW,
    Permission.ORDER_OVERRIDE,
    Permission.KITCHEN_VIEW,
    Permission.KITCHEN_UPDATE,
    Permission.DISPATCH_VIEW,
    Permission.DISPATCH_UPDATE,
    Permission.BILLING_MANAGE,
    Permission.SETTINGS_MANAGE,
  ],
  [Role.KITCHEN]: [
    Permission.ORDER_VIEW,
    Permission.KITCHEN_VIEW,
    Permission.KITCHEN_UPDATE,
  ],
  [Role.DISPATCH]: [
    Permission.ORDER_VIEW,
    Permission.DISPATCH_VIEW,
    Permission.DISPATCH_UPDATE,
  ],
  [Role.DRIVER]: [
    Permission.DRIVER_VIEW_OWN,
    Permission.DRIVER_DELIVER,
  ],
};

@Injectable()
export class AuthorizationService {
  getRoles(): string[] {
    return Object.values(Role);
  }

  getPermissionsForRole(role: Role): Permission[] {
    return ROLE_TO_PERMISSIONS[role] ?? [];
  }

  hasPermission(userRole: Role, permission: Permission): boolean {
    return this.getPermissionsForRole(userRole).includes(permission);
  }
}
