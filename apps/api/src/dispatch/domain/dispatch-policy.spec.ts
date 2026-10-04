import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { DropStatus } from '@prisma/client';
import { DispatchPolicy } from './dispatch-policy';

test('requires a driver before a drop can go out for delivery', () => {
  const policy = new DispatchPolicy();

  assert.throws(() => policy.assertDriverAssigned(null), /driver must be assigned/i);
  assert.doesNotThrow(() => policy.assertDriverAssigned('driver-1'));
});

test('allows assigning a driver until a drop is out for delivery', () => {
  const policy = new DispatchPolicy();

  assert.equal(policy.canAssignDriver(DropStatus.KITCHEN_READY), true);
  assert.equal(policy.canAssignDriver(DropStatus.DISPATCH_READY), true);
  assert.equal(policy.canAssignDriver(DropStatus.OUT_FOR_DELIVERY), false);
});
