import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompanyAddressDto,
  CompanyHolidayDto,
  CreateCompanyDto,
  UpdateCompanyDefaultsDto,
  UpdateCompanyDto,
  UpdateCompanyWorkingDaysDto,
} from './dto/company.dto';
import { UpdateCompanyMenuVisibilityDto } from './dto/company-menu-visibility.dto';

@Injectable()
export class CompaniesService {
  private readonly publicDomains = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  private readonly companyInclude = {
    domains: true,
    addresses: true,
    holidays: true,
    owner: true,
    priceTier: true,
    defaultDriver: true,
    employees: {
      include: {
        allergies: { include: { allergen: true } },
        dietaryPreferences: { include: { dietaryTag: true } },
      },
    },
  };

  private normalizeDomain(domain: string) {
    return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  }

  private validateDomain(domain: string) {
    const normalized = this.normalizeDomain(domain);

    if (!/^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(normalized)) {
      throw new BadRequestException('A valid domain is required.');
    }

    if (this.publicDomains.has(normalized)) {
      throw new BadRequestException(`Public email domain '${normalized}' is not allowed.`);
    }

    return normalized;
  }

  private async ensureCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: this.companyInclude,
    });

    if (!company) {
      throw new NotFoundException(`Company ${id} was not found.`);
    }

    return company;
  }

  private async ensurePriceTierExists(id?: string) {
    if (!id) return;
    const tier = await this.prisma.priceTier.findUnique({ where: { id } });
    if (!tier) {
      throw new BadRequestException(`Price tier ${id} was not found.`);
    }
  }

  private async ensureDriverExists(id?: string) {
    if (!id) return;
    const driver = await this.prisma.staffUser.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });
    if (driver?.role !== 'DRIVER' || !driver.isActive) {
      throw new BadRequestException(`Default driver ${id} must be an active driver account.`);
    }
  }

  private async ensureOwnerBelongsToCompany(companyId: string, ownerId?: string) {
    if (!ownerId) return;

    const employee = await this.prisma.employee.findUnique({ where: { id: ownerId } });

    if (employee?.companyId !== companyId) {
      throw new BadRequestException('Company owner must be an employee of the same company.');
    }
  }

  private async ensureNoDomainConflict(domains: string[], companyId?: string) {
    const seen = new Set<string>();

    for (const rawDomain of domains) {
      const normalized = this.validateDomain(rawDomain);

      if (seen.has(normalized)) {
        throw new BadRequestException(`Duplicate domain '${normalized}' in the same request.`);
      }
      seen.add(normalized);

      const existing = await this.prisma.companyDomain.findUnique({
        where: { domain: normalized },
      });

      if (existing && (!companyId || existing.companyId !== companyId)) {
        throw new BadRequestException(`Domain '${normalized}' is already assigned to another company.`);
      }
    }
  }

  async findAll(page = 1, limit = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where: { isActive: true },
        include: this.companyInclude,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.company.count({ where: { isActive: true } }),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findOne(id: string) {
    return this.ensureCompany(id);
  }

  async create(data: CreateCompanyDto) {
    if (data.ownerId) {
      throw new BadRequestException('Owner must be assigned after the company is created and validated against its employee list.');
    }

    if (data.priceTierId) {
      await this.ensurePriceTierExists(data.priceTierId);
    }

    if (data.defaultDriverId) {
      await this.ensureDriverExists(data.defaultDriverId);
    }

    await this.ensureNoDomainConflict(data.domains);
    const domains = data.domains.map((domain) => this.validateDomain(domain));
    const requestedDefaultIndex = data.addresses.findIndex((address) => address.isDefault);
    const defaultAddressIndex = requestedDefaultIndex >= 0 ? requestedDefaultIndex : 0;
    const addresses = data.addresses.map((address, index) => ({
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      postalCode: address.postalCode,
      instructions: address.instructions,
      isDefault: index === defaultAddressIndex,
    }));

    const company = await this.prisma.company.create({
      data: {
        name: data.name,
        billingContactName: data.billingContactName,
        billingContactEmail: data.billingContactEmail,
        billingContactPhone: data.billingContactPhone,
        priceTierId: data.priceTierId,
        defaultDeliveryTime: data.defaultDeliveryTime ?? '12:00',
        deliveryLeadMinutes: data.deliveryLeadMinutes ?? 60,
        defaultPackaging: data.defaultPackaging ?? 'STANDARD',
        standingInstructions: data.standingInstructions,
        defaultDriverId: data.defaultDriverId !== undefined
          ? data.defaultDriverId || null
          : undefined,
        mon: data.mon ?? true,
        tue: data.tue ?? true,
        wed: data.wed ?? true,
        thu: data.thu ?? true,
        fri: data.fri ?? true,
        sat: data.sat ?? false,
        sun: data.sun ?? false,
        isActive: data.isActive ?? true,
        domains: { create: domains.map((domain) => ({ domain })) },
        addresses: { create: addresses },
        holidays: data.holidays?.length
          ? {
              create: data.holidays.map((holiday) => ({
                date: this.parseDateOnly(holiday.date),
                name: holiday.name,
              })),
            }
          : undefined,
      },
      include: this.companyInclude,
    });

    return this.ensureCompany(company.id);
  }

  async update(id: string, data: UpdateCompanyDto) {
    const company = await this.ensureCompany(id);

    if (data.priceTierId) {
      await this.ensurePriceTierExists(data.priceTierId);
    }

    if (data.defaultDriverId) {
      await this.ensureDriverExists(data.defaultDriverId);
    }

    if (data.ownerId) {
      await this.ensureOwnerBelongsToCompany(id, data.ownerId);
    }

    const normalizedDomains = data.domains
      ? data.domains.map((domain) => this.validateDomain(domain))
      : undefined;
    if (normalizedDomains) {
      await this.ensureNoDomainConflict(normalizedDomains, id);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: {
          name: data.name,
          billingContactName: data.billingContactName,
          billingContactEmail: data.billingContactEmail,
          billingContactPhone: data.billingContactPhone,
          ownerId: data.ownerId ?? company.ownerId ?? undefined,
          priceTierId: data.priceTierId,
          defaultDeliveryTime: data.defaultDeliveryTime,
          deliveryLeadMinutes: data.deliveryLeadMinutes,
          defaultPackaging: data.defaultPackaging,
          standingInstructions: data.standingInstructions,
          defaultDriverId: data.defaultDriverId,
          mon: data.mon,
          tue: data.tue,
          wed: data.wed,
          thu: data.thu,
          fri: data.fri,
          sat: data.sat,
          sun: data.sun,
          isActive: data.isActive,
        },
      });
      if (normalizedDomains) {
        await tx.companyDomain.deleteMany({
          where: { companyId: id, domain: { notIn: normalizedDomains } },
        });
        await tx.companyDomain.createMany({
          data: normalizedDomains.map((domain) => ({ companyId: id, domain })),
          skipDuplicates: true,
        });
      }
      return tx.company.findUnique({ where: { id }, include: this.companyInclude });
    });
  }

  async addDomain(companyId: string, domain: string) {
    const normalized = this.validateDomain(domain);

    const existing = await this.prisma.companyDomain.findUnique({
      where: { domain: normalized },
    });

    if (existing) {
      if (existing.companyId === companyId) {
        throw new BadRequestException(`Domain '${normalized}' is already assigned to this company.`);
      }
      throw new BadRequestException(`Domain '${normalized}' is already assigned to another company.`);
    }

    try {
      return await this.prisma.companyDomain.create({
        data: {
          companyId,
          domain: normalized,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException(`Domain '${normalized}' is already assigned to another company.`);
      }
      throw error;
    }
  }

  async removeDomain(companyId: string, domain: string) {
    const normalized = this.validateDomain(domain);
    const domainCount = await this.prisma.companyDomain.count({ where: { companyId } });
    if (domainCount <= 1) {
      throw new BadRequestException('A company must retain at least one email domain.');
    }
    const result = await this.prisma.companyDomain.deleteMany({
      where: { companyId, domain: normalized },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Domain '${normalized}' was not found for this company.`);
    }

    return { companyId, domain: normalized, removed: true };
  }

  async addAddress(companyId: string, data: CompanyAddressDto) {
    const company = await this.ensureCompany(companyId);

    const payload = {
      companyId,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      instructions: data.instructions,
      isDefault: data.isDefault ?? company.addresses.length === 0,
    };

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.companyAddress.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }
      return tx.companyAddress.create({ data: payload });
    });
  }

  async updateAddress(companyId: string, addressId: string, data: Partial<CompanyAddressDto>) {
    await this.ensureCompany(companyId);

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw new NotFoundException(`Address ${addressId} was not found for this company.`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.companyAddress.updateMany({
          where: { companyId },
          data: { isDefault: false },
        });
      }
      return tx.companyAddress.update({
        where: { id: addressId },
        data: {
          addressLine1: data.addressLine1,
          addressLine2: data.addressLine2,
          city: data.city,
          postalCode: data.postalCode,
          instructions: data.instructions,
          isDefault: data.isDefault,
        },
      });
    });
  }

  async deleteAddress(companyId: string, addressId: string) {
    const company = await this.ensureCompany(companyId);

    if (company.addresses.length <= 1) {
      throw new BadRequestException('A company must retain at least one delivery address.');
    }

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw new NotFoundException(`Address ${addressId} was not found for this company.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.companyAddress.delete({ where: { id: addressId } });
      if (address.isDefault) {
        const replacement = await tx.companyAddress.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (replacement) {
          await tx.companyAddress.update({ where: { id: replacement.id }, data: { isDefault: true } });
        }
      }
    });
    return { deleted: true, addressId };
  }

  async updateWorkingDays(companyId: string, data: UpdateCompanyWorkingDaysDto) {
    await this.ensureCompany(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        mon: data.mon,
        tue: data.tue,
        wed: data.wed,
        thu: data.thu,
        fri: data.fri,
        sat: data.sat,
        sun: data.sun,
      },
      include: this.companyInclude,
    });
  }

  async addHoliday(companyId: string, data: CompanyHolidayDto) {
    await this.ensureCompany(companyId);
    const date = this.parseDateOnly(data.date);

    return this.prisma.companyHoliday.upsert({
      where: {
        companyId_date: {
          companyId,
          date,
        },
      },
      update: { name: data.name },
      create: {
        companyId,
        date,
        name: data.name,
      },
    });
  }

  async removeHoliday(companyId: string, date: string) {
    await this.ensureCompany(companyId);
    const parsedDate = this.parseDateOnly(date);

    const result = await this.prisma.companyHoliday.deleteMany({
      where: { companyId, date: parsedDate },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Holiday for ${date} was not found for this company.`);
    }

    return { companyId, date, removed: true };
  }

  async updateDefaults(companyId: string, data: UpdateCompanyDefaultsDto) {
    await this.ensureCompany(companyId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        defaultDeliveryTime: data.defaultDeliveryTime,
        deliveryLeadMinutes: data.deliveryLeadMinutes,
        defaultPackaging: data.defaultPackaging,
        standingInstructions: data.standingInstructions,
      },
      include: this.companyInclude,
    });
  }

  private parseDateOnly(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Holiday date must use YYYY-MM-DD format.');
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Holiday date must be a valid calendar date.');
    }
    return parsed;
  }

  async updatePriceTier(companyId: string, priceTierId: string) {
    await this.ensureCompany(companyId);
    await this.ensurePriceTierExists(priceTierId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { priceTierId },
      include: this.companyInclude,
    });
  }

  async updateDefaultDriver(companyId: string, defaultDriverId?: string) {
    await this.ensureCompany(companyId);
    await this.ensureDriverExists(defaultDriverId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { defaultDriverId: defaultDriverId || null },
      include: this.companyInclude,
    });
  }

  async getMenuVisibility(companyId: string) {
    await this.ensureCompany(companyId);
    const [categories, dishes, hiddenCategories, hiddenDishes] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, isSecret: true },
      }),
      this.prisma.dish.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, sku: true },
      }),
      this.prisma.companyHiddenCategory.findMany({
        where: { companyId },
        select: { categoryId: true },
      }),
      this.prisma.companyHiddenDish.findMany({
        where: { companyId },
        select: { dishId: true },
      }),
    ]);

    return {
      categories,
      dishes,
      hiddenCategoryIds: hiddenCategories.map((item) => item.categoryId),
      hiddenDishIds: hiddenDishes.map((item) => item.dishId),
    };
  }

  async updateMenuVisibility(
    companyId: string,
    data: UpdateCompanyMenuVisibilityDto,
  ) {
    await this.ensureCompany(companyId);
    const categoryIds = [...new Set(data.hiddenCategoryIds)];
    const dishIds = [...new Set(data.hiddenDishIds)];

    const [categories, dishes] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where: { id: { in: categoryIds }, isActive: true },
        select: { id: true },
      }),
      this.prisma.dish.findMany({
        where: { id: { in: dishIds }, isActive: true },
        select: { id: true },
      }),
    ]);

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException('One or more hidden categories are invalid or inactive.');
    }
    if (dishes.length !== dishIds.length) {
      throw new BadRequestException('One or more hidden dishes are invalid or inactive.');
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.companyHiddenCategory.deleteMany({ where: { companyId } });
      await transaction.companyHiddenDish.deleteMany({ where: { companyId } });
      if (categoryIds.length) {
        await transaction.companyHiddenCategory.createMany({
          data: categoryIds.map((categoryId) => ({ companyId, categoryId })),
        });
      }
      if (dishIds.length) {
        await transaction.companyHiddenDish.createMany({
          data: dishIds.map((dishId) => ({ companyId, dishId })),
        });
      }
    });

    return this.getMenuVisibility(companyId);
  }
}
