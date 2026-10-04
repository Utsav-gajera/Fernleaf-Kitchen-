import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogueService } from './catalogue.service';

test('rejects a duplicate dish SKU before writing the dish', async () => {
  let createCalled = false;
  const service = new CatalogueService({
    dish: {
      findUnique: async () => ({ id: 'existing-dish' }),
      create: async () => {
        createCalled = true;
        return { id: 'new-dish' };
      },
    },
  } as never);

  await assert.rejects(
    () => service.createDish({ name: 'New dish', sku: 'DISH-001' }),
    /Dish SKU 'DISH-001' already exists/,
  );
  assert.equal(createCalled, false);
});

test('rejects a blank SKU when updating a dish', async () => {
  const service = new CatalogueService({
    dish: {
      findUnique: async () => ({ id: 'dish-1' }),
    },
  } as never);

  await assert.rejects(
    () => service.updateDish('dish-1', { name: 'Updated dish', sku: '   ' }),
    /Dish SKU must not be blank/,
  );
});

test('creates a dish and its relations in the same transaction', async () => {
  const calls: string[] = [];
  let lookups = 0;
  const transaction = {
    dish: {
      create: async () => {
        calls.push('dish');
        return { id: 'dish-1' };
      },
    },
    dishAllergen: {
      deleteMany: async () => { calls.push('delete allergens'); },
      createMany: async () => { calls.push('create allergens'); },
    },
  };
  const service = new CatalogueService({
    dish: {
      findUnique: async () => {
        lookups += 1;
        return lookups === 1 ? null : { id: 'dish-1' };
      },
    },
    allergen: { count: async () => 1 },
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
  } as never);

  await service.createDish({ name: 'New dish', sku: 'DISH-001', allergenIds: ['allergen-1'] });
  assert.deepEqual(calls, ['dish', 'delete allergens', 'create allergens']);
});

test('rejects invalid option-group options before creating the group', async () => {
  let created = false;
  const service = new CatalogueService({
    option: { count: async () => 0 },
    optionGroup: { create: async () => { created = true; } },
  } as never);

  await assert.rejects(
    () => service.createOptionGroup({ name: 'Sides', optionIds: [{ optionId: 'missing' }] }),
    /One or more option-group options do not exist/,
  );
  assert.equal(created, false);
});
