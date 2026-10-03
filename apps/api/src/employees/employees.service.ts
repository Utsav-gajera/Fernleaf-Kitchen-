import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  private readonly publicDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com']);

  constructor(private readonly prisma: PrismaService) {}

  private readonly employeeInclude = {
    company: true,
    allergies: { include: { allergen: true } },
    dietaryPreferences: { include: { dietaryTag: true } },
  };

  private validateEmail(email: string) {
    const domain = email.split('@')[1]?.toLowerCase();

    if (!domain) {
      throw new BadRequestException('Please provide a valid email address.');
    }

    if (this.publicDomains.has(domain)) {
      throw new BadRequestException(`Public email domain '${domain}' is not allowed.`);
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
    this.validateEmail(data.email);

    const employee = await this.prisma.employee.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        email: data.email,
        canChooseDeliveryAddress: data.canChooseDeliveryAddress ?? false,
        canChangeDeliveryTime: data.canChangeDeliveryTime ?? false,
        canChangePackaging: data.canChangePackaging ?? false,
      },
      include: this.employeeInclude,
    });

    if (data.allergies?.length) {
      await this.prisma.employeeAllergen.createMany({
        data: (await this.resolveAllergies(data.allergies)).map((entry) => ({
          employeeId: employee.id,
          allergenId: entry.allergenId,
        })),
      });
    }

    if (data.dietaryPreferences?.length) {
      await this.prisma.employeeDietaryTag.createMany({
        data: (await this.resolveDietaryTags(data.dietaryPreferences)).map((entry) => ({
          employeeId: employee.id,
          dietaryTagId: entry.dietaryTagId,
        })),
      });
    }

    return this.findOne(employee.id);
  }

  async update(id: string, data: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({ where: { id } });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} was not found.`);
    }

    if (data.companyId) {
      await this.ensureCompanyExists(data.companyId);
    }

    if (data.email) {
      this.validateEmail(data.email);
    }

    if (data.companyId || data.name || data.email || data.canChooseDeliveryAddress !== undefined || data.canChangeDeliveryTime !== undefined || data.canChangePackaging !== undefined) {
      await this.prisma.employee.update({
        where: { id },
        data: {
          companyId: data.companyId,
          name: data.name,
          email: data.email,
          canChooseDeliveryAddress: data.canChooseDeliveryAddress,
          canChangeDeliveryTime: data.canChangeDeliveryTime,
          canChangePackaging: data.canChangePackaging,
        },
      });
    }

    if (data.allergies) {
      await this.prisma.employeeAllergen.deleteMany({ where: { employeeId: id } });
      await this.prisma.employeeAllergen.createMany({
        data: (await this.resolveAllergies(data.allergies)).map((entry) => ({
          employeeId: id,
          allergenId: entry.allergenId,
        })),
      });
    }

    if (data.dietaryPreferences) {
      await this.prisma.employeeDietaryTag.deleteMany({ where: { employeeId: id } });
      await this.prisma.employeeDietaryTag.createMany({
        data: (await this.resolveDietaryTags(data.dietaryPreferences)).map((entry) => ({
          employeeId: id,
          dietaryTagId: entry.dietaryTagId,
        })),
      });
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
}
