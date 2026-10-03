import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { Role } from '@project/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
import { PricingService } from '../pricing/pricing.service';
import {
  CombinationValidationError,
  CombinationValidator,
} from './domain/combination-validator';
import {
  CompanyCalendarService,
  CutoffCalculator,
  KitchenCalendarService,
} from './domain/cutoff-calculator';
import { OrderPolicy } from './domain/order-policy';
import { OrderStateMachine } from './domain/order-state-machine';
import {
  CreateOrderDto,
  OrderAddressDto,
  OrderLineDto,
  OrderListQueryDto,
  UpdateOrderDto,
} from './dto/order.dto';
import { KitchenService } from '../kitchen/kitchen.service';

@Injectable()
export class OrdersService {
  private readonly combinationValidator = new CombinationValidator();
  private readonly orderPolicy = new OrderPolicy();
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
    private readonly pricingService: PricingService,
    @Optional() private readonly kitchenService?: KitchenService,
  ) {}

  async findAll(query: OrderListQueryDto) {
    if (
      query.deliveryFrom &&
      query.deliveryTo &&
      new Date(query.deliveryFrom).getTime() > new Date(query.deliveryTo).getTime()
    ) {
      throw new BadRequestException('deliveryFrom must not be after deliveryTo.');
    }
    const where: Prisma.OrderWhereInput = {
      status: query.status as OrderStatus | undefined,
      companyId: query.companyId,
      invoiced: query.invoiced,
      deliveryDate: {
        gte: query.deliveryFrom ? new Date(query.deliveryFrom) : undefined,
        lte: query.deliveryTo ? new Date(query.deliveryTo) : undefined,
      },
    };
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { deliveryDate: 'asc' },
        include: { company: true, employee: true },
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) || 1 };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        company: true,
        employee: true,
        lines: { include: { combinations: { include: { options: true } } } },
        timelineEvents: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    return order;
  }

  async getNextDeliveryDate(employeeId: string) {
    const employee = await this.loadEmployee(employeeId);
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      throw new BadRequestException('Kitchen cutoff settings are not configured.');
    }
    const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
    const kitchenCalendar = new KitchenCalendarService(
      kitchenHolidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
      settings,
    );
    const cutoff = new CutoffCalculator({
      kitchenTimeZone: settings.kitchenTimeZone,
      cutOffTime: settings.cutOffTime,
      cutOffWorkingDays: settings.cutOffWorkingDays,
      kitchenCalendar,
      clock: { now: () => new Date() },
    });
    const companyCalendar = new CompanyCalendarService(
      {
        mon: employee.company.mon,
        tue: employee.company.tue,
        wed: employee.company.wed,
        thu: employee.company.thu,
        fri: employee.company.fri,
        sat: employee.company.sat,
        sun: employee.company.sun,
      },
      employee.company.holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
    );
    const cursor = new Date();
    for (let offset = 1; offset <= 90; offset += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const date = cursor.toISOString().slice(0, 10);
      if (
        companyCalendar.canReceiveDelivery(date) &&
        !cutoff.isPastCutoff(new Date(`${date}T00:00:00.000Z`))
      ) {
        return { date };
      }
    }
    throw new BadRequestException('No orderable delivery date is available.');
  }

  async create(data: CreateOrderDto, user: { role: Role; id: string }) {
    const employee = await this.loadEmployee(data.employeeId);
    const orderInput = await this.prepareOrder(data, employee, this.orderPolicy.canOverride(user.role === Role.ADMIN));
    const status = data.place ? OrderStatus.PLACED : OrderStatus.DRAFT;
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          ...orderInput,
          status,
          createdByStaffId: user.id,
          timelineEvents: { create: { status, note: 'Order created' } },
        },
      });
      return order;
    });
    return this.findOne(created.id);
  }

  async update(id: string, data: UpdateOrderDto, user: { role: Role }) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: {
        employee: true,
        lines: { include: { combinations: { include: { options: true } } } },
        invoiceOrders: { include: { invoice: { select: { status: true } } } },
      },
    });
    if (!existing) throw new NotFoundException(`Order ${id} was not found.`);
    const afterCutoff = await this.isAfterCutoff(existing.deliveryDate, existing.employee.companyId);
    if (!this.orderPolicy.canEdit(existing.status, afterCutoff, user.role === Role.ADMIN)) {
      throw new ForbiddenException('Order cannot be edited after cutoff.');
    }
    if (data.lines || data.packaging) {
      const invoice = existing.invoiceOrders[0]?.invoice;
      if (invoice?.status === 'PAID') {
        throw new ForbiddenException('Orders on paid invoices are financially immutable.');
      }
      if (invoice?.status === 'UNPAID') {
        throw new BadRequestException('Remove the order from its unpaid invoice before changing financial values.');
      }
    }
    if (!data.lines) {
      const employee = await this.loadEmployee(existing.employeeId);
      if (data.address && !employee.canChooseDeliveryAddress && user.role !== Role.ADMIN) {
        throw new ForbiddenException('Employee cannot choose delivery address.');
      }
      if (data.deliveryTime && !employee.canChangeDeliveryTime && user.role !== Role.ADMIN) {
        throw new ForbiddenException('Employee cannot change delivery time.');
      }
      if (data.packaging && !employee.canChangePackaging && user.role !== Role.ADMIN) {
        throw new ForbiddenException('Employee cannot change packaging.');
      }
      if (data.deliveryDate) {
        await this.validateDeliveryDate(
          new Date(data.deliveryDate),
          employee,
          this.orderPolicy.canOverride(user.role === Role.ADMIN),
        );
      }
      const address = data.address ? this.resolveAddress(data.address, employee) : {};
      await this.prisma.order.update({
        where: { id },
        data: {
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
          deliveryTime: data.deliveryTime,
          packaging: data.packaging,
          ...address,
        },
      });
      return this.findOne(id);
    }

    const employee = await this.loadEmployee(existing.employeeId);
    const input: CreateOrderDto = {
      employeeId: existing.employeeId,
      deliveryDate: data.deliveryDate ?? existing.deliveryDate.toISOString(),
      deliveryTime: data.deliveryTime ?? existing.deliveryTime,
      address: data.address ?? {
        addressLine1: existing.addressLine1,
        addressLine2: existing.addressLine2 ?? undefined,
        city: existing.city,
        postalCode: existing.postalCode,
        instructions: existing.addressInstructions ?? undefined,
      },
      packaging: data.packaging,
      lines: data.lines,
      place: false,
    };
    const orderInput = await this.prepareOrder(input, employee, this.orderPolicy.canOverride(user.role === Role.ADMIN));
    await this.prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId: id } });
      await tx.order.update({
        where: { id },
        data: { ...orderInput, lines: undefined },
      });
      for (const line of orderInput.lines?.create ?? []) {
        await tx.orderLine.create({ data: { ...line, orderId: id } });
      }
    });
    return this.findOne(id);
  }

  async place(id: string, user: { role: Role }) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { employee: true } });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    const afterCutoff = await this.isAfterCutoff(order.deliveryDate, order.employee.companyId);
    if (!this.orderPolicy.canEdit(order.status, afterCutoff, user.role === Role.ADMIN)) {
      throw new ForbiddenException('Order cannot be placed after cutoff.');
    }
    try {
      this.stateMachine.assertCanPlace(order.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Order cannot be placed.');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: OrderStatus.DRAFT },
        data: { status: OrderStatus.PLACED },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Order state changed before it could be placed.');
      }
      await tx.orderTimelineEvent.create({ data: { orderId: id, status: OrderStatus.PLACED } });
    });
    return this.findOne(id);
  }

  async cancel(id: string, user: { role: Role }) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { employee: true } });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    const afterCutoff = await this.isAfterCutoff(order.deliveryDate, order.employee.companyId);
    if (!this.orderPolicy.canCancel(order.status, afterCutoff, user.role === Role.ADMIN)) {
      throw new ForbiddenException('Order cannot be cancelled.');
    }
    try {
      this.stateMachine.assertCanCancel(order.status);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Order cannot be cancelled.');
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: { in: [OrderStatus.DRAFT, OrderStatus.PLACED] } },
        data: { status: OrderStatus.CANCELLED },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Order state changed before it could be cancelled.');
      }
      await tx.orderTimelineEvent.create({ data: { orderId: id, status: OrderStatus.CANCELLED } });
    });
    return this.findOne(id);
  }

  async forceComplete(id: string, user: { role: Role }) {
    if (!this.kitchenService) throw new BadRequestException('Kitchen service is not configured.');
    return this.kitchenService.forceCompleteOrder(id, user.role);
  }

  private async prepareOrder(
    data: CreateOrderDto,
    employee: Awaited<ReturnType<OrdersService['loadEmployee']>>,
    isAdmin = false,
  ) {
    const deliveryDate = new Date(data.deliveryDate);
    if (!employee.company.isActive) throw new BadRequestException('Company is inactive.');
    await this.validateDeliveryDate(deliveryDate, employee, isAdmin);
    const menu = await this.menuService.getMenuForEmployee(employee.id);
    const available = new Map(menu.menu.categories.flatMap((category) => category.dishes.map((dish) => [dish.id, dish])));
    const address = this.resolveAddress(data.address, employee);
    const deliveryTime = data.deliveryTime ?? employee.company.defaultDeliveryTime;
    const packaging = data.packaging ?? employee.company.defaultPackaging;
    if (data.address && !employee.canChooseDeliveryAddress && !isAdmin) throw new ForbiddenException('Employee cannot choose delivery address.');
    if (data.deliveryTime && !employee.canChangeDeliveryTime && !isAdmin) throw new ForbiddenException('Employee cannot change delivery time.');
    if (data.packaging && !employee.canChangePackaging && !isAdmin) throw new ForbiddenException('Employee cannot change packaging.');
    const lines = [];
    let subtotalMinor = 0;
    for (const line of data.lines) {
      const dish = available.get(line.dishId);
      if (!dish) throw new BadRequestException(`Dish ${line.dishId} is unavailable for this employee.`);
      const groups = dish.optionGroups.map((group) => ({
        id: group.id, isRequired: group.isRequired, allowPortions: group.allowPortions, optionIds: group.options.map((option) => option.id),
      }));
      try {
        this.combinationValidator.validate({ lineQuantity: line.quantity, minimumOrderQuantity: dish.minQuantity, optionGroups: groups, combinations: line.combinations });
      } catch (error) {
        if (error instanceof CombinationValidationError) {
          throw new BadRequestException({ code: error.code, message: error.message });
        }
        throw error;
      }
      const combinations = line.combinations.map((combination) => {
        let optionTotal = 0;
        const options = combination.selections.map((selection) => {
          const group = dish.optionGroups.find((candidate) => candidate.id === selection.optionGroupId);
          const option = group?.options.find((candidate) => candidate.id === selection.optionId);
          if (!option) throw new BadRequestException(`Option ${selection.optionId} is unavailable.`);
          optionTotal += option.effectivePriceMinor;
          return { optionId: option.id, optionNameSnapshot: option.name, optionPriceMinor: option.effectivePriceMinor };
        });
        const lineTotal = (dish.priceMinor + optionTotal) * combination.quantity;
        subtotalMinor += lineTotal;
        return {
          optionGroupId: combination.selections.length === 1 ? combination.selections[0].optionGroupId : null,
          optionGroupNameSnapshot: combination.selections
            .map((selection) => dish.optionGroups.find((group) => group.id === selection.optionGroupId)?.name)
            .filter((name): name is string => Boolean(name))
            .join(', '),
          quantity: combination.quantity,
          totalMinor: lineTotal,
          options: { create: options },
        };
      });
      lines.push({
        dishId: dish.id,
        dishNameSnapshot: dish.name,
        skuSnapshot: dish.sku,
        dishUnitPriceMinor: dish.priceMinor,
        quantity: line.quantity,
        totalMinor: combinations.reduce((sum, item) => sum + item.totalMinor, 0),
        combinations: {
          create: combinations.map((combination) => ({
            optionGroupId: combination.optionGroupId,
            optionGroupNameSnapshot: combination.optionGroupNameSnapshot,
            quantity: combination.quantity,
            totalMinor: combination.totalMinor,
            options: combination.options,
          })),
        },
      });
    }
    return {
      companyId: employee.companyId,
      employeeId: employee.id,
      ...address,
      deliveryDate,
      deliveryTime,
      packaging,
      subtotalMinor,
      deliveryFeeMinor: 0,
      taxMinor: 0,
      totalMinor: subtotalMinor,
      lines: { create: lines },
    };
  }

  private async validateDeliveryDate(
    deliveryDate: Date,
    employee: Awaited<ReturnType<OrdersService['loadEmployee']>>,
    isAdmin: boolean,
  ) {
    if (Number.isNaN(deliveryDate.getTime())) {
      throw new BadRequestException('Delivery date must be valid.');
    }
    const companyDate = deliveryDate.toISOString().slice(0, 10);
    const companyDays = {
      mon: employee.company.mon, tue: employee.company.tue, wed: employee.company.wed,
      thu: employee.company.thu, fri: employee.company.fri, sat: employee.company.sat, sun: employee.company.sun,
    };
    const companyCalendar = new CompanyCalendarService(
      companyDays,
      employee.company.holidays.map((holiday: { date: Date }) => holiday.date.toISOString().slice(0, 10)),
    );
    if (!companyCalendar.canReceiveDelivery(companyDate)) {
      throw new BadRequestException('Company cannot receive delivery on this date.');
    }
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (settings) {
      const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
      const cutoff = new CutoffCalculator({
        kitchenTimeZone: settings.kitchenTimeZone,
        cutOffTime: settings.cutOffTime,
        cutOffWorkingDays: settings.cutOffWorkingDays,
        kitchenCalendar: new KitchenCalendarService(kitchenHolidays.map((holiday) => holiday.date.toISOString().slice(0, 10)), settings),
        clock: { now: () => new Date() },
      });
      if (cutoff.isPastCutoff(deliveryDate) && !isAdmin) {
        throw new BadRequestException('Order cutoff has passed.');
      }
    }
  }

  private resolveAddress(address: OrderAddressDto | undefined, employee: Awaited<ReturnType<OrdersService['loadEmployee']>>) {
    const source = address ?? employee.company.addresses.find((item) => item.isDefault) ?? employee.company.addresses[0];
    if (!source) throw new BadRequestException('A delivery address is required.');
    return { addressLine1: source.addressLine1, addressLine2: source.addressLine2 ?? null, city: source.city, postalCode: source.postalCode, addressInstructions: 'instructions' in source ? source.instructions ?? null : null };
  }

  private async loadEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: { company: { include: { addresses: true, holidays: true } } } });
    if (!employee) throw new NotFoundException(`Employee ${id} was not found.`);
    return employee;
  }

  private async isAfterCutoff(deliveryDate: Date, companyId: string) {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (!settings) return false;
    const holidays = await this.prisma.kitchenHoliday.findMany();
    return new CutoffCalculator({
      kitchenTimeZone: settings.kitchenTimeZone,
      cutOffTime: settings.cutOffTime,
      cutOffWorkingDays: settings.cutOffWorkingDays,
      kitchenCalendar: new KitchenCalendarService(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)), settings),
      clock: { now: () => new Date() },
    }).isPastCutoff(deliveryDate);
  }
}
