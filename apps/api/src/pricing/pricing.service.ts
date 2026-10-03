import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingContext, PricingResolver } from './pricing.resolver';

type ItemType = 'dish' | 'option';

@Injectable()
export class PricingService {
  private readonly pricingResolver = new PricingResolver();

  constructor(private readonly prisma: PrismaService) {}

  private async findEffectiveTier(companyTierId?: string) {
    if (companyTierId) {
      return this.prisma.priceTier.findUnique({
        where: { id: companyTierId },
        select: {
          id: true,
          name: true,
          description: true,
          isDefault: true,
          derivedFromTierId: true,
          multiplier: true,
          markupPercent: true,
        },
      });
    }

    const defaultTiers = await this.prisma.priceTier.findMany({
      where: { isDefault: true },
      select: { id: true },
    });

    if (defaultTiers.length > 1) {
      throw new Error('Only one default price tier can exist at a time.');
    }

    if (defaultTiers.length === 0) {
      return null;
    }

    return this.prisma.priceTier.findUnique({
      where: { id: defaultTiers[0].id },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        derivedFromTierId: true,
        multiplier: true,
        markupPercent: true,
      },
    });
  }

  private async findExplicitPrice(itemType: ItemType, itemId: string, tierId: string) {
    if (itemType === 'dish') {
      return this.prisma.dishPrice.findUnique({
        where: { priceTierId_dishId: { priceTierId: tierId, dishId: itemId } },
        select: { priceMinor: true },
      });
    }

    return this.prisma.optionPrice.findUnique({
      where: { priceTierId_optionId: { priceTierId: tierId, optionId: itemId } },
      select: { priceMinor: true },
    });
  }

  private async findBaseCost(itemType: ItemType, itemId: string) {
    if (itemType === 'dish') {
      const item = await this.prisma.dish.findUnique({
        where: { id: itemId },
        select: { costPriceMinor: true },
      });
      return item?.costPriceMinor ?? null;
    }

    const item = await this.prisma.option.findUnique({
      where: { id: itemId },
      select: { costPriceMinor: true },
    });
    return item?.costPriceMinor ?? null;
  }

  private async resolveTierPriceForItem(itemType: ItemType, itemId: string, tierId: string, visited = new Set<string>()): Promise<number | null> {
    if (visited.has(tierId)) {
      return null;
    }
    visited.add(tierId);

    const tier = await this.prisma.priceTier.findUnique({
      where: { id: tierId },
      select: {
        id: true,
        derivedFromTierId: true,
        multiplier: true,
        markupPercent: true,
      },
    });

    if (!tier) {
      return null;
    }

    const explicitPrice = await this.findExplicitPrice(itemType, itemId, tierId);
    if (explicitPrice?.priceMinor != null) {
      return explicitPrice.priceMinor;
    }

    const baseCostMinor = await this.findBaseCost(itemType, itemId);
    const markupPercent = Number(tier.markupPercent ?? 0);

    if (tier.derivedFromTierId && markupPercent > 0) {
      const derivedBase = await this.resolveTierPriceForItem(itemType, itemId, tier.derivedFromTierId, visited);
      if (derivedBase != null) {
        return Math.ceil((derivedBase * (1 + markupPercent / 100)) / 5) * 5;
      }
    }

    if (tier.multiplier != null && baseCostMinor != null && tier.multiplier > 0) {
      return Math.ceil((baseCostMinor * tier.multiplier) / 5) * 5;
    }

    return null;
  }

  async getTiers() {
    const tiers = await this.prisma.priceTier.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        derivedFromTierId: true,
        multiplier: true,
        markupPercent: true,
      },
    });

    return {
      message: 'Price tiers retrieved successfully.',
      data: tiers,
    };
  }

  async getTierPriceOverrides(tierId: string) {
    const tier = await this.prisma.priceTier.findUnique({
      where: { id: tierId },
      select: { id: true, name: true },
    });

    if (!tier) {
      throw new NotFoundException(`Price tier ${tierId} was not found.`);
    }

    const [dishPrices, optionPrices] = await Promise.all([
      this.prisma.dishPrice.findMany({
        where: { priceTierId: tierId },
        include: {
          dish: { select: { id: true, name: true, sku: true, costPriceMinor: true } },
        },
        orderBy: { dish: { name: 'asc' } },
      }),
      this.prisma.optionPrice.findMany({
        where: { priceTierId: tierId },
        include: {
          option: { select: { id: true, name: true, costPriceMinor: true } },
        },
        orderBy: { option: { name: 'asc' } },
      }),
    ]);

    return {
      message: 'Tier price overrides retrieved successfully.',
      data: {
        tier,
        dishPrices: dishPrices.map((entry) => ({
          id: entry.id,
          priceTierId: entry.priceTierId,
          dishId: entry.dishId,
          name: entry.dish.name,
          sku: entry.dish.sku,
          priceMinor: entry.priceMinor,
        })),
        optionPrices: optionPrices.map((entry) => ({
          id: entry.id,
          priceTierId: entry.priceTierId,
          optionId: entry.optionId,
          name: entry.option.name,
          priceMinor: entry.priceMinor,
        })),
      },
    };
  }

  async upsertDishPriceOverride(tierId: string, dishId: string, priceMinor: number) {
    if (!tierId || !dishId) {
      throw new BadRequestException('Tier ID and dish ID are required.');
    }

    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      throw new BadRequestException('Dish price override must be a non-negative number.');
    }

    const tier = await this.prisma.priceTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException(`Price tier ${tierId} was not found.`);
    }

    const dish = await this.prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      throw new NotFoundException(`Dish ${dishId} was not found.`);
    }

    const record = await this.prisma.dishPrice.upsert({
      where: { priceTierId_dishId: { priceTierId: tierId, dishId } },
      update: { priceMinor },
      create: { priceTierId: tierId, dishId, priceMinor },
    });

    return {
      message: 'Dish price override saved successfully.',
      data: record,
    };
  }

  async upsertOptionPriceOverride(tierId: string, optionId: string, priceMinor: number) {
    if (!tierId || !optionId) {
      throw new BadRequestException('Tier ID and option ID are required.');
    }

    if (!Number.isFinite(priceMinor) || priceMinor < 0) {
      throw new BadRequestException('Option price override must be a non-negative number.');
    }

    const tier = await this.prisma.priceTier.findUnique({ where: { id: tierId } });
    if (!tier) {
      throw new NotFoundException(`Price tier ${tierId} was not found.`);
    }

    const option = await this.prisma.option.findUnique({ where: { id: optionId } });
    if (!option) {
      throw new NotFoundException(`Option ${optionId} was not found.`);
    }

    const record = await this.prisma.optionPrice.upsert({
      where: { priceTierId_optionId: { priceTierId: tierId, optionId } },
      update: { priceMinor },
      create: { priceTierId: tierId, optionId, priceMinor },
    });

    return {
      message: 'Option price override saved successfully.',
      data: record,
    };
  }

  async calculateDishPrice(dishId: string, companyTierId?: string) {
    const tier = await this.findEffectiveTier(companyTierId);
    if (!tier) {
      return { available: false, reason: 'No default or selected pricing tier is configured.', priceMinor: null };
    }

    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      select: { id: true, name: true, costPriceMinor: true },
    });

    if (!dish) {
      throw new NotFoundException(`Dish ${dishId} was not found.`);
    }

    const explicitPrice = await this.findExplicitPrice('dish', dish.id, tier.id);
    const baseCostMinor = dish.costPriceMinor ?? null;
    const derivedBaseMinor = tier.derivedFromTierId ? await this.resolveTierPriceForItem('dish', dish.id, tier.derivedFromTierId) : null;

    const context: PricingContext = {
      itemId: dish.id,
      itemType: 'dish',
      baseCostMinor,
      overridePriceMinor: explicitPrice?.priceMinor ?? null,
      derivedBaseMinor,
      tier,
    };

    const priceMinor = this.pricingResolver.resolve(context);

    if (priceMinor == null) {
      return {
        available: false,
        reason: `No price is available for ${dish.name} on ${tier.name}.`,
        priceMinor: null,
        tierId: tier.id,
        tierName: tier.name,
      };
    }

    return {
      available: true,
      priceMinor,
      price: Number((priceMinor / 100).toFixed(2)),
      tierId: tier.id,
      tierName: tier.name,
      itemId: dish.id,
      itemName: dish.name,
    };
  }

  async calculateOptionPrice(optionId: string, companyTierId?: string) {
    const tier = await this.findEffectiveTier(companyTierId);
    if (!tier) {
      return { available: false, reason: 'No default or selected pricing tier is configured.', priceMinor: null };
    }

    const option = await this.prisma.option.findUnique({
      where: { id: optionId },
      select: { id: true, name: true, costPriceMinor: true },
    });

    if (!option) {
      throw new NotFoundException(`Option ${optionId} was not found.`);
    }

    const explicitPrice = await this.findExplicitPrice('option', option.id, tier.id);
    const baseCostMinor = option.costPriceMinor ?? null;
    const derivedBaseMinor = tier.derivedFromTierId ? await this.resolveTierPriceForItem('option', option.id, tier.derivedFromTierId) : null;

    const context: PricingContext = {
      itemId: option.id,
      itemType: 'option',
      baseCostMinor,
      overridePriceMinor: explicitPrice?.priceMinor ?? null,
      derivedBaseMinor,
      tier,
    };

    const priceMinor = this.pricingResolver.resolve(context);

    if (priceMinor == null) {
      return {
        available: false,
        reason: `No price is available for ${option.name} on ${tier.name}.`,
        priceMinor: null,
        tierId: tier.id,
        tierName: tier.name,
      };
    }

    return {
      available: true,
      priceMinor,
      price: Number((priceMinor / 100).toFixed(2)),
      tierId: tier.id,
      tierName: tier.name,
      itemId: option.id,
      itemName: option.name,
    };
  }

  async getMissingPrices(tierId?: string) {
    const effectiveTier = await this.findEffectiveTier(tierId);
    if (!effectiveTier) {
      return { tier: null, missingDishes: [], missingOptions: [] };
    }

    const [dishes, options] = await Promise.all([
      this.prisma.dish.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, sku: true, costPriceMinor: true } }),
      this.prisma.option.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, costPriceMinor: true } }),
    ]);

    const missingDishes = [] as Array<{ id: string; name: string; sku: string; costPriceMinor: number; tierId: string; tierName: string }>;
    const missingOptions = [] as Array<{ id: string; name: string; costPriceMinor: number; tierId: string; tierName: string }>;

    for (const dish of dishes) {
      const result = await this.calculateDishPrice(dish.id, effectiveTier.id);
      if (!result.available) {
        missingDishes.push({
          id: dish.id,
          name: dish.name,
          sku: dish.sku,
          costPriceMinor: dish.costPriceMinor,
          tierId: effectiveTier.id,
          tierName: effectiveTier.name,
        });
      }
    }

    for (const option of options) {
      const result = await this.calculateOptionPrice(option.id, effectiveTier.id);
      if (!result.available) {
        missingOptions.push({
          id: option.id,
          name: option.name,
          costPriceMinor: option.costPriceMinor,
          tierId: effectiveTier.id,
          tierName: effectiveTier.name,
        });
      }
    }

    return {
      tier: {
        id: effectiveTier.id,
        name: effectiveTier.name,
        isDefault: effectiveTier.isDefault,
      },
      missingDishes,
      missingOptions,
    };
  }
}
