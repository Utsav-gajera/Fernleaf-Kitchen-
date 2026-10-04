import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CombinationErrorCode,
  CombinationValidationError,
  CombinationValidator,
} from './combination-validator';

const validator = new CombinationValidator();
const optionGroups = [
  { id: 'bread', isRequired: true, optionIds: ['rice', 'bread'] },
  { id: 'sauce', isRequired: false, optionIds: ['mild', 'hot'] },
];

function assertCode(run: () => void, code: CombinationErrorCode) {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof CombinationValidationError);
    assert.equal(error.code, code);
    return true;
  });
}

test('accepts combinations whose quantities exactly cover the line', () => {
  assert.doesNotThrow(() =>
    validator.validate({
      lineQuantity: 10,
      optionGroups,
      combinations: [
        { quantity: 6, selections: [{ optionGroupId: 'bread', optionId: 'rice' }] },
        {
          quantity: 4,
          selections: [
            { optionGroupId: 'bread', optionId: 'bread' },
            { optionGroupId: 'sauce', optionId: 'hot' },
          ],
        },
      ],
    }),
  );
});

test('rejects combination quantities that do not equal the line quantity', () => {
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 10,
        optionGroups,
        combinations: [
          { quantity: 6, selections: [{ optionGroupId: 'bread', optionId: 'rice' }] },
        ],
      }),
    CombinationErrorCode.COMBINATION_QUANTITY_MISMATCH,
  );
});

test('rejects non-positive line and combination quantities', () => {
  assertCode(
    () => validator.validate({ lineQuantity: 0, optionGroups, combinations: [] }),
    CombinationErrorCode.INVALID_LINE_QUANTITY,
  );
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 1,
        optionGroups,
        combinations: [{ quantity: 0, selections: [] }],
      }),
    CombinationErrorCode.INVALID_COMBINATION_QUANTITY,
  );
});

test('requires every required group for every combination', () => {
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 1,
        optionGroups,
        combinations: [{ quantity: 1, selections: [] }],
      }),
    CombinationErrorCode.REQUIRED_OPTION_GROUP_MISSING,
  );
});

test('allows optional groups to be omitted', () => {
  assert.doesNotThrow(() =>
    validator.validate({
      lineQuantity: 1,
      optionGroups,
      combinations: [
        { quantity: 1, selections: [{ optionGroupId: 'bread', optionId: 'rice' }] },
      ],
    }),
  );
});

test('rejects an option that does not belong to its group', () => {
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 1,
        optionGroups,
        combinations: [
          { quantity: 1, selections: [{ optionGroupId: 'bread', optionId: 'hot' }] },
        ],
      }),
    CombinationErrorCode.INVALID_OPTION_FOR_GROUP,
  );
});

test('rejects duplicate selections from the same group', () => {
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 1,
        optionGroups,
        combinations: [
          {
            quantity: 1,
            selections: [
              { optionGroupId: 'bread', optionId: 'rice' },
              { optionGroupId: 'bread', optionId: 'bread' },
            ],
          },
        ],
      }),
    CombinationErrorCode.DUPLICATE_GROUP_SELECTION,
  );
});

test('does not treat the incomplete legacy portion flag as multiple option selections', () => {
  assertCode(
    () =>
    validator.validate({
      lineQuantity: 1,
      optionGroups: [
        { id: 'toppings', isRequired: true, optionIds: ['cheese', 'herbs'] },
      ],
      combinations: [
        {
          quantity: 1,
          selections: [
            { optionGroupId: 'toppings', optionId: 'cheese' },
            { optionGroupId: 'toppings', optionId: 'herbs' },
          ],
        },
      ],
    }),
    CombinationErrorCode.DUPLICATE_GROUP_SELECTION,
  );
});

test('enforces the configured minimum order quantity', () => {
  assertCode(
    () =>
      validator.validate({
        lineQuantity: 2,
        minimumOrderQuantity: 5,
        optionGroups,
        combinations: [
          { quantity: 2, selections: [{ optionGroupId: 'bread', optionId: 'rice' }] },
        ],
      }),
    CombinationErrorCode.MINIMUM_ORDER_QUANTITY_NOT_MET,
  );
});

test('accepts a line at its minimum order quantity', () => {
  assert.doesNotThrow(() =>
    validator.validate({
      lineQuantity: 5,
      minimumOrderQuantity: 5,
      optionGroups,
      combinations: [
        { quantity: 5, selections: [{ optionGroupId: 'bread', optionId: 'rice' }] },
      ],
    }),
  );
});
