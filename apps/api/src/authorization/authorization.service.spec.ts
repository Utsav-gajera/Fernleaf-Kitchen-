import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthorizationService } from './authorization.service';
import { Permission, Role } from '@project/shared';

const authorizationService = new AuthorizationService();

test('ADMIN has all permissions', () => {
  const permissions = authorizationService.getPermissionsForRole(Role.ADMIN);

  assert.ok(permissions.includes(Permission.STAFF_MANAGE));
  assert.ok(permissions.includes(Permission.CATALOGUE_MANAGE));
  assert.ok(permissions.includes(Permission.COMPANY_MANAGE));
  assert.ok(permissions.includes(Permission.EMPLOYEE_MANAGE));
  assert.ok(permissions.includes(Permission.ORDER_CREATE));
  assert.ok(permissions.includes(Permission.KITCHEN_UPDATE));
  assert.ok(permissions.includes(Permission.DISPATCH_UPDATE));
  assert.ok(permissions.includes(Permission.BILLING_MANAGE));
  assert.ok(permissions.includes(Permission.SETTINGS_MANAGE));
});

test('KITCHEN gets kitchen and read permissions only', () => {
  const permissions = authorizationService.getPermissionsForRole(Role.KITCHEN);

  assert.ok(permissions.includes(Permission.KITCHEN_VIEW));
  assert.ok(permissions.includes(Permission.KITCHEN_UPDATE));
  assert.ok(permissions.includes(Permission.ORDER_VIEW));
  assert.ok(permissions.includes(Permission.CATALOGUE_MANAGE));

  assert.equal(authorizationService.hasPermission(Role.KITCHEN, Permission.DISPATCH_UPDATE), false);
  assert.equal(authorizationService.hasPermission(Role.KITCHEN, Permission.SETTINGS_MANAGE), false);
});

test('DISPATCH gets dispatch permissions and order visibility', () => {
  const permissions = authorizationService.getPermissionsForRole(Role.DISPATCH);

  assert.ok(permissions.includes(Permission.DISPATCH_VIEW));
  assert.ok(permissions.includes(Permission.DISPATCH_UPDATE));
  assert.ok(permissions.includes(Permission.ORDER_VIEW));
  assert.ok(permissions.includes(Permission.ORDER_CREATE));

  assert.equal(authorizationService.hasPermission(Role.DISPATCH, Permission.KITCHEN_UPDATE), false);
  assert.equal(authorizationService.hasPermission(Role.DISPATCH, Permission.SETTINGS_MANAGE), false);
});

test('DRIVER gets only driver capabilities', () => {
  const permissions = authorizationService.getPermissionsForRole(Role.DRIVER);

  assert.ok(permissions.includes(Permission.DRIVER_VIEW_OWN));
  assert.ok(permissions.includes(Permission.DRIVER_DELIVER));
  assert.ok(permissions.includes(Permission.ORDER_VIEW));

  assert.equal(authorizationService.hasPermission(Role.DRIVER, Permission.KITCHEN_VIEW), false);
  assert.equal(authorizationService.hasPermission(Role.DRIVER, Permission.DISPATCH_UPDATE), false);
  assert.equal(authorizationService.hasPermission(Role.DRIVER, Permission.SETTINGS_MANAGE), false);
});
