import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  private readonly publicDomains = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  private readonly employeeInclude = {
    company: true,
    allergies: { include: { allergen: true } },
    dietaryPreferences: { include: { dietaryTag: true } },
  };

  private async validateEmail(email: string, companyId: string) {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      throw new BadRequestException('Please provide a valid email address.');
    }

    if (this.publicDomains.has(domain)) {
      throw new BadRequestException(`Public email domain '${domain}' is not allowed.`);
    }
    const claimed = await this.prisma.companyDomain.findFirst({
      where: { companyId, domain },
      select: { id: true },
    });
    if (!claimed) {
      throw new BadRequestException(`Email domain '${domain}' is not claimed by the selected company.`);
    }
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException(`Company ${companyId} was not found.`);
    }
  }

  async findAll(page = 1, limit = 10) {
    const safePage = Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        include: this.employeeInclude,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count(),
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
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: this.employeeInclude,
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} was not found.`);
    }

    return employee;
  }

  async create(data: CreateEmployeeDto) {
    await this.ensureCompanyExists(data.companyId);
    await this.validateEmail(data.email, data.companyId);
    const allergies = data.allergies?.length ? await this.resolveAllergies(data.allergies) : [];
    const dietaryTags = data.dietaryPreferences?.length
      ? await this.resolveDietaryTags(data.dietaryPreferences)
      : [];
    try {
      return await this.prisma.employee.create({
        data: {
          companyId: data.companyId,
          name: data.name,
          email: data.email.toLowerCase(),
          canChooseDeliveryAddress: data.canChooseDeliveryAddress ?? false,
          canChangeDeliveryTime: data.canChangeDeliveryTime ?? false,
          canChangePackaging: data.canChangePackaging ?? false,
          allergies: { create: allergies },
          dietaryPreferences: { create: dietaryTags },
        },
        include: this.employeeInclude,
      });
    } catch (error) {
      this.rethrowUniqueEmail(error, data.email);
    }
  }

  async update(id: string, data: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} was not found.`);
    }

    if (data.companyId) {
      await this.ensureCompanyExists(data.companyId);
    }

    if (data.email || data.companyId) {
      await this.validateEmail(data.email ?? employee.email, data.companyId ?? employee.companyId);
    }

    const allergies = data.allergies ? await this.resolveAllergies(data.allergies) : undefined;
    const dietaryTags = data.dietaryPreferences
      ? await this.resolveDietaryTags(data.dietaryPreferences)
      : undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        if (data.companyId && data.companyId !== employee.companyId) {
          await tx.company.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
        }
        await tx.employee.update({
          where: { id },
          data: {
            companyId: data.companyId,
            name: data.name,
            email: data.email?.toLowerCase(),
            canChooseDeliveryAddress: data.canChooseDeliveryAddress,
            canChangeDeliveryTime: data.canChangeDeliveryTime,
            canChangePackaging: data.canChangePackaging,
          },
        });
        if (allergies) {
          await tx.employeeAllergen.deleteMany({ where: { employeeId: id } });
          if (allergies.length) {
            await tx.employeeAllergen.createMany({
              data: allergies.map((entry) => ({ employeeId: id, allergenId: entry.allergenId })),
            });
          }
        }
        if (dietaryTags) {
          await tx.employeeDietaryTag.deleteMany({ where: { employeeId: id } });
          if (dietaryTags.length) {
            await tx.employeeDietaryTag.createMany({
              data: dietaryTags.map((entry) => ({ employeeId: id, dietaryTagId: entry.dietaryTagId })),
            });
          }
        }
      });
    } catch (error) {
      this.rethrowUniqueEmail(error, data.email ?? employee.email);
    }

    return this.findOne(id);
  }

  private async resolveAllergies(names: string[]) {
    const resolved: { allergenId: string }[] = [];

    for (const name of names) {
      const allergen = await this.prisma.allergen.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      resolved.push({ allergenId: allergen.id });
    }

    return resolved;
  }

  private async resolveDietaryTags(names: string[]) {
    const resolved: { dietaryTagId: string }[] = [];

    for (const name of names) {
      const dietaryTag = await this.prisma.dietaryTag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      resolved.push({ dietaryTagId: dietaryTag.id });
    }

    return resolved;
  }

  private rethrowUniqueEmail(error: unknown, email: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException(`Employee email '${email.toLowerCase()}' is already in use.`);
    }
    throw error;
  }
}
