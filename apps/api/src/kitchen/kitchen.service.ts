import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KitchenUnitStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KitchenPolicy } from './domain/kitchen-policy';
import { KitchenStateMachine } from './domain/kitchen-state-machine';

@Injectable()
export class KitchenService {
  private readonly policy = new KitchenPolicy();
  private readonly stateMachine = new KitchenStateMachine();

  constructor(private readonly prisma: PrismaService) {}

  async generateUnitsForConfirmedOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        company: { select: { deliveryLeadMinutes: true } },
        lines: { include: { dish: { include: { station: true } }, combinations: { include: { options: true } } } },
      },
    });
    const settings = await tx.platformSettings.findUnique({
        where: { id: 'default' },
        select: { kitchenTimeZone: true, kitchenReadyBufferMinutes: true },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} was not found.`);
    this.policy.assertOrderConfirmed(order.status);
    const deliveryAt = this.deliveryInstant(
        order.deliveryDate,
        order.deliveryTime,
        settings?.kitchenTimeZone ?? 'UTC',
    );
    const dispatchLead = order.company.deliveryLeadMinutes;
    const readyBuffer = settings?.kitchenReadyBufferMinutes ?? 30;
    const plannedDispatchAt = new Date(deliveryAt.getTime() - dispatchLead * 60_000);
    const plannedKitchenReadyAt = new Date(plannedDispatchAt.getTime() - readyBuffer * 60_000);
    await tx.order.update({
      where: { id: orderId },
      data: { plannedDispatchReadyAt: plannedDispatchAt, plannedKitchenReadyAt },
    });
    for (const line of order.lines) {
        for (const combination of line.combinations) {
          await tx.kitchenUnit.upsert({
            where: { combinationId: combination.id },
            create: {
              orderId,
              combinationId: combination.id,
              dishNameSnapshot: line.dishNameSnapshot,
              skuSnapshot: line.skuSnapshot,
              optionsSnapshot: JSON.stringify(combination.options.map((option) => option.optionNameSnapshot)),
              quantity: combination.quantity,
              stationId: line.dish?.stationId,
              stationNameSnapshot: line.dish?.station?.name,
              plannedDispatchAt,
              plannedKitchenReadyAt,
            },
            update: {},
          });
        }
    }
  }

  async getBoard(date?: string, station?: string) {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { kitchenTimeZone: true },
    });
    const timeZone = settings?.kitchenTimeZone ?? 'UTC';
    const dateKey = date ?? this.kitchenToday(timeZone);
    const orderDateRange = this.dateOnlyRange(dateKey);
    await this.ensureUnitsForConfirmedOrders(orderDateRange);
    const units = await this.prisma.kitchenUnit.findMany({
      where: {
        order: { deliveryDate: orderDateRange },
        station: station ? { name: station } : undefined,
      },
      include: { order: { select: { id: true, deliveryDate: true, deliveryTime: true, status: true } }, station: true },
      orderBy: { plannedKitchenReadyAt: 'asc' },
    });
    const now = Date.now();
    return units.map((unit) => ({
      ...unit,
      late: unit.status !== KitchenUnitStatus.DONE && now > unit.plannedDispatchAt.getTime(),
      atRisk:
        unit.status !== KitchenUnitStatus.DONE &&
        now > unit.plannedKitchenReadyAt.getTime(),
    }));
  }

  async getStations() {
    return this.prisma.kitchenStation.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getPrepBoard(date?: string, station?: string) {
    return this.getBoard(date, station);
  }

  async updateUnitStatus(unitId: string, status: string) {
    if (!Object.values(KitchenUnitStatus).includes(status as KitchenUnitStatus)) {
      throw new BadRequestException('Invalid kitchen unit status.');
    }
    const target = status as KitchenUnitStatus;
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.kitchenUnit.findUnique({ where: { id: unitId } });
      if (!current) throw new NotFoundException(`Kitchen unit ${unitId} was not found.`);
      const order = await tx.order.findUnique({ where: { id: current.orderId }, select: { status: true } });
      if (!order) throw new NotFoundException(`Order ${current.orderId} was not found.`);
      try {
        this.policy.assertOrderConfirmed(order.status);
        this.stateMachine.assertTransition(current.status, target);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Invalid kitchen transition.');
      }
      const now = new Date();
      const updated = await tx.kitchenUnit.updateMany({
        where: { id: unitId, status: current.status },
        data: {
          status: target,
          startedAt: target === KitchenUnitStatus.STARTED || target === KitchenUnitStatus.DONE ? now : undefined,
          completedAt: target === KitchenUnitStatus.DONE ? now : undefined,
        },
      });
      if (updated.count !== 1) throw new BadRequestException('Kitchen unit state changed before it could be updated.');
      if (target === KitchenUnitStatus.STARTED) {
        const orderStarted = await tx.order.updateMany({
          where: { id: current.orderId, status: OrderStatus.CONFIRMED },
          data: { status: OrderStatus.KITCHEN_IN_PROGRESS, kitchenStartedAt: now },
        });
        if (orderStarted.count === 1) {
          await tx.orderTimelineEvent.create({
            data: { orderId: current.orderId, status: OrderStatus.KITCHEN_IN_PROGRESS, note: 'Kitchen work started' },
          });
        }
      } else if (target === KitchenUnitStatus.DONE) {
        const orderStarted = await tx.order.updateMany({
          where: { id: current.orderId, status: OrderStatus.CONFIRMED },
          data: { status: OrderStatus.KITCHEN_IN_PROGRESS, kitchenStartedAt: now },
        });
        if (orderStarted.count === 1) {
          await tx.orderTimelineEvent.create({
            data: { orderId: current.orderId, status: OrderStatus.KITCHEN_IN_PROGRESS, note: 'Kitchen work started' },
          });
        }
        const remaining = await tx.kitchenUnit.count({ where: { orderId: current.orderId, status: { not: KitchenUnitStatus.DONE } } });
        if (remaining === 0) {
          const orderReady = await tx.order.updateMany({
            where: { id: current.orderId, status: { in: [OrderStatus.CONFIRMED, OrderStatus.KITCHEN_IN_PROGRESS] } },
            data: { status: OrderStatus.KITCHEN_READY, kitchenReadyAt: now },
          });
          if (orderReady.count === 1) {
            await tx.orderTimelineEvent.create({
              data: { orderId: current.orderId, status: OrderStatus.KITCHEN_READY, note: 'All kitchen units completed' },
            });
          }
        }
      }
      return tx.kitchenUnit.findUnique({ where: { id: unitId } });
    });
  }

  async forceCompleteOrder(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { status: true, kitchenStartedAt: true },
      });
      if (!order) throw new NotFoundException(`Order ${orderId} was not found.`);
      try { this.policy.assertOrderConfirmed(order.status); } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Order is not confirmed.'); }
      const now = new Date();
      await tx.kitchenUnit.updateMany({
        where: { orderId, status: { not: KitchenUnitStatus.DONE } },
        data: { status: KitchenUnitStatus.DONE, startedAt: now, completedAt: now },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.KITCHEN_READY,
          kitchenStartedAt: order.kitchenStartedAt ?? now,
          kitchenReadyAt: now,
        },
      });
      if (!order.kitchenStartedAt) {
        await tx.orderTimelineEvent.create({
          data: { orderId, status: OrderStatus.KITCHEN_IN_PROGRESS, note: 'Kitchen work force-started by admin' },
        });
      }
      await tx.orderTimelineEvent.create({
        data: { orderId, status: OrderStatus.KITCHEN_READY, note: 'Kitchen work force-completed by admin' },
      });
      return tx.order.findUnique({ where: { id: orderId }, include: { kitchenUnits: true } });
    });
  }

  async rescheduleOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { company: { select: { deliveryLeadMinutes: true } } },
    });
    if (!order) throw new NotFoundException(`Order ${orderId} was not found.`);
    const settings = await tx.platformSettings.findUnique({
      where: { id: 'default' },
      select: { kitchenTimeZone: true, kitchenReadyBufferMinutes: true },
    });
    const deliveryAt = this.deliveryInstant(
      order.deliveryDate,
      order.deliveryTime,
      settings?.kitchenTimeZone ?? 'UTC',
    );
    const plannedDispatchAt = new Date(
      deliveryAt.getTime() - order.company.deliveryLeadMinutes * 60_000,
    );
    const plannedKitchenReadyAt = new Date(
      plannedDispatchAt.getTime() - (settings?.kitchenReadyBufferMinutes ?? 30) * 60_000,
    );
    await tx.order.update({
      where: { id: orderId },
      data: { plannedDispatchReadyAt: plannedDispatchAt, plannedKitchenReadyAt },
    });
    await tx.kitchenUnit.updateMany({
      where: { orderId },
      data: { plannedDispatchAt, plannedKitchenReadyAt },
    });
  }

  private dateOnlyRange(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  private async ensureUnitsForConfirmedOrders(range: { gte: Date; lt: Date }) {
    await this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { status: OrderStatus.CONFIRMED, deliveryDate: range },
        select: { id: true },
      });
      for (const order of orders) {
        await this.generateUnitsForConfirmedOrder(tx, order.id);
      }
    });
  }

  private deliveryInstant(date: Date, time: string, timeZone: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const base = new Date(Date.UTC(
      date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
      hours || 0, minutes || 0, 0, 0,
    ));
    let guess = base.getTime();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const localAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
      guess += base.getTime() - localAsUtc;
    }
    return new Date(guess);
  }

  private kitchenToday(timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
}
