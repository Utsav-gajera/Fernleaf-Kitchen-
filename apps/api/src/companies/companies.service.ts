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

@Injectable()
export class CompaniesService {
  private readonly publicDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com']);

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

    if (!normalized || normalized.startsWith('@')) {
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
    const driver = await this.prisma.staffUser.findUnique({ where: { id } });
    if (driver?.role !== 'DRIVER') {
      throw new BadRequestException(`Default driver ${id} must be a valid driver account.`);
    }
  }

  private async ensureOwnerBelongsToCompany(companyId: string, ownerId?: string) {
    if (!ownerId) return;

    const employee = await this.prisma.employee.findUnique({ where: { id: ownerId } });

    if (employee?.companyId !== companyId) {
      throw new BadRequestException('Company owner must be an employee of the same company.');
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
        defaultDriverId: data.defaultDriverId,
        mon: data.mon ?? true,
        tue: data.tue ?? true,
        wed: data.wed ?? true,
        thu: data.thu ?? true,
        fri: data.fri ?? true,
        sat: data.sat ?? false,
        sun: data.sun ?? false,
        isActive: data.isActive ?? true,
      },
      include: this.companyInclude,
    });

    if (Array.isArray(data.domains)) {
      for (const domain of data.domains) {
        await this.addDomain(company.id, domain);
      }
    }

    if (Array.isArray(data.addresses)) {
      for (const address of data.addresses) {
        await this.addAddress(company.id, address);
      }
    }

    if (Array.isArray(data.holidays)) {
      for (const holiday of data.holidays) {
        await this.addHoliday(company.id, holiday);
      }
    }

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

    const updated = await this.prisma.company.update({
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
      include: this.companyInclude,
    });

    return updated;
  }

  async addDomain(companyId: string, domain: string) {
    const normalized = this.validateDomain(domain);

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
    const result = await this.prisma.companyDomain.deleteMany({
      where: { companyId, domain: normalized },
    });

    if (result.count === 0) {
      throw new NotFoundException(`Domain '${normalized}' was not found for this company.`);
    }

    return { companyId, domain: normalized, removed: true };
  }

  async addAddress(companyId: string, data: CompanyAddressDto) {
    await this.ensureCompany(companyId);

    const payload = {
      companyId,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      city: data.city,
      postalCode: data.postalCode,
      instructions: data.instructions,
      isDefault: data.isDefault ?? false,
    };

    if (data.isDefault) {
      await this.prisma.companyAddress.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    return this.prisma.companyAddress.create({ data: payload });
  }

  async updateAddress(companyId: string, addressId: string, data: Partial<CompanyAddressDto>) {
    await this.ensureCompany(companyId);

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw new NotFoundException(`Address ${addressId} was not found for this company.`);
    }

    if (data.isDefault) {
      await this.prisma.companyAddress.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    return this.prisma.companyAddress.update({
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
  }

  async deleteAddress(companyId: string, addressId: string) {
    await this.ensureCompany(companyId);

    const address = await this.prisma.companyAddress.findFirst({
      where: { id: addressId, companyId },
    });

    if (!address) {
      throw new NotFoundException(`Address ${addressId} was not found for this company.`);
    }

    await this.prisma.companyAddress.delete({ where: { id: addressId } });
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
    const date = new Date(data.date);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Holiday date must be a valid ISO date.');
    }

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
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Holiday date must be a valid ISO date.');
    }

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

  async updatePriceTier(companyId: string, priceTierId: string) {
    await this.ensureCompany(companyId);
    await this.ensurePriceTierExists(priceTierId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { priceTierId },
      include: this.companyInclude,
    });
  }

  async updateDefaultDriver(companyId: string, defaultDriverId: string) {
    await this.ensureCompany(companyId);
    await this.ensureDriverExists(defaultDriverId);

    return this.prisma.company.update({
      where: { id: companyId },
      data: { defaultDriverId },
      include: this.companyInclude,
    });
  }
}
