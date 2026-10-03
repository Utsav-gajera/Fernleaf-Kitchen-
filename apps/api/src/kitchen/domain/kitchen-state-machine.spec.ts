import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { KitchenUnitStatus } from '@prisma/client';
import { KitchenStateMachine } from './kitchen-state-machine';

test('allows the three supported kitchen transitions', () => {
  const machine = new KitchenStateMachine();
  assert.doesNotThrow(() => machine.assertTransition(KitchenUnitStatus.PENDING, KitchenUnitStatus.STARTED));
  assert.doesNotThrow(() => machine.assertTransition(KitchenUnitStatus.STARTED, KitchenUnitStatus.DONE));
  assert.doesNotThrow(() => machine.assertTransition(KitchenUnitStatus.PENDING, KitchenUnitStatus.DONE));
});

test('rejects reopening a completed kitchen unit', () => {
  const machine = new KitchenStateMachine();
  assert.throws(
    () => machine.assertTransition(KitchenUnitStatus.DONE, KitchenUnitStatus.STARTED),
    /Invalid kitchen unit transition/,
  );
});
