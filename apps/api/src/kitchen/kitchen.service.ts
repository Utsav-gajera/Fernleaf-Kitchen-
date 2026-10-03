import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KitchenOrderStatus, KitchenUnitStatus, OrderStatus, Prisma } from '@prisma/client';
import { Role } from '@project/shared';
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
    if (!order) throw new NotFoundException(`Order ${orderId} was not found.`);
    this.policy.assertOrderConfirmed(order.status);
    const dispatchAt = this.deliveryInstant(order.deliveryDate, order.deliveryTime);
    const dispatchLead = order.company.deliveryLeadMinutes;
    const readyBuffer = 30;
    const plannedDispatchAt = new Date(dispatchAt.getTime() - dispatchLead * 60_000);
    const plannedKitchenReadyAt = new Date(dispatchAt.getTime() - readyBuffer * 60_000);
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
    const range = this.dateRange(date);
    await this.ensureUnitsForConfirmedOrders(range);
    const units = await this.prisma.kitchenUnit.findMany({
      where: {
        order: { deliveryDate: range },
        station: station ? { name: station } : undefined,
      },
      include: { order: { select: { id: true, deliveryDate: true, deliveryTime: true, kitchenStartedAt: true, kitchenReadyAt: true } }, station: true },
      orderBy: { plannedKitchenReadyAt: 'asc' },
    });
    const now = Date.now();
    return units.map((unit) => ({
      ...unit,
      late: unit.status !== KitchenUnitStatus.DONE && now > unit.plannedKitchenReadyAt.getTime(),
      atRisk:
        unit.status !== KitchenUnitStatus.DONE &&
        now > unit.plannedKitchenReadyAt.getTime() - 30 * 60_000,
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
        await tx.order.updateMany({
          where: {
            id: current.orderId,
            status: OrderStatus.CONFIRMED,
            kitchenStatus: KitchenOrderStatus.PENDING,
          },
          data: { kitchenStatus: KitchenOrderStatus.STARTED, kitchenStartedAt: now },
        });
      } else if (target === KitchenUnitStatus.DONE) {
        const remaining = await tx.kitchenUnit.count({ where: { orderId: current.orderId, status: { not: KitchenUnitStatus.DONE } } });
        if (remaining === 0) {
          await tx.order.updateMany({
            where: { id: current.orderId, status: OrderStatus.CONFIRMED },
            data: { kitchenStatus: KitchenOrderStatus.DONE, kitchenReadyAt: now },
          });
        }
      }
      return tx.kitchenUnit.findUnique({ where: { id: unitId } });
    });
  }

  async forceCompleteOrder(orderId: string, role: Role) {
    if (!this.policy.canForceComplete(role === Role.ADMIN)) throw new ForbiddenException('Only admins can force-complete orders.');
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
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
          kitchenStatus: KitchenOrderStatus.DONE,
          kitchenReadyAt: now,
          kitchenStartedAt: { set: now },
        },
      });
      return tx.order.findUnique({ where: { id: orderId }, include: { kitchenUnits: true } });
    });
  }

  private dateRange(date?: string) {
    const start = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    if (!date) start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
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

  private deliveryInstant(date: Date, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setUTCHours(hours || 0, minutes || 0, 0, 0);
    return result;
  }
}
