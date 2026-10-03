export interface CategoryVisibility {
  isActive: boolean;
  isSecret: boolean;
}

export interface DishVisibility {
  isActive: boolean;
}

export class ActiveCategoryPolicy {
  isSatisfiedBy(category: CategoryVisibility): boolean {
    return category.isActive;
  }
}

export class PublicCategoryPolicy {
  isSatisfiedBy(category: CategoryVisibility): boolean {
    return !category.isSecret;
  }
}

export class ActiveDishPolicy {
  isSatisfiedBy(dish: DishVisibility): boolean {
    return dish.isActive;
  }
}

export class CompanyVisibilityPolicy {
  isCategoryVisible(categoryId: string, hiddenCategoryIds: ReadonlySet<string>): boolean {
    return !hiddenCategoryIds.has(categoryId);
  }

  isDishVisible(dishId: string, hiddenDishIds: ReadonlySet<string>): boolean {
    return !hiddenDishIds.has(dishId);
  }
}

export class ResolvedPricePolicy {
  hasPrice(priceMinor: number | null): priceMinor is number {
    return priceMinor !== null;
  }
}
