import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DropStatus, OrderStatus, Prisma } from '@prisma/client';
import { Permission, Role } from '@project/shared';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from '../menu/menu.service';
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
  CorrectOrderTotalDto,
  OrderAddressDto,
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
    private readonly authorizationService: AuthorizationService,
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
        lt: query.deliveryTo ? this.nextDateOnly(query.deliveryTo) : undefined,
      },
      ...(query.search?.trim()
        ? {
            OR: [
              { id: { contains: query.search.trim(), mode: 'insensitive' } },
              { company: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
              { employee: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
              { employee: { email: { contains: query.search.trim(), mode: 'insensitive' } } },
            ],
          }
        : {}),
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
    const kitchenToday = this.kitchenToday(settings.kitchenTimeZone);
    const cursor = new Date(`${kitchenToday}T00:00:00.000Z`);
    for (let offset = 1; offset <= 90; offset += 1) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const date = cursor.toISOString().slice(0, 10);
      if (
        companyCalendar.canReceiveDelivery(date) &&
        !cutoff.isPastCutoff(this.dateOnlyAtKitchenNoon(date, settings.kitchenTimeZone))
      ) {
        return { date };
      }
    }
    throw new BadRequestException('No orderable delivery date is available.');
  }

  async create(data: CreateOrderDto, user: { role: Role; id: string }) {
    const employee = await this.loadEmployee(data.employeeId);
    const orderInput = await this.prepareOrder(data, employee, this.canOverride(user.role));
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
        dropOrders: { include: { drop: true } },
      },
    });
    if (!existing) throw new NotFoundException(`Order ${id} was not found.`);
    const existingDrop = existing.dropOrders[0]?.drop;
    const groupingChangeRequested = this.groupingChangeRequested(existing, data);
    if (groupingChangeRequested && existingDrop && existingDrop.status !== DropStatus.KITCHEN_READY) {
      throw new BadRequestException('Order delivery details cannot change after dispatch has begun.');
    }
    const hasOverridePermission = this.canOverride(user.role);
    const afterCutoff = await this.isAfterCutoff(existing.deliveryDate);
    const ordinaryEdit = this.orderPolicy.canEdit(existing.status, afterCutoff, hasOverridePermission);
    const deliveryOverride = this.orderPolicy.canOverrideDelivery(existing.status, hasOverridePermission);
    if (!ordinaryEdit && !deliveryOverride) {
      throw new ForbiddenException('Order cannot be edited after cutoff.');
    }
    if (deliveryOverride && (data.lines || data.deliveryDate)) {
      throw new BadRequestException(
        'After confirmation, admins may override only delivery time, address, or packaging.',
      );
    }
    if (data.lines) {
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
      if (data.address && !employee.canChooseDeliveryAddress && !this.canOverride(user.role)) {
        throw new ForbiddenException('Employee cannot choose delivery address.');
      }
      if (data.deliveryTime && !employee.canChangeDeliveryTime && !this.canOverride(user.role)) {
        throw new ForbiddenException('Employee cannot change delivery time.');
      }
      if (data.packaging && !employee.canChangePackaging && !this.canOverride(user.role)) {
        throw new ForbiddenException('Employee cannot change packaging.');
      }
      if (data.deliveryDate) {
        await this.validateDeliveryDate(new Date(data.deliveryDate), employee);
      }
      const address = data.address ? this.resolveAddress(data.address, employee) : {};
      await this.prisma.$transaction(async (tx) => {
        if (groupingChangeRequested) {
          await this.detachFromKitchenReadyDrop(tx, id, existingDrop);
        }
        await tx.order.update({
          where: { id },
          data: {
            deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
            deliveryTime: data.deliveryTime,
            packaging: data.packaging ?? existing.packaging,
            ...address,
          },
        });
        if (deliveryOverride && data.deliveryTime && this.kitchenService) {
          await this.kitchenService.rescheduleOrder(tx, id);
        }
        if (deliveryOverride) {
          await tx.orderTimelineEvent.create({
            data: {
              orderId: id,
              status: existing.status,
              note: 'Delivery details overridden by admin',
            },
          });
        }
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
    const orderInput = await this.prepareOrder(input, employee, this.canOverride(user.role));
    await this.prisma.$transaction(async (tx) => {
      if (groupingChangeRequested) {
        await this.detachFromKitchenReadyDrop(tx, id, existingDrop);
      }
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

  private groupingChangeRequested(
    existing: {
      addressLine1: string;
      addressLine2: string | null;
      city: string;
      postalCode: string;
      deliveryTime: string;
      deliveryDate: Date;
    },
    data: UpdateOrderDto,
  ) {
    const address = data.address;
    return Boolean(
      (data.deliveryDate &&
        new Date(data.deliveryDate).toISOString().slice(0, 10) !==
          existing.deliveryDate.toISOString().slice(0, 10)) ||
      (data.deliveryTime && data.deliveryTime !== existing.deliveryTime) ||
      (address &&
        (address.addressLine1 !== existing.addressLine1 ||
          (address.addressLine2 ?? null) !== existing.addressLine2 ||
          address.city !== existing.city ||
          address.postalCode !== existing.postalCode)),
    );
  }

  private async detachFromKitchenReadyDrop(
    tx: Prisma.TransactionClient,
    orderId: string,
    drop: { id: string; status: DropStatus } | undefined,
  ) {
    if (!drop) return;
    if (drop.status !== DropStatus.KITCHEN_READY) {
      throw new BadRequestException('Order delivery details cannot change after dispatch has begun.');
    }
    await tx.dropOrder.deleteMany({ where: { orderId, dropId: drop.id } });
    await tx.drop.deleteMany({
      where: { id: drop.id, status: DropStatus.KITCHEN_READY, orders: { none: {} } },
    });
  }

  async place(id: string, user: { role: Role }) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { employee: true } });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    const afterCutoff = await this.isAfterCutoff(order.deliveryDate);
    if (!this.orderPolicy.canEdit(order.status, afterCutoff, this.canOverride(user.role))) {
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
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        employee: true,
        invoiceOrders: { include: { invoice: { select: { status: true } } } },
        dropOrders: { include: { drop: true } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    const afterCutoff = await this.isAfterCutoff(order.deliveryDate);
    const hasOverridePermission = this.canOverride(user.role);
    if (!this.orderPolicy.canCancel(order.status, afterCutoff, hasOverridePermission)) {
      throw new ForbiddenException('Order cannot be cancelled.');
    }
    if (!hasOverridePermission || ([OrderStatus.DRAFT, OrderStatus.PLACED] as OrderStatus[]).includes(order.status)) {
      try {
        this.stateMachine.assertCanCancel(order.status);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Order cannot be cancelled.');
      }
    }
    const invoice = order.invoiceOrders[0]?.invoice;
    if (invoice?.status === 'PAID') {
      throw new ForbiddenException('Orders on paid invoices are financially immutable.');
    }
    if (invoice?.status === 'UNPAID') {
      throw new BadRequestException('Remove the order from its unpaid invoice before cancelling it.');
    }
    await this.prisma.$transaction(async (tx) => {
      const drop = order.dropOrders[0]?.drop;
      if (drop) {
        await this.detachFromKitchenReadyDrop(tx, id, drop);
      }
      await tx.kitchenUnit.deleteMany({ where: { orderId: id } });
      const updated = await tx.order.updateMany({
        where: { id, status: order.status },
        data: { status: OrderStatus.CANCELLED, billable: false },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Order state changed before it could be cancelled.');
      }
      await tx.orderTimelineEvent.create({ data: { orderId: id, status: OrderStatus.CANCELLED } });
    });
    return this.findOne(id);
  }

  async forceComplete(id: string) {
    if (!this.kitchenService) throw new BadRequestException('Kitchen service is not configured.');
    return this.kitchenService.forceCompleteOrder(id);
  }

  async correctTotal(id: string, data: CorrectOrderTotalDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        lines: { select: { id: true, skuSnapshot: true, totalMinor: true } },
        invoiceOrders: { include: { invoice: { select: { status: true } } } },
      },
    });
    if (!order) throw new NotFoundException(`Order ${id} was not found.`);
    if (!([OrderStatus.CONFIRMED, OrderStatus.KITCHEN_IN_PROGRESS, OrderStatus.KITCHEN_READY,
      OrderStatus.DISPATCH_READY, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED] as OrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Only confirmed or fulfilled orders can receive a total correction.');
    }
    const invoice = order.invoiceOrders[0]?.invoice;
    if (invoice?.status === 'PAID') {
      throw new ForbiddenException('Orders on paid invoices are financially immutable.');
    }
    if (invoice?.status === 'UNPAID') {
      throw new BadRequestException('Remove the order from its unpaid invoice before correcting its total.');
    }
    const normalTotal = order.lines
      .filter((line) => line.skuSnapshot !== 'INTERNAL-ADJUSTMENT')
      .reduce((sum, line) => sum + line.totalMinor, 0);
    if (data.correctedTotalMinor > normalTotal) {
      throw new BadRequestException('A short-delivery correction cannot increase the original order total.');
    }
    const adjustmentMinor = data.correctedTotalMinor - normalTotal;
    await this.prisma.$transaction(async (tx) => {
      await tx.orderLine.deleteMany({ where: { orderId: id, skuSnapshot: 'INTERNAL-ADJUSTMENT' } });
      if (adjustmentMinor !== 0) {
        await tx.orderLine.create({
          data: {
            orderId: id,
            dishNameSnapshot: 'Delivery shortfall adjustment',
            skuSnapshot: 'INTERNAL-ADJUSTMENT',
            dishUnitPriceMinor: adjustmentMinor,
            quantity: 1,
            totalMinor: adjustmentMinor,
            combinations: {
              create: {
                optionGroupNameSnapshot: data.reason.trim(),
                quantity: 1,
                totalMinor: adjustmentMinor,
              },
            },
          },
        });
      }
      await tx.order.update({
        where: { id },
        data: { subtotalMinor: data.correctedTotalMinor, totalMinor: data.correctedTotalMinor },
      });
      await tx.orderTimelineEvent.create({
        data: {
          orderId: id,
          status: order.status,
          note: `Admin corrected total to ${data.correctedTotalMinor} minor units: ${data.reason.trim()}`,
        },
      });
    });
    return this.findOne(id);
  }

  private async prepareOrder(
    data: CreateOrderDto,
    employee: Awaited<ReturnType<OrdersService['loadEmployee']>>,
    hasOverridePermission = false,
  ) {
    const deliveryDate = new Date(data.deliveryDate);
    if (!employee.company.isActive) throw new BadRequestException('Company is inactive.');
    await this.validateDeliveryDate(deliveryDate, employee);
    const menu = await this.menuService.getMenuForEmployee(employee.id);
    const available = new Map(menu.menu.categories.flatMap((category) => category.dishes.map((dish) => [dish.id, dish])));
    const address = this.resolveAddress(data.address, employee);
    const deliveryTime = data.deliveryTime ?? employee.company.defaultDeliveryTime;
    const packaging = data.packaging ?? employee.company.defaultPackaging;
    if (data.address && !employee.canChooseDeliveryAddress && !hasOverridePermission) throw new ForbiddenException('Employee cannot choose delivery address.');
    if (data.deliveryTime && !employee.canChangeDeliveryTime && !hasOverridePermission) throw new ForbiddenException('Employee cannot change delivery time.');
    if (data.packaging && !employee.canChangePackaging && !hasOverridePermission) throw new ForbiddenException('Employee cannot change packaging.');
    const lines = [];
    let subtotalMinor = 0;
    for (const line of data.lines) {
      const dish = available.get(line.dishId);
      if (!dish) throw new BadRequestException(`Dish ${line.dishId} is unavailable for this employee.`);
      const groups = dish.optionGroups.map((group) => ({
        id: group.id, isRequired: group.isRequired, optionIds: group.options.map((option) => option.id),
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
    const kitchenTimeZone = settings?.kitchenTimeZone ?? 'UTC';
    const currentKitchenDate = this.kitchenToday(kitchenTimeZone);
    if (companyDate < currentKitchenDate) {
      throw new BadRequestException('Delivery date cannot be before the current kitchen date.');
    }
    if (settings) {
      const kitchenHolidays = await this.prisma.kitchenHoliday.findMany();
      const cutoff = new CutoffCalculator({
        kitchenTimeZone: settings.kitchenTimeZone,
        cutOffTime: settings.cutOffTime,
        cutOffWorkingDays: settings.cutOffWorkingDays,
        kitchenCalendar: new KitchenCalendarService(kitchenHolidays.map((holiday) => holiday.date.toISOString().slice(0, 10)), settings),
        clock: { now: () => new Date() },
      });
      if (cutoff.isPastCutoff(this.dateOnlyAtKitchenNoon(companyDate, settings.kitchenTimeZone))) {
        throw new BadRequestException('Order cutoff has passed.');
      }
    }
  }

  private resolveAddress(address: OrderAddressDto | undefined, employee: Awaited<ReturnType<OrdersService['loadEmployee']>>) {
    const source = address ?? employee.company.addresses.find((item) => item.isDefault) ?? employee.company.addresses[0];
    if (!source) throw new BadRequestException('A delivery address is required.');
    return { addressLine1: source.addressLine1, addressLine2: source.addressLine2 ?? null, city: source.city, postalCode: source.postalCode, addressInstructions: 'instructions' in source ? source.instructions ?? null : null };
  }

  private canOverride(role: Role): boolean {
    return this.authorizationService.hasPermission(role, Permission.ORDER_OVERRIDE);
  }

  private kitchenToday(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  private nextDateOnly(date: string): Date {
    const start = new Date(`${date}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    return start;
  }

  private async loadEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, include: { company: { include: { addresses: true, holidays: true } } } });
    if (!employee) throw new NotFoundException(`Employee ${id} was not found.`);
    return employee;
  }

  private async isAfterCutoff(deliveryDate: Date) {
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (!settings) return false;
    const holidays = await this.prisma.kitchenHoliday.findMany();
    return new CutoffCalculator({
      kitchenTimeZone: settings.kitchenTimeZone,
      cutOffTime: settings.cutOffTime,
      cutOffWorkingDays: settings.cutOffWorkingDays,
      kitchenCalendar: new KitchenCalendarService(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)), settings),
      clock: { now: () => new Date() },
    }).isPastCutoff(
      this.dateOnlyAtKitchenNoon(
        deliveryDate.toISOString().slice(0, 10),
        settings.kitchenTimeZone,
      ),
    );
  }

  private dateOnlyAtKitchenNoon(date: string, timeZone: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const base = Date.UTC(year, month - 1, day, 12, 0);
    let guess = base;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const localAsUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second),
      );
      guess += base - localAsUtc;
    }
    return new Date(guess);
  }
}
