import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DropStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DispatchPolicy } from './domain/dispatch-policy';
import { DispatchStateMachine } from './domain/dispatch-state-machine';
import { DeliverDropDto } from './dto/deliver-drop.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class DispatchService {
  private readonly policy = new DispatchPolicy();
  private readonly stateMachine = new DispatchStateMachine();

  constructor(private readonly prisma: PrismaService) {}

  async getDrops(date?: string) {
    const dateKey = date ?? new Date().toISOString().slice(0, 10);
    if (!DATE_PATTERN.test(dateKey)) {
      throw new BadRequestException('date must use YYYY-MM-DD format.');
    }

    const range = {
      gte: new Date(`${dateKey}T00:00:00.000Z`),
      lt: new Date(new Date(`${dateKey}T00:00:00.000Z`).getTime() + 86_400_000),
    };
    const orders = await this.prisma.order.findMany({
      where: {
        deliveryDate: range,
        status: OrderStatus.KITCHEN_READY,
      },
      include: { company: true, dropOrders: { include: { drop: true } } },
      orderBy: [{ deliveryTime: 'asc' }, { addressLine1: 'asc' }],
    });

    await this.prisma.$transaction(async (tx) => {
      for (const order of orders) {
        const groupingKey = this.groupingKey(order);
        const existingDrop = order.dropOrders[0]?.drop;
        const drop = await tx.drop.upsert({
          where: { groupingKey },
          create: {
            groupingKey,
            companyId: order.companyId,
            driverId: order.company.defaultDriverId,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            postalCode: order.postalCode,
            deliveryTime: order.deliveryTime,
            deliveryAt: this.deliveryAt(order.deliveryDate, order.deliveryTime),
            status: existingDrop?.status ?? DropStatus.KITCHEN_READY,
          },
          update: {
            companyId: order.companyId,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            postalCode: order.postalCode,
            deliveryTime: order.deliveryTime,
            deliveryAt: this.deliveryAt(order.deliveryDate, order.deliveryTime),
            driverId: existingDrop?.driverId ?? order.company.defaultDriverId,
          },
        });
        await tx.dropOrder.upsert({
          where: { orderId: order.id },
          create: { dropId: drop.id, orderId: order.id },
          update: { dropId: drop.id },
        });
      }
    });

    return this.prisma.drop.findMany({
      where: { deliveryAt: range },
      include: {
        company: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true, email: true } },
        orders: {
          include: {
            order: {
              select: {
                id: true,
                status: true,
                totalMinor: true,
                employee: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { deliveryAt: 'asc' },
    });
  }

  async assignDriver(dropId: string, driverId: string) {
    const driver = await this.prisma.staffUser.findFirst({
      where: { id: driverId, role: 'DRIVER', isActive: true },
      select: { id: true },
    });
    if (!driver) throw new NotFoundException(`Active driver ${driverId} was not found.`);
    const drop = await this.prisma.drop.findUnique({ where: { id: dropId } });
    if (!drop) throw new NotFoundException(`Drop ${dropId} was not found.`);
    if (!this.policy.canAssignDriver(drop.status)) {
      throw new BadRequestException('Driver assignment is only allowed before dispatch-ready.');
    }

    return this.prisma.drop.update({
      where: { id: dropId },
      data: { driverId },
      include: { driver: { select: { id: true, name: true, email: true } } },
    });
  }

  getDrivers() {
    return this.prisma.staffUser.findMany({
      where: { role: 'DRIVER', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
  }

  async markDispatchReady(dropId: string) {
    return this.transition(
      dropId,
      DropStatus.KITCHEN_READY,
      DropStatus.DISPATCH_READY,
      OrderStatus.KITCHEN_READY,
      OrderStatus.DISPATCH_READY,
    );
  }

  async markOutForDelivery(dropId: string) {
    const drop = await this.prisma.drop.findUnique({ where: { id: dropId } });
    if (!drop) throw new NotFoundException(`Drop ${dropId} was not found.`);
    try {
      this.policy.assertDriverAssigned(drop.driverId);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'A driver must be assigned before dispatch.');
    }
    return this.transition(
      dropId,
      DropStatus.DISPATCH_READY,
      DropStatus.OUT_FOR_DELIVERY,
      OrderStatus.DISPATCH_READY,
      OrderStatus.OUT_FOR_DELIVERY,
    );
  }

  async markDelivered(dropId: string) {
    return this.transition(
      dropId,
      DropStatus.OUT_FOR_DELIVERY,
      DropStatus.DELIVERED,
      OrderStatus.OUT_FOR_DELIVERY,
      OrderStatus.DELIVERED,
    );
  }

  async getDriverDropsToday(driverId: string) {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { kitchenTimeZone: true },
    });
    const timeZone = settings?.kitchenTimeZone ?? process.env.KITCHEN_TIMEZONE ?? 'UTC';
    const today = this.kitchenToday(timeZone);
    const range = this.kitchenDateRange(today, timeZone);
    return this.prisma.drop.findMany({
      where: { driverId, deliveryAt: range },
      include: {
        company: { select: { id: true, name: true } },
        orders: {
          include: {
            order: {
              select: {
                id: true,
                addressInstructions: true,
                employee: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { deliveryAt: 'asc' },
    });
  }

  async deliverDrop(dropId: string, driverId: string, data: DeliverDropDto) {
    const drop = await this.prisma.drop.findUnique({ where: { id: dropId } });
    if (!drop) throw new NotFoundException(`Drop ${dropId} was not found.`);
    if (drop.driverId !== driverId) {
      throw new BadRequestException('This drop is not assigned to the authenticated driver.');
    }
    if (drop.status !== DropStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException('Only drops out for delivery can be delivered.');
    }
    const deliveredAt = new Date();
    const onTime = deliveredAt.getTime() <= drop.deliveryAt.getTime();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.drop.updateMany({
        where: { id: dropId, driverId, status: DropStatus.OUT_FOR_DELIVERY },
        data: {
          status: DropStatus.DELIVERED,
          deliveredAt,
          deliveryNote: data.note,
          deliveryPhotoUrl: data.photoUrl,
          onTime,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Drop state changed before it could be delivered.');
      }
      const orders = await tx.dropOrder.findMany({ where: { dropId }, select: { orderId: true } });
      await tx.order.updateMany({
        where: { id: { in: orders.map((order) => order.orderId) }, status: OrderStatus.OUT_FOR_DELIVERY },
        data: { status: OrderStatus.DELIVERED },
      });
      return tx.drop.findUnique({ where: { id: dropId } });
    });
  }

  private async transition(
    dropId: string,
    from: DropStatus,
    to: DropStatus,
    orderFrom: OrderStatus,
    orderTo: OrderStatus,
  ) {
    this.stateMachine.assertTransition(from, to);
    const updated = await this.prisma.$transaction(async (tx) => {
      const drop = await tx.drop.findUnique({ where: { id: dropId }, include: { orders: true } });
      if (!drop) throw new NotFoundException(`Drop ${dropId} was not found.`);
      if (drop.status !== from) {
        throw new BadRequestException(`Drop must be ${from} before it can become ${to}.`);
      }
      const result = await tx.drop.updateMany({
        where: { id: dropId, status: from },
        data: { status: to },
      });
      if (result.count !== 1) {
        throw new BadRequestException('Drop state changed before it could be updated.');
      }
      const orderIds = drop.orders.map((dropOrder) => dropOrder.orderId);
      if (orderIds.length > 0) {
        const orders = await tx.order.updateMany({
          where: { id: { in: orderIds }, status: orderFrom },
          data: { status: orderTo },
        });
        if (orders.count !== orderIds.length) {
          throw new BadRequestException(`Orders must be ${orderFrom} before they can become ${orderTo}.`);
        }
      }
      return result;
    });
    void updated;
    return this.prisma.drop.findUnique({
      where: { id: dropId },
      include: { driver: { select: { id: true, name: true, email: true } } },
    });
  }

  private groupingKey(order: {
    companyId: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postalCode: string;
    deliveryTime: string;
    deliveryDate: Date;
  }) {
    return [
      order.companyId,
      order.addressLine1,
      order.addressLine2 ?? '',
      order.city,
      order.postalCode,
      order.deliveryTime,
      order.deliveryDate.toISOString().slice(0, 10),
    ].map((value) => value.trim().toLowerCase()).join('|');
  }

  private deliveryAt(date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setUTCHours(hours, minutes, 0, 0);
    return result;
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

  private kitchenDateRange(dateKey: string, timeZone: string) {
    const start = this.localDateTimeToInstant(dateKey, timeZone);
    const nextDate = new Date(`${dateKey}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateKey = nextDate.toISOString().slice(0, 10);
    return { gte: start, lt: this.localDateTimeToInstant(nextDateKey, timeZone) };
  }

  private localDateTimeToInstant(dateKey: string, timeZone: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, day));
    let guess = base.getTime();
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
      guess -= localAsUtc - base.getTime();
    }
    return new Date(guess);
  }
}
