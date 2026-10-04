import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryDishAssignmentBodyDto,
  CreateCategoryDto,
  CreateDishDto,
  CreateOptionDto,
  CreateOptionGroupDto,
  CreateReferenceItemDto,
  OptionGroupOptionSyncDto,
  UpdateCategoryDto,
  UpdateDishDto,
  UpdateOptionDto,
  UpdateOptionGroupDto,
} from './dto/catalogue.dto';

@Injectable()
export class CatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly dishInclude = {
    allergies: { include: { allergen: true } },
    dietaryTags: { include: { dietaryTag: true } },
    station: true,
    categories: {
      include: { category: true },
      orderBy: { displayOrder: 'asc' as const },
    },
    optionGroups: {
      include: {
        optionGroup: {
          include: {
            options: {
              include: { option: true },
              orderBy: { displayOrder: 'asc' as const },
            },
          },
        },
      },
      orderBy: { displayOrder: 'asc' as const },
    },
  };

  private readonly optionGroupInclude = {
    options: {
      include: { option: true },
      orderBy: { displayOrder: 'asc' as const },
    },
    dishes: {
      include: { dish: true },
      orderBy: { displayOrder: 'asc' as const },
    },
  };

  private async ensureDish(id: string) {
    const item = await this.prisma.dish.findUnique({
      where: { id },
      include: this.dishInclude,
    });

    if (!item) {
      throw new NotFoundException(`Dish ${id} was not found.`);
    }

    return item;
  }

  private async ensureOption(id: string) {
    const item = await this.prisma.option.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Option ${id} was not found.`);
    }
    return item;
  }

  private async ensureOptionGroup(id: string) {
    const item = await this.prisma.optionGroup.findUnique({
      where: { id },
      include: this.optionGroupInclude,
    });

    if (!item) {
      throw new NotFoundException(`Option group ${id} was not found.`);
    }

    return item;
  }

  private async ensureCategory(id: string) {
    const item = await this.prisma.category.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Category ${id} was not found.`);
    }
    return item;
  }

  private async ensureKitchenStation(id: string) {
    const item = await this.prisma.kitchenStation.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Kitchen station ${id} was not found.`);
    }
    return item;
  }

  private async ensureAllergen(id: string) {
    const item = await this.prisma.allergen.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Allergen ${id} was not found.`);
    }
    return item;
  }

  private async ensureDietaryTag(id: string) {
    const item = await this.prisma.dietaryTag.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Dietary tag ${id} was not found.`);
    }
    return item;
  }

  async findReferenceData() {
    const [allergens, dietaryTags, kitchenStations, categories, options, optionGroups] = await this.prisma.$transaction([
      this.prisma.allergen.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.dietaryTag.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.kitchenStation.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.category.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.option.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.optionGroup.findMany({
        include: {
          options: { include: { option: true }, orderBy: { displayOrder: 'asc' } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return { allergens, dietaryTags, kitchenStations, categories, options, optionGroups };
  }

  async findAllDishes(page = 1, limit = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dish.findMany({
        include: this.dishInclude,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dish.count(),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findOneDish(id: string) {
    return this.ensureDish(id);
  }

  async createDish(data: CreateDishDto) {
    await this.validateDishRelations(data);
    const sku = data.sku?.trim() || `DISH-${Date.now()}`;
    await this.assertDishSkuAvailable(sku);
    const dish = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dish.create({
        data: {
          sku,
          name: data.name.trim(),
          description: data.description,
          image: data.imageUrl,
          temperature: data.temperature ?? 'HOT',
          costPriceMinor: data.costPriceMinor ?? 0,
          stationId: data.stationId || null,
          minQuantity: data.minQuantity ?? null,
          isActive: data.isActive ?? true,
        },
      });
      await this.syncDishRelations(tx, created.id, data);
      return created;
    });
    return this.ensureDish(dish.id);
  }

  async updateDish(id: string, data: UpdateDishDto) {
    await this.ensureDish(id);
    await this.validateDishRelations(data);
    const sku = data.sku?.trim();
    if (data.sku !== undefined && !sku) {
      throw new BadRequestException('Dish SKU must not be blank.');
    }
    if (sku) {
      await this.assertDishSkuAvailable(sku, id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.dish.update({
        where: { id },
        data: {
          sku,
          name: data.name?.trim(),
          description: data.description,
          image: data.imageUrl,
          temperature: data.temperature,
          costPriceMinor: data.costPriceMinor,
          stationId: data.stationId === undefined ? undefined : data.stationId || null,
          minQuantity: data.minQuantity === undefined ? undefined : data.minQuantity ?? null,
          isActive: data.isActive,
        },
      });
      await this.syncDishRelations(tx, saved.id, data);
      return saved;
    });
    return this.ensureDish(updated.id);
  }

  async toggleDishActive(id: string) {
    const item = await this.ensureDish(id);
    const updated = await this.prisma.dish.update({
      where: { id },
      data: { isActive: !item.isActive },
      include: this.dishInclude,
    });
    return updated;
  }

  async findAllOptions(page = 1, limit = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.option.findMany({
        include: {
          allergies: { include: { allergen: true } },
          dietaryTags: { include: { dietaryTag: true } },
          groups: { include: { optionGroup: true }, orderBy: { displayOrder: 'asc' } },
        },
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.option.count(),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findOneOption(id: string) {
    return this.ensureOption(id);
  }

  async createOption(data: CreateOptionDto) {
    await this.validateOptionRelations(data);
    const option = await this.prisma.$transaction(async (tx) => {
      const created = await tx.option.create({
        data: {
          name: data.name,
          description: data.description,
          costPriceMinor: data.costPriceMinor ?? 0,
          isActive: data.isActive ?? true,
        },
      });
      if (data.allergenIds?.length) {
        await tx.optionAllergen.createMany({
          data: data.allergenIds.map((allergenId) => ({ optionId: created.id, allergenId })),
        });
      }
      if (data.dietaryTagIds?.length) {
        await tx.optionDietaryTag.createMany({
          data: data.dietaryTagIds.map((dietaryTagId) => ({ optionId: created.id, dietaryTagId })),
        });
      }
      return created;
    });

    return this.prisma.option.findUnique({
      where: { id: option.id },
      include: {
        allergies: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
      },
    });
  }

  async updateOption(id: string, data: UpdateOptionDto) {
    await this.ensureOption(id);
    await this.validateOptionRelations(data);

    const option = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.option.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          costPriceMinor: data.costPriceMinor,
          isActive: data.isActive,
        },
      });
      if (data.allergenIds !== undefined) {
        await tx.optionAllergen.deleteMany({ where: { optionId: id } });
        if (data.allergenIds.length) {
          await tx.optionAllergen.createMany({
            data: data.allergenIds.map((allergenId) => ({ optionId: id, allergenId })),
          });
        }
      }
      if (data.dietaryTagIds !== undefined) {
        await tx.optionDietaryTag.deleteMany({ where: { optionId: id } });
        if (data.dietaryTagIds.length) {
          await tx.optionDietaryTag.createMany({
            data: data.dietaryTagIds.map((dietaryTagId) => ({ optionId: id, dietaryTagId })),
          });
        }
      }
      return saved;
    });

    return this.prisma.option.findUnique({
      where: { id: option.id },
      include: {
        allergies: { include: { allergen: true } },
        dietaryTags: { include: { dietaryTag: true } },
      },
    });
  }

  async toggleOptionActive(id: string) {
    const item = await this.ensureOption(id);
    return this.prisma.option.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  async findAllOptionGroups(page = 1, limit = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.optionGroup.findMany({
        include: this.optionGroupInclude,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.optionGroup.count(),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findOneOptionGroup(id: string) {
    return this.ensureOptionGroup(id);
  }

  async createOptionGroup(data: CreateOptionGroupDto) {
    if (data.optionIds !== undefined) await this.validateOptionGroupItems(data.optionIds);
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.optionGroup.create({
        data: { name: data.name, isRequired: data.isRequired ?? false },
      });
      if (data.optionIds !== undefined) {
        await this.writeOptionGroupOptions(tx, created.id, data.optionIds);
      }
      return created;
    });
    return this.ensureOptionGroup(group.id);
  }

  async updateOptionGroup(id: string, data: UpdateOptionGroupDto) {
    await this.ensureOptionGroup(id);
    if (data.optionIds !== undefined) await this.validateOptionGroupItems(data.optionIds);
    const group = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.optionGroup.update({
        where: { id },
        data: { name: data.name, isRequired: data.isRequired },
      });
      if (data.optionIds !== undefined) {
        await this.writeOptionGroupOptions(tx, saved.id, data.optionIds);
      }
      return saved;
    });
    return this.ensureOptionGroup(group.id);
  }

  async syncOptionGroupOptions(optionGroupId: string, items: OptionGroupOptionSyncDto['items']) {
    await this.ensureOptionGroup(optionGroupId);
    await this.validateOptionGroupItems(items);
    await this.prisma.$transaction(async (tx) => {
      await this.writeOptionGroupOptions(tx, optionGroupId, items);
    });
    return this.ensureOptionGroup(optionGroupId);
  }

  private async validateOptionGroupItems(items: OptionGroupOptionSyncDto['items']) {
    const optionIds = items.map(({ optionId }) => optionId);
    if (new Set(optionIds).size !== optionIds.length) {
      throw new BadRequestException('An option can appear only once in an option group.');
    }
    const validOptions = await this.prisma.option.count({ where: { id: { in: optionIds } } });
    if (validOptions !== optionIds.length) {
      throw new BadRequestException('One or more option-group options do not exist.');
    }
  }

  private async writeOptionGroupOptions(
    tx: Prisma.TransactionClient,
    optionGroupId: string,
    items: OptionGroupOptionSyncDto['items'],
  ) {
    const current = await tx.optionGroupOption.findMany({ where: { optionGroupId } });
    const nextIds = new Set(items.map(({ optionId }) => optionId));

    for (const currentItem of current) {
      if (!nextIds.has(currentItem.optionId)) {
        await tx.optionGroupOption.delete({ where: { id: currentItem.id } });
      }
    }

    for (const item of items) {
      await tx.optionGroupOption.upsert({
        where: {
          optionGroupId_optionId: {
            optionGroupId,
            optionId: item.optionId,
          },
        },
        update: {
          displayOrder: item.displayOrder ?? 0,
          extraChargeMinor: 0,
        },
        create: {
          optionGroupId,
          optionId: item.optionId,
          displayOrder: item.displayOrder ?? 0,
          extraChargeMinor: 0,
        },
      });
    }
  }

  async findAllAllergens() {
    return this.prisma.allergen.findMany({ orderBy: { name: 'asc' } });
  }

  async createAllergen(data: CreateReferenceItemDto) {
    return this.prisma.allergen.create({ data: { name: data.name, description: data.description } });
  }

  async updateAllergen(id: string, data: CreateReferenceItemDto) {
    await this.ensureAllergen(id);
    return this.prisma.allergen.update({ where: { id }, data: { name: data.name, description: data.description } });
  }

  async findAllDietaryTags() {
    return this.prisma.dietaryTag.findMany({ orderBy: { name: 'asc' } });
  }

  async createDietaryTag(data: CreateReferenceItemDto) {
    return this.prisma.dietaryTag.create({ data: { name: data.name, description: data.description } });
  }

  async updateDietaryTag(id: string, data: CreateReferenceItemDto) {
    await this.ensureDietaryTag(id);
    return this.prisma.dietaryTag.update({ where: { id }, data: { name: data.name, description: data.description } });
  }

  async findAllKitchenStations() {
    return this.prisma.kitchenStation.findMany({ orderBy: { name: 'asc' } });
  }

  async createKitchenStation(data: CreateReferenceItemDto) {
    return this.prisma.kitchenStation.create({ data: { name: data.name, description: data.description } });
  }

  async updateKitchenStation(id: string, data: CreateReferenceItemDto) {
    await this.ensureKitchenStation(id);
    return this.prisma.kitchenStation.update({ where: { id }, data: { name: data.name, description: data.description } });
  }

  async findAllCategories() {
    return this.prisma.category.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
  }

  async createCategory(data: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        displayOrder: data.displayOrder ?? 0,
        isActive: data.isActive ?? true,
        isSecret: data.isSecret ?? false,
      },
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto) {
    await this.ensureCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        displayOrder: data.displayOrder,
        isActive: data.isActive,
        isSecret: data.isSecret,
      },
    });
  }

  async toggleCategoryActive(id: string) {
    const item = await this.ensureCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  async upsertCategoryDishAssignment(categoryId: string, body: CategoryDishAssignmentBodyDto) {
    await this.ensureCategory(categoryId);
    await this.ensureDish(body.dishId);

    return this.prisma.categoryDish.upsert({
      where: {
        categoryId_dishId: {
          categoryId,
          dishId: body.dishId,
        },
      },
      update: {
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
      create: {
        categoryId,
        dishId: body.dishId,
        displayOrder: body.displayOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });
  }

  async removeCategoryDishAssignment(categoryId: string, dishId: string) {
    await this.ensureCategory(categoryId);
    await this.ensureDish(dishId);

    const relation = await this.prisma.categoryDish.findUnique({
      where: { categoryId_dishId: { categoryId, dishId } },
    });

    if (!relation) {
      throw new NotFoundException(`Dish ${dishId} is not assigned to category ${categoryId}.`);
    }

    await this.prisma.categoryDish.delete({ where: { id: relation.id } });
    return { categoryId, dishId, removed: true };
  }

  private async syncDishRelations(
    tx: Prisma.TransactionClient,
    dishId: string,
    data: Partial<CreateDishDto & UpdateDishDto>,
  ) {
    if (data.allergenIds !== undefined) {
      await tx.dishAllergen.deleteMany({ where: { dishId } });
      if (data.allergenIds.length) {
        await tx.dishAllergen.createMany({
          data: data.allergenIds.map((allergenId) => ({ dishId, allergenId })),
        });
      }
    }

    if (data.dietaryTagIds !== undefined) {
      await tx.dishDietaryTag.deleteMany({ where: { dishId } });
      if (data.dietaryTagIds.length) {
        await tx.dishDietaryTag.createMany({
          data: data.dietaryTagIds.map((dietaryTagId) => ({ dishId, dietaryTagId })),
        });
      }
    }

    if (data.categoryAssignments !== undefined) {
      const current = await tx.categoryDish.findMany({ where: { dishId } });
      const assignmentMap = new Set(data.categoryAssignments.map((item) => item.categoryId));

      for (const item of current) {
        if (!assignmentMap.has(item.categoryId)) {
          await tx.categoryDish.delete({ where: { id: item.id } });
        }
      }

      for (const item of data.categoryAssignments) {
        await tx.categoryDish.upsert({
          where: {
            categoryId_dishId: {
              categoryId: item.categoryId,
              dishId,
            },
          },
          update: {
            displayOrder: item.displayOrder ?? 0,
            isActive: item.isActive ?? true,
          },
          create: {
            categoryId: item.categoryId,
            dishId,
            displayOrder: item.displayOrder ?? 0,
            isActive: item.isActive ?? true,
          },
        });
      }
    }

    if (data.optionGroups !== undefined) {
      const current = await tx.dishOptionGroup.findMany({ where: { dishId } });
      const nextIds = new Set(data.optionGroups.map((item) => item.optionGroupId));

      for (const item of current) {
        if (!nextIds.has(item.optionGroupId)) {
          await tx.dishOptionGroup.delete({ where: { id: item.id } });
        }
      }

      for (const item of data.optionGroups) {
        await tx.dishOptionGroup.upsert({
          where: {
            dishId_optionGroupId: {
              dishId,
              optionGroupId: item.optionGroupId,
            },
          },
          update: {
            displayOrder: item.displayOrder ?? 0,
            isRequiredOverride: item.isRequiredOverride,
          },
          create: {
            dishId,
            optionGroupId: item.optionGroupId,
            displayOrder: item.displayOrder ?? 0,
            isRequiredOverride: item.isRequiredOverride,
          },
        });
      }
    }
  }

  private async validateDishRelations(data: Partial<CreateDishDto & UpdateDishDto>) {
    if (data.stationId) await this.ensureKitchenStation(data.stationId);
    await this.assertIdsExist('allergen', data.allergenIds);
    await this.assertIdsExist('dietaryTag', data.dietaryTagIds);
    await this.assertIdsExist('category', data.categoryAssignments?.map((item) => item.categoryId));
    await this.assertIdsExist('optionGroup', data.optionGroups?.map((item) => item.optionGroupId));
  }

  private async assertDishSkuAvailable(sku: string, excludedDishId?: string) {
    const existing = await this.prisma.dish.findUnique({
      where: { sku },
      select: { id: true },
    });
    if (existing && existing.id !== excludedDishId) {
      throw new ConflictException(`Dish SKU '${sku}' already exists.`);
    }
  }

  private async validateOptionRelations(data: Partial<CreateOptionDto & UpdateOptionDto>) {
    await this.assertIdsExist('allergen', data.allergenIds);
    await this.assertIdsExist('dietaryTag', data.dietaryTagIds);
  }

  private async assertIdsExist(
    model: 'allergen' | 'dietaryTag' | 'category' | 'optionGroup',
    ids: string[] | undefined,
  ) {
    if (ids === undefined) return;
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException(`Duplicate ${model} IDs are not allowed.`);
    }
    const delegate = this.prisma[model] as unknown as {
      count(args: { where: { id: { in: string[] } } }): Promise<number>;
    };
    const count = await delegate.count({ where: { id: { in: unique } } });
    if (count !== unique.length) {
      throw new BadRequestException(`One or more ${model} IDs do not exist.`);
    }
  }
}
