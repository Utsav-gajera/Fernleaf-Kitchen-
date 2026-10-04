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
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
      select: { kitchenTimeZone: true },
    });
    const timeZone = settings?.kitchenTimeZone ?? 'UTC';
    const dateKey = date ?? this.kitchenToday(timeZone);
    if (!DATE_PATTERN.test(dateKey)) {
      throw new BadRequestException('date must use YYYY-MM-DD format.');
    }

    const orderDateRange = this.dateOnlyRange(dateKey);
    const dropDateRange = this.kitchenDateRange(dateKey, timeZone);
    const orders = await this.prisma.order.findMany({
      where: {
        deliveryDate: orderDateRange,
        status: OrderStatus.KITCHEN_READY,
      },
      include: { company: true, dropOrders: { include: { drop: true } } },
      orderBy: [{ deliveryTime: 'asc' }, { addressLine1: 'asc' }],
    });

    await this.prisma.$transaction(async (tx) => {
      for (const order of orders) {
        const groupingKey = this.groupingKey(order);
        const existingDrop = order.dropOrders[0]?.drop;
        if (existingDrop && existingDrop.groupingKey !== groupingKey && existingDrop.status !== DropStatus.KITCHEN_READY) {
          throw new BadRequestException('An order cannot be reassigned after dispatch has begun.');
        }
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
            deliveryAt: this.deliveryAt(order.deliveryDate, order.deliveryTime, timeZone),
            status: existingDrop?.status ?? DropStatus.KITCHEN_READY,
          },
          update: {
            companyId: order.companyId,
            addressLine1: order.addressLine1,
            addressLine2: order.addressLine2,
            city: order.city,
            postalCode: order.postalCode,
            deliveryTime: order.deliveryTime,
            deliveryAt: this.deliveryAt(order.deliveryDate, order.deliveryTime, timeZone),
            driverId: existingDrop?.driverId ?? order.company.defaultDriverId,
          },
        });
        if (drop.status !== DropStatus.KITCHEN_READY) {
          throw new BadRequestException('An order cannot be assigned to a drop after dispatch has begun.');
        }
        await tx.dropOrder.upsert({
          where: { orderId: order.id },
          create: { dropId: drop.id, orderId: order.id },
          update: { dropId: drop.id },
        });
        if (existingDrop && existingDrop.id !== drop.id && existingDrop.status === DropStatus.KITCHEN_READY) {
          await tx.drop.deleteMany({
            where: { id: existingDrop.id, status: DropStatus.KITCHEN_READY, orders: { none: {} } },
          });
        }
      }
    });

    return this.prisma.drop.findMany({
      where: { deliveryAt: dropDateRange },
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
      throw new BadRequestException('Driver assignment is only allowed before a drop is out for delivery.');
    }

    const updated = await this.prisma.drop.updateMany({
      where: { id: dropId, status: drop.status, updatedAt: drop.updatedAt },
      data: { driverId },
    });
    if (updated.count !== 1) {
      throw new BadRequestException('Drop changed before the driver could be assigned. Refresh and try again.');
    }
    return this.prisma.drop.findUnique({
      where: { id: dropId },
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
    await this.assertDropContainsEveryReadyOrder(dropId);
    return this.transition(
      dropId,
      DropStatus.KITCHEN_READY,
      DropStatus.DISPATCH_READY,
      OrderStatus.KITCHEN_READY,
      OrderStatus.DISPATCH_READY,
    );
  }

  private async assertDropContainsEveryReadyOrder(dropId: string) {
    const drop = await this.prisma.drop.findUnique({ where: { id: dropId } });
    if (!drop) throw new NotFoundException(`Drop ${dropId} was not found.`);
    const dateKey = drop.groupingKey.split('|').at(-1);
    if (!dateKey || !DATE_PATTERN.test(dateKey)) {
      throw new BadRequestException('Drop grouping date is invalid.');
    }
    const incomplete = await this.prisma.order.count({
      where: {
        companyId: drop.companyId,
        deliveryDate: this.dateOnlyRange(dateKey),
        deliveryTime: drop.deliveryTime,
        addressLine1: drop.addressLine1,
        addressLine2: drop.addressLine2,
        city: drop.city,
        postalCode: drop.postalCode,
        status: {
          in: [OrderStatus.CONFIRMED, OrderStatus.KITCHEN_IN_PROGRESS, OrderStatus.KITCHEN_READY],
        },
        dropOrders: { none: { dropId } },
      },
    });
    if (incomplete > 0) {
      throw new BadRequestException(
        'Every order in this grouped drop must be kitchen-ready and attached before dispatch can begin. Refresh the board after kitchen completion.',
      );
    }
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
      'Admin override marked delivery complete',
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
      if (orders.length > 0) {
        await tx.orderTimelineEvent.createMany({
          data: orders.map(({ orderId }) => ({
            orderId,
            status: OrderStatus.DELIVERED,
            note: onTime ? 'Delivered on time' : 'Delivered late',
          })),
        });
      }
      return tx.drop.findUnique({ where: { id: dropId } });
    });
  }

  private async transition(
    dropId: string,
    from: DropStatus,
    to: DropStatus,
    orderFrom: OrderStatus,
    orderTo: OrderStatus,
    timelineNote?: string,
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
        data: {
          status: to,
          ...(to === DropStatus.DELIVERED
            ? {
                deliveredAt: new Date(),
                onTime: new Date().getTime() <= drop.deliveryAt.getTime(),
              }
            : {}),
        },
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
        await tx.orderTimelineEvent.createMany({
          data: orderIds.map((orderId) => ({
            orderId,
            status: orderTo,
            note: timelineNote ?? `Dispatch moved order to ${orderTo.toLowerCase().replaceAll('_', ' ')}`,
          })),
        });
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

  private deliveryAt(date: Date, time: string, timeZone: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const dateKey = date.toISOString().slice(0, 10);
    return this.localDateTimeToInstantAt(
      dateKey,
      timeZone,
      hours || 0,
      minutes || 0,
    );
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

  private dateOnlyRange(dateKey: string) {
    const start = new Date(`${dateKey}T00:00:00.000Z`);
    return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  private localDateTimeToInstant(dateKey: string, timeZone: string) {
    return this.localDateTimeToInstantAt(dateKey, timeZone, 0, 0);
  }

  private localDateTimeToInstantAt(dateKey: string, timeZone: string, hours: number, minutes: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const base = new Date(Date.UTC(year, month - 1, day, hours, minutes));
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
