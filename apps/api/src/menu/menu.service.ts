import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import {
  ActiveCategoryPolicy,
  ActiveDishPolicy,
  CompanyVisibilityPolicy,
  PublicCategoryPolicy,
  ResolvedPricePolicy,
} from './menu-policies';

type MenuDish = Prisma.DishGetPayload<{
  include: {
    optionGroups: {
      include: {
        optionGroup: {
          include: { options: { include: { option: true } } };
        };
      };
    };
    allergies: { include: { allergen: true } };
    dietaryTags: { include: { dietaryTag: true } };
    station: true;
  };
}>;

@Injectable()
export class MenuService {
  private readonly activeCategoryPolicy = new ActiveCategoryPolicy();
  private readonly publicCategoryPolicy = new PublicCategoryPolicy();
  private readonly activeDishPolicy = new ActiveDishPolicy();
  private readonly companyVisibilityPolicy = new CompanyVisibilityPolicy();
  private readonly resolvedPricePolicy = new ResolvedPricePolicy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  private async findEmployeeContext(employeeId: string) {
    if (!employeeId) {
      throw new BadRequestException('Employee ID is required.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        company: {
          include: {
            hiddenCategories: { select: { categoryId: true } },
            hiddenDishes: { select: { dishId: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} was not found.`);
    }

    return employee;
  }

  private async resolveOptionGroups(
    dish: MenuDish,
    companyTierId: string | undefined,
  ) {
    const groups = await Promise.all(
      dish.optionGroups.map(async (dishOptionGroup) => {
        const options = await Promise.all(
          dishOptionGroup.optionGroup.options.map(async (groupOption) => {
            if (!this.activeDishPolicy.isSatisfiedBy(groupOption.option)) {
              return null;
            }

            const pricing = await this.pricingService.calculateOptionPrice(
              groupOption.option.id,
              companyTierId,
            );
            if (!pricing.available || pricing.priceMinor == null) {
              return null;
            }

            const extraChargeMinor = groupOption.extraChargeMinor;
            return {
              id: groupOption.option.id,
              name: groupOption.option.name,
              description: groupOption.option.description ?? null,
              priceMinor: pricing.priceMinor,
              price: pricing.price,
              extraChargeMinor,
              effectivePriceMinor: pricing.priceMinor + extraChargeMinor,
            };
          }),
        );

        const resolvedOptions = options.filter(
          (option): option is NonNullable<typeof option> => option !== null,
        );
        if (resolvedOptions.length === 0) {
          return null;
        }

        return {
          id: dishOptionGroup.optionGroup.id,
          name: dishOptionGroup.optionGroup.name,
          isRequired:
            dishOptionGroup.isRequiredOverride ??
            dishOptionGroup.optionGroup.isRequired,
          allowPortions: dishOptionGroup.optionGroup.allowPortions,
          displayOrder: dishOptionGroup.displayOrder,
          options: resolvedOptions,
        };
      }),
    );

    return groups
      .filter(
        (group): group is NonNullable<typeof group> => group !== null,
      )
      .sort((left, right) => left.displayOrder - right.displayOrder);
  }

  private async resolveDish(
    dish: MenuDish,
    companyTierId: string | undefined,
  ) {
    if (!this.activeDishPolicy.isSatisfiedBy(dish)) {
      return null;
    }

    const pricing = await this.pricingService.calculateDishPrice(
      dish.id,
      companyTierId,
    );
    if (!pricing.available || !this.resolvedPricePolicy.hasPrice(pricing.priceMinor)) {
      return null;
    }

    return {
      id: dish.id,
      sku: dish.sku,
      name: dish.name,
      description: dish.description ?? null,
      image: dish.image ?? null,
      temperature: dish.temperature,
      priceMinor: pricing.priceMinor,
      price: pricing.price,
      minQuantity: dish.minQuantity ?? null,
      allergies: dish.allergies.map(({ allergen }) => ({
        id: allergen.id,
        name: allergen.name,
      })),
      dietaryTags: dish.dietaryTags.map(({ dietaryTag }) => ({
        id: dietaryTag.id,
        name: dietaryTag.name,
      })),
      optionGroups: await this.resolveOptionGroups(dish, companyTierId),
    };
  }

  async getMenuForEmployee(employeeId: string) {
    const employee = await this.findEmployeeContext(employeeId);
    const hiddenCategoryIds = new Set(
      employee.company.hiddenCategories.map(({ categoryId }) => categoryId),
    );
    const hiddenDishIds = new Set(
      employee.company.hiddenDishes.map(({ dishId }) => dishId),
    );

    const assignments = await this.prisma.categoryDish.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        dish: { isActive: true },
      },
      include: {
        category: true,
        dish: {
          include: {
            station: true,
            optionGroups: {
              include: {
                optionGroup: {
                  include: {
                    options: {
                      include: { option: true },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
              orderBy: { displayOrder: 'asc' },
            },
            allergies: { include: { allergen: true } },
            dietaryTags: { include: { dietaryTag: true } },
          },
        },
      },
      orderBy: [{ category: { displayOrder: 'asc' } }, { displayOrder: 'asc' }],
    });

    const categories = new Map<
      string,
      {
        id: string;
        name: string;
        displayOrder: number;
        isSecret: boolean;
        dishes: NonNullable<Awaited<ReturnType<MenuService['resolveDish']>>>[];
      }
    >();

    for (const assignment of assignments) {
      const category = assignment.category;
      if (
        !this.activeCategoryPolicy.isSatisfiedBy(category) ||
        !this.publicCategoryPolicy.isSatisfiedBy(category) ||
        !this.companyVisibilityPolicy.isCategoryVisible(
          category.id,
          hiddenCategoryIds,
        ) ||
        !this.companyVisibilityPolicy.isDishVisible(
          assignment.dish.id,
          hiddenDishIds,
        )
      ) {
        continue;
      }

      const dish = await this.resolveDish(
        assignment.dish,
        employee.company.priceTierId ?? undefined,
      );
      if (!dish) {
        continue;
      }

      const current = categories.get(category.id) ?? {
        id: category.id,
        name: category.name,
        displayOrder: category.displayOrder,
        isSecret: category.isSecret,
        dishes: [],
      };
      current.dishes.push(dish);
      categories.set(category.id, current);
    }

    const visibleCategories = Array.from(categories.values()).sort(
      (left, right) => left.displayOrder - right.displayOrder,
    );

    return {
      employeeId: employee.id,
      companyId: employee.company.id,
      companyName: employee.company.name,
      priceTierId: employee.company.priceTierId,
      menu: {
        categories: visibleCategories,
        totalDishes: visibleCategories.reduce(
          (total, category) => total + category.dishes.length,
          0,
        ),
      },
    };
  }

  async getCategories() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        dishes: {
          where: { isActive: true },
          include: { dish: true },
        },
      },
    });

    return {
      message: 'Menu categories retrieved successfully.',
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        displayOrder: category.displayOrder,
        isSecret: category.isSecret,
        dishCount: category.dishes.length,
      })),
    };
  }
}
