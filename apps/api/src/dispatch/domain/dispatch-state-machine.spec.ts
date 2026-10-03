import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { DropStatus } from '@prisma/client';
import { DispatchStateMachine } from './dispatch-state-machine';

test('allows the dispatch lifecycle transitions', () => {
  const machine = new DispatchStateMachine();
  assert.doesNotThrow(() => machine.assertTransition(DropStatus.KITCHEN_READY, DropStatus.DISPATCH_READY));
  assert.doesNotThrow(() => machine.assertTransition(DropStatus.DISPATCH_READY, DropStatus.OUT_FOR_DELIVERY));
  assert.doesNotThrow(() => machine.assertTransition(DropStatus.OUT_FOR_DELIVERY, DropStatus.DELIVERED));
});

test('rejects repeated or skipped dispatch transitions', () => {
  const machine = new DispatchStateMachine();
  assert.throws(() => machine.assertTransition(DropStatus.KITCHEN_READY, DropStatus.OUT_FOR_DELIVERY), /Invalid drop transition/);
  assert.throws(() => machine.assertTransition(DropStatus.DISPATCH_READY, DropStatus.DISPATCH_READY), /Invalid drop transition/);
});
