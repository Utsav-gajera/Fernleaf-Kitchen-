import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BillingService } from './billing.service';

const companyId = '11111111-1111-4111-8111-111111111111';
const otherCompanyId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';

function fakePrisma(orders: Array<Record<string, unknown>>) {
  const invoice = {
    id: '44444444-4444-4444-8444-444444444444',
    companyId,
    status: 'UNPAID',
    totalMinor: 0,
  };
  const tx = {
    order: {
      findMany: async ({ where }: { where: { invoiceOrders?: { none: object }; companyId?: string; id?: { in: string[] }; billable?: boolean; status?: { in: string[] } } }) =>
        orders.filter((order) => {
          return (
            (!where.invoiceOrders || !((order.invoiceOrders as unknown[])?.length)) &&
            (!where.companyId || order.companyId === where.companyId) &&
            (!where.id || where.id.in.includes(order.id as string)) &&
            (!where.billable || order.billable === where.billable) &&
            (!where.status || where.status.in.includes(order.status as string))
          );
        }),
      updateMany: async () => ({ count: 1 }),
    },
    invoice: {
      create: async ({ data }: { data: { totalMinor: number } }) => ({ ...invoice, totalMinor: data.totalMinor }),
    },
  };
  return {
    $transaction: async <T>(callback: (transaction: typeof tx) => Promise<T>) => callback(tx),
    order: tx.order,
    invoice: {
      findMany: async () => [],
      findUnique: async () => null,
    },
  } as never;
}

test('creates an invoice with a reconciled integer-minor total', async () => {
  const service = new BillingService(fakePrisma([
    { id: orderId, companyId, billable: true, status: 'CONFIRMED', totalMinor: 1800, invoiceOrders: [] },
    { id: '55555555-5555-4555-8555-555555555555', companyId, billable: true, status: 'DELIVERED', totalMinor: 4920, invoiceOrders: [] },
  ]));
  const invoice = await service.createInvoice(companyId, [orderId, '55555555-5555-4555-8555-555555555555']);
  assert.equal(invoice.totalMinor, 6720);
});

test('rejects duplicate invoicing', async () => {
  const service = new BillingService(fakePrisma([
    { id: orderId, companyId, billable: true, status: 'CONFIRMED', totalMinor: 1800, invoiceOrders: [{ id: 'existing' }] },
  ]));
  await assert.rejects(
    service.createInvoice(companyId, [orderId]),
    /already invoiced/,
  );
});

test('rejects an order from the wrong company', async () => {
  const service = new BillingService(fakePrisma([
    { id: orderId, companyId: otherCompanyId, billable: true, status: 'CONFIRMED', totalMinor: 1800, invoiceOrders: [] },
  ]));
  await assert.rejects(
    service.createInvoice(companyId, [orderId]),
    /selected company/,
  );
});

test('rejects non-confirmed or non-billable orders', async () => {
  const service = new BillingService(fakePrisma([
    { id: orderId, companyId, billable: false, status: 'PLACED', totalMinor: 1800, invoiceOrders: [] },
  ]));
  await assert.rejects(
    service.createInvoice(companyId, [orderId]),
    /confirmed billable/,
  );
});
