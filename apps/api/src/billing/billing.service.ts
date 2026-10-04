import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BILLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.KITCHEN_IN_PROGRESS,
  OrderStatus.KITCHEN_READY,
  OrderStatus.DISPATCH_READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getUninvoicedOrders(companyId: string) {
    return this.prisma.order.findMany({
      where: {
        companyId,
        billable: true,
        status: { in: BILLABLE_STATUSES },
        invoiceOrders: { none: {} },
      },
      orderBy: { deliveryDate: 'asc' },
    });
  }

  async createInvoice(companyId: string, orderIds: string[]) {
    const uniqueOrderIds = [...new Set(orderIds)];
    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('Select at least one order to create an invoice.');
    }
    if (uniqueOrderIds.length !== orderIds.length) {
      throw new BadRequestException('An invoice cannot contain the same order more than once.');
    }

    return this.prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          id: { in: uniqueOrderIds },
          companyId,
          billable: true,
          status: { in: BILLABLE_STATUSES },
          invoiceOrders: { none: {} },
        },
        select: { id: true, totalMinor: true },
      });
      if (orders.length !== uniqueOrderIds.length) {
        const existing = await tx.order.findMany({
          where: { id: { in: uniqueOrderIds } },
          select: { id: true, companyId: true, status: true, billable: true, invoiceOrders: { select: { id: true } } },
        });
        if (existing.some((order) => order.companyId !== companyId)) {
          throw new BadRequestException('All invoice orders must belong to the selected company.');
        }
        if (existing.some((order) => !order.billable || !BILLABLE_STATUSES.includes(order.status))) {
          throw new BadRequestException('Only confirmed billable orders can be invoiced.');
        }
        if (existing.some((order) => order.invoiceOrders.length > 0)) {
          throw new BadRequestException('One or more orders are already invoiced.');
        }
        throw new NotFoundException('One or more orders were not found.');
      }

      const totalMinor = orders.reduce((sum, order) => sum + order.totalMinor, 0);
      const invoice = await tx.invoice.create({
        data: {
          companyId,
          totalMinor,
          orders: {
            create: orders.map((order) => ({
              orderId: order.id,
              totalMinor: order.totalMinor,
            })),
          },
        },
        include: { orders: { include: { order: true } } },
      });
      await tx.order.updateMany({
        where: { id: { in: uniqueOrderIds } },
        data: { invoiced: true },
      });
      return invoice;
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('One or more orders are already invoiced.');
      }
      throw error;
    });
  }

  async getInvoices() {
    return this.prisma.invoice.findMany({
      include: {
        company: { select: { id: true, name: true } },
        orders: { include: { order: { select: { id: true, totalMinor: true, status: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: { select: { id: true, name: true } },
        orders: { include: { order: true } },
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
    return invoice;
  }

  async markAsPaid(invoiceId: string) {
    const updated = await this.prisma.invoice.updateMany({
      where: { id: invoiceId, status: InvoiceStatus.UNPAID },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    });
    if (updated.count !== 1) {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true } });
      if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
      throw new BadRequestException('Paid invoices are financially immutable.');
    }
    return this.getInvoice(invoiceId);
  }

  async removeOrder(invoiceId: string, orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { orders: { select: { id: true, orderId: true, totalMinor: true } } },
      });
      if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} was not found.`);
      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Paid invoices are financially immutable.');
      }
      const item = invoice.orders.find((entry) => entry.orderId === orderId);
      if (!item) throw new NotFoundException(`Order ${orderId} is not on this invoice.`);
      await tx.invoiceOrder.delete({ where: { id: item.id } });
      await tx.order.update({ where: { id: orderId }, data: { invoiced: false } });
      if (invoice.orders.length === 1) {
        await tx.invoice.delete({ where: { id: invoiceId } });
        return { id: invoiceId, deleted: true, orders: [] };
      }
      const nextTotal = invoice.orders
        .filter((entry) => entry.id !== item.id)
        .reduce((sum, entry) => sum + entry.totalMinor, 0);
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { totalMinor: nextTotal },
        include: { orders: { include: { order: { select: { id: true, totalMinor: true, status: true } } } } },
      });
    });
  }
}
