import { Injectable } from '@nestjs/common';
import { DropStatus, KitchenUnitStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoleDashboard(role: string, userId: string) {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { kitchenTimeZone: true },
    });
    const timeZone = settings?.kitchenTimeZone ?? 'UTC';
    const today = this.kitchenToday(timeZone);
    const orderDateRange = this.dateOnlyRange(today);
    const operationalRange = this.kitchenDateRange(today, timeZone);

    if (role === 'ADMIN') return { role, date: today, metrics: await this.adminMetrics(orderDateRange, operationalRange) };
    if (role === 'KITCHEN') return { role, date: today, metrics: await this.kitchenMetrics(orderDateRange) };
    if (role === 'DISPATCH') return { role, date: today, metrics: await this.dispatchMetrics(operationalRange) };
    if (role === 'DRIVER') return { role, date: today, metrics: await this.driverMetrics(userId, operationalRange) };
    return { role, date: today, metrics: {} };
  }

  private async adminMetrics(orderDateRange: { gte: Date; lt: Date }, operationalRange: { gte: Date; lt: Date }) {
    const [orders, billable, uninvoiced, lateDeliveries, attention] = await Promise.all([
      this.prisma.order.count({ where: { deliveryDate: orderDateRange } }),
      this.prisma.order.aggregate({
        where: { deliveryDate: orderDateRange, billable: true },
        _sum: { totalMinor: true },
      }),
      this.prisma.order.count({
        where: { deliveryDate: orderDateRange, billable: true, invoiced: false },
      }),
      this.prisma.drop.count({
        where: {
          deliveryAt: { gte: operationalRange.gte, lt: new Date() },
          status: { not: DropStatus.DELIVERED },
        },
      }),
      this.prisma.order.count({
        where: { deliveryDate: orderDateRange, status: { in: [OrderStatus.DRAFT, OrderStatus.PLACED] } },
      }),
    ]);
    return {
      todaysOrders: orders,
      todaysConfirmedValueMinor: billable._sum.totalMinor ?? 0,
      uninvoicedOrders: uninvoiced,
      lateDeliveries,
      ordersRequiringAttention: attention,
    };
  }

  private async kitchenMetrics(dateRange: { gte: Date; lt: Date }) {
    const now = new Date();
    const [pending, started, done, atRisk, late] = await Promise.all([
      this.prisma.kitchenUnit.count({ where: { order: { deliveryDate: dateRange }, status: KitchenUnitStatus.PENDING } }),
      this.prisma.kitchenUnit.count({ where: { order: { deliveryDate: dateRange }, status: KitchenUnitStatus.STARTED } }),
      this.prisma.kitchenUnit.count({ where: { order: { deliveryDate: dateRange }, status: KitchenUnitStatus.DONE } }),
      this.prisma.kitchenUnit.count({
        where: { order: { deliveryDate: dateRange }, status: { not: KitchenUnitStatus.DONE }, plannedKitchenReadyAt: { lte: now } },
      }),
      this.prisma.kitchenUnit.count({
        where: { order: { deliveryDate: dateRange }, status: { not: KitchenUnitStatus.DONE }, plannedDispatchAt: { lt: now } },
      }),
    ]);
    return { pendingUnits: pending, inProgress: started, doneUnits: done, atRiskUnits: atRisk, lateUnits: late };
  }

  private async dispatchMetrics(dateRange: { gte: Date; lt: Date }) {
    const now = new Date();
    const [kitchenReady, waitingForDriver, dispatchReady, outForDelivery, late] = await Promise.all([
      this.prisma.drop.count({ where: { deliveryAt: dateRange, status: DropStatus.KITCHEN_READY } }),
      this.prisma.drop.count({
        where: {
          deliveryAt: dateRange,
          driverId: null,
          status: { in: [DropStatus.KITCHEN_READY, DropStatus.DISPATCH_READY] },
        },
      }),
      this.prisma.drop.count({ where: { deliveryAt: dateRange, status: DropStatus.DISPATCH_READY } }),
      this.prisma.drop.count({ where: { deliveryAt: dateRange, status: DropStatus.OUT_FOR_DELIVERY } }),
      this.prisma.drop.count({
        where: { deliveryAt: { gte: dateRange.gte, lt: now }, status: { not: DropStatus.DELIVERED } },
      }),
    ]);
    return { kitchenReady, waitingForDriver, dispatchReady, outForDelivery, lateDrops: late };
  }

  private async driverMetrics(driverId: string, dateRange: { gte: Date; lt: Date }) {
    const drops = await this.prisma.drop.findMany({
      where: { driverId, deliveryAt: dateRange },
      select: {
        id: true,
        deliveryAt: true,
        deliveryTime: true,
        addressLine1: true,
        city: true,
        postalCode: true,
        status: true,
      },
      orderBy: { deliveryAt: 'asc' },
    });
    const remaining = drops.filter((drop) => drop.status !== DropStatus.DELIVERED);
    const completed = drops.length - remaining.length;
    const next = remaining[0];
    return {
      nextDrop: next ? {
        id: next.id,
        deliveryAt: next.deliveryAt,
        deliveryTime: next.deliveryTime,
        addressLine1: next.addressLine1,
        city: next.city,
        postalCode: next.postalCode,
      } : null,
      remainingDrops: remaining.length,
      completedDrops: completed,
    };
  }

  private kitchenToday(timeZone: string): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  private kitchenDateRange(date: string, timeZone: string): { gte: Date; lt: Date } {
    return {
      gte: this.localDateTimeToInstant(date, timeZone),
      lt: this.localDateTimeToInstant(date, timeZone, 1),
    };
  }

  private dateOnlyRange(date: string): { gte: Date; lt: Date } {
    const start = new Date(`${date}T00:00:00.000Z`);
    return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  private localDateTimeToInstant(date: string, timeZone: string, dayOffset = 0): Date {
    const [year, month, day] = date.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, day + dayOffset));
    let guess = base.getTime();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const localAsUtc = Date.UTC(
        Number(values.year), Number(values.month) - 1, Number(values.day),
        Number(values.hour), Number(values.minute), Number(values.second),
      );
      guess += base.getTime() - localAsUtc;
    }
    return new Date(guess);
  }
}
