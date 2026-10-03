import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PricingResolver, roundUpToFive } from './pricing.resolver';

const resolver = new PricingResolver();

test('company tier wins over default', () => {
  const companyTier = { id: 'enterprise', name: 'Enterprise', markupPercent: 15, multiplier: null };
  const resolved = resolver.resolve({
    itemId: 'dish-1',
    itemType: 'dish',
    baseCostMinor: 100,
    derivedBaseMinor: 200,
    tier: companyTier,
  });

  assert.equal(resolved, 230);
});

test('default fallback works', () => {
  const defaultTier = { id: 'standard', name: 'Standard', isDefault: true, multiplier: 2.4 };
  const resolved = resolver.resolve({
    itemId: 'dish-2',
    itemType: 'dish',
    baseCostMinor: 100,
    tier: defaultTier,
  });

  assert.equal(resolved, 240);
});

test('override wins over derived value', () => {
  const tier = { id: 'partner', name: 'Partner', markupPercent: 15, multiplier: null };
  const resolved = resolver.resolve({
    itemId: 'dish-3',
    itemType: 'dish',
    baseCostMinor: 100,
    derivedBaseMinor: 200,
    overridePriceMinor: 180,
    tier,
  });

  assert.equal(resolved, 180);
});

test('missing price returns unavailable', () => {
  const resolved = resolver.resolve({
    itemId: 'dish-4',
    itemType: 'dish',
    baseCostMinor: null,
    tier: { id: 'standard', name: 'Standard', multiplier: 2.4 },
  });

  assert.equal(resolved, null);
});

test('cost multiplier works', () => {
  const resolved = resolver.resolve({
    itemId: 'dish-5',
    itemType: 'dish',
    baseCostMinor: 210,
    tier: { id: 'partner', name: 'Partner', multiplier: 2.4 },
  });

  assert.equal(resolved, 505);
});

test('tier percentage works', () => {
  const resolved = resolver.resolve({
    itemId: 'dish-6',
    itemType: 'dish',
    baseCostMinor: 200,
    tier: { id: 'enterprise', name: 'Enterprise', markupPercent: 15 },
  });

  assert.equal(resolved, 230);
});

test('zero cost is valid and should resolve to zero', () => {
  const resolved = resolver.resolve({
    itemId: 'dish-zero',
    itemType: 'dish',
    baseCostMinor: 0,
    tier: { id: 'standard', name: 'Standard', multiplier: 2.4 },
  });

  assert.equal(resolved, 0);
});

test('211 -> 215 rounding behavior', () => {
  assert.equal(roundUpToFive(211), 215);
});
