import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MenuService } from './menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

test('employee menu excludes hidden categories and dishes and resolves option pricing', async () => {
  const prisma = {
    employee: {
      findUnique: async () => ({
        id: 'emp-1',
        name: 'Ada',
        email: 'ada@fernleaf.test',
        company: {
          id: 'company-1',
          name: 'FernLeaf',
          priceTierId: 'tier-1',
          hiddenCategories: [],
          hiddenDishes: [{ dishId: 'dish-hidden' }],
        },
      }),
    },
    categoryDish: {
      findMany: async () => [
        {
          id: 'cd-1',
          category: {
            id: 'cat-1',
            name: 'Mains',
            displayOrder: 1,
            isActive: true,
            isSecret: false,
          },
          dish: {
            id: 'dish-visible',
            name: 'Chicken Bowl',
            isActive: true,
            minQuantity: 1,
            costPriceMinor: 1200,
            optionGroups: [
              {
                id: 'dog-1',
                displayOrder: 0,
                isRequiredOverride: null,
                optionGroup: {
                  id: 'og-1',
                  name: 'Bread Choice',
                  isRequired: true,
                  options: [
                    {
                      id: 'group-opt-1',
                      displayOrder: 0,
                      extraChargeMinor: 50,
                      option: {
                        id: 'opt-1',
                        name: 'Rice',
                        isActive: true,
                        costPriceMinor: 100,
                      },
                    },
                  ],
                },
              },
            ],
            allergies: [],
            dietaryTags: [],
          },
        },
      ],
    },
  };

  const pricingService = {
    calculateDishPrice: async () => ({ available: true, priceMinor: 2500, price: 25 }),
    calculateOptionPrice: async () => ({ available: true, priceMinor: 200, price: 2 }),
  };

  const service = new MenuService(
    prisma as unknown as PrismaService,
    pricingService as unknown as PricingService,
  );
  const result = await service.getMenuForEmployee('emp-1');

  assert.equal(result.menu.categories.length, 1);
  assert.equal(result.menu.categories[0].id, 'cat-1');
  assert.equal(result.menu.categories[0].dishes[0].id, 'dish-visible');
  assert.equal(result.menu.categories[0].dishes[0].priceMinor, 2500);
  assert.equal(result.menu.categories[0].dishes[0].optionGroups[0].options[0].priceMinor, 200);
});

test('secret categories are not returned to employees', async () => {
  const prisma = {
    employee: {
      findUnique: async () => ({
        id: 'emp-2',
        company: {
          id: 'company-2',
          priceTierId: 'tier-2',
          hiddenCategories: [],
          hiddenDishes: [],
        },
      }),
    },
    categoryDish: {
      findMany: async () => [
        {
          id: 'cd-1',
          category: {
            id: 'cat-secret',
            name: 'Secret',
            isActive: true,
            isSecret: true,
            displayOrder: 1,
          },
          dish: {
            id: 'dish-secret',
            name: 'Secret Dish',
            isActive: true,
            costPriceMinor: 1000,
            minQuantity: 1,
            optionGroups: [],
            allergies: [],
            dietaryTags: [],
          },
        },
      ],
    },
  };

  const pricingService = {
    calculateDishPrice: async () => ({ available: true, priceMinor: 1500, price: 15 }),
    calculateOptionPrice: async () => ({ available: true, priceMinor: 0, price: 0 }),
  };

  const service = new MenuService(
    prisma as unknown as PrismaService,
    pricingService as unknown as PricingService,
  );
  const result = await service.getMenuForEmployee('emp-2');

  assert.equal(result.menu.categories.length, 0);
});

test('a secret category is available only when explicitly addressed', async () => {
  const prisma = {
    employee: {
      findUnique: async () => ({
        id: 'emp-3',
        name: 'Lin',
        email: 'lin@fernleaf.test',
        company: {
          id: 'company-3',
          name: 'FernLeaf',
          priceTierId: 'tier-3',
          hiddenCategories: [],
          hiddenDishes: [],
        },
      }),
    },
    categoryDish: {
      findMany: async () => [{
        id: 'cd-secret',
        category: { id: 'cat-secret', name: 'Direct Offers', isActive: true, isSecret: true, displayOrder: 1 },
        dish: {
          id: 'dish-secret', name: 'Direct Dish', isActive: true, costPriceMinor: 1000,
          minQuantity: 1, optionGroups: [], allergies: [], dietaryTags: [],
        },
      }],
    },
  };
  const pricingService = {
    calculateDishPrice: async () => ({ available: true, priceMinor: 1500, price: 15 }),
    calculateOptionPrice: async () => ({ available: true, priceMinor: 0, price: 0 }),
  };
  const service = new MenuService(
    prisma as unknown as PrismaService,
    pricingService as unknown as PricingService,
  );

  const result = await service.getMenuForEmployee('emp-3', 'cat-secret');

  assert.equal(result.menu.categories.length, 1);
  assert.equal(result.menu.categories[0].id, 'cat-secret');
});
