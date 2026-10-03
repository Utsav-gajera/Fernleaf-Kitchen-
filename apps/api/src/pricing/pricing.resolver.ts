export type PricingTierInfo = {
  id: string;
  name?: string | null;
  isDefault?: boolean | null;
  derivedFromTierId?: string | null;
  multiplier?: number | null;
  markupPercent?: number | null;
};

export type PricingContext = {
  itemId: string;
  itemType: 'dish' | 'option';
  baseCostMinor?: number | null;
  overridePriceMinor?: number | null;
  derivedBaseMinor?: number | null;
  tier?: PricingTierInfo | null;
};

export function roundUpToFive(value: number): number {
  return Math.ceil(value / 5) * 5;
}

export interface PricingStrategy {
  resolve(context: PricingContext): number | null;
}

export class ExplicitPriceStrategy implements PricingStrategy {
  resolve(context: PricingContext): number | null {
    return context.overridePriceMinor != null ? context.overridePriceMinor : null;
  }
}

export class CostMultiplierStrategy implements PricingStrategy {
  resolve(context: PricingContext): number | null {
    const multiplier = Number(context.tier?.multiplier ?? 0);
    const baseCost = context.baseCostMinor ?? null;

    if (baseCost == null || multiplier <= 0) {
      return null;
    }

    return roundUpToFive(baseCost * multiplier);
  }
}

export class TierMarkupStrategy implements PricingStrategy {
  resolve(context: PricingContext): number | null {
    const markupPercent = Number(context.tier?.markupPercent ?? 0);
    const baseCost = context.derivedBaseMinor ?? context.baseCostMinor ?? null;

    if (baseCost == null || markupPercent <= 0) {
      return null;
    }

    return roundUpToFive(baseCost * (1 + markupPercent / 100));
  }
}

export class PricingResolver {
  constructor(
    private readonly strategies: PricingStrategy[] = [
      new ExplicitPriceStrategy(),
      new TierMarkupStrategy(),
      new CostMultiplierStrategy(),
    ],
  ) {}

  resolve(context: PricingContext): number | null {
    for (const strategy of this.strategies) {
      const result = strategy.resolve(context);
      if (result != null) {
        return result;
      }
    }

    return null;
  }
}
