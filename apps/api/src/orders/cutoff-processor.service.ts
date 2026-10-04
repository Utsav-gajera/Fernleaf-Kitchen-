import { Injectable, Optional } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KitchenService } from '../kitchen/kitchen.service';

export interface CutoffProcessingResult {
  deliveryDate: string;
  processed: boolean;
  cancelled: number;
  confirmed: number;
  billable: number;
}

@Injectable()
export class CutoffProcessor {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly kitchenService?: KitchenService) {}

  async process(deliveryDate: Date): Promise<CutoffProcessingResult> {
    const normalizedDate = this.normalizeDate(deliveryDate);
    const dateRange = this.deliveryDateRange(normalizedDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.cutoffProcessing.create({ data: { deliveryDate: normalizedDate } });
        return this.processPendingOrders(tx, normalizedDate, dateRange);
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      // A previous run may have recorded the date before older data was
      // normalized consistently. Reconcile pending orders without creating
      // duplicate transition events.
      return this.prisma.$transaction((tx) => this.processPendingOrders(tx, normalizedDate, dateRange));
    }
  }

  private async processPendingOrders(
    tx: Prisma.TransactionClient,
    normalizedDate: Date,
    dateRange: { gte: Date; lt: Date },
  ): Promise<CutoffProcessingResult> {
    const drafts = await tx.order.findMany({
      where: { deliveryDate: dateRange, status: OrderStatus.DRAFT },
      select: { id: true },
    });
    const placed = await tx.order.findMany({
      where: { deliveryDate: dateRange, status: OrderStatus.PLACED },
      select: { id: true },
    });

    if (drafts.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: drafts.map((order) => order.id) }, status: OrderStatus.DRAFT },
        data: { status: OrderStatus.CANCELLED },
      });
      await tx.orderTimelineEvent.createMany({
        data: drafts.map((order) => ({
          orderId: order.id,
          status: OrderStatus.CANCELLED,
          note: 'Automatically cancelled at cutoff',
        })),
      });
    }
    if (placed.length > 0) {
      await tx.order.updateMany({
        where: { id: { in: placed.map((order) => order.id) }, status: OrderStatus.PLACED },
        data: { status: OrderStatus.CONFIRMED, billable: true },
      });
      await tx.orderTimelineEvent.createMany({
        data: placed.map((order) => ({
          orderId: order.id,
          status: OrderStatus.CONFIRMED,
          note: 'Automatically confirmed at cutoff and marked billable',
        })),
      });
      for (const order of placed) {
        if (this.kitchenService) {
          await this.kitchenService.generateUnitsForConfirmedOrder(tx, order.id);
        }
      }
    }

    return {
      deliveryDate: this.toDateKey(normalizedDate),
      processed: drafts.length > 0 || placed.length > 0,
      cancelled: drafts.length,
      confirmed: placed.length,
      billable: placed.length,
    };
  }

  private normalizeDate(value: Date): Date {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Delivery date must be valid.');
    }
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private deliveryDateRange(date: Date): { gte: Date; lt: Date } {
    const start = new Date(`${this.toDateKey(date)}T00:00:00.000Z`);
    return {
      gte: start,
      lt: new Date(start.getTime() + 86_400_000),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
