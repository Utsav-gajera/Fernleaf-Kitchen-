import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { CutoffProcessor } from './cutoff-processor.service';

function createFakePrisma() {
  const orders = [
    { id: 'draft-1', deliveryDate: new Date('2026-10-07T00:00:00.000Z'), status: 'DRAFT', billable: false },
    { id: 'placed-1', deliveryDate: new Date('2026-10-07T00:00:00.000Z'), status: 'PLACED', billable: false },
  ];
  const timeline: Array<{ orderId: string; status: string }> = [];
  let processingCount = 0;
  const tx = {
    cutoffProcessing: {
      create: async () => {
        if (processingCount > 0) {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '5.22.0',
          });
        }
        processingCount += 1;
      },
    },
    order: {
      findMany: async ({ where }: { where: { status: string } }) =>
        orders.filter((order) => order.status === where.status).map(({ id }) => ({ id })),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { status: string; billable?: boolean } }) => {
        for (const order of orders) {
          if (where.id.in.includes(order.id)) {
            order.status = data.status;
            if (data.billable !== undefined) order.billable = data.billable;
          }
        }
        return { count: where.id.in.length };
      },
    },
    orderTimelineEvent: {
      createMany: async ({ data }: { data: Array<{ orderId: string; status: string }> }) => {
        timeline.push(...data);
      },
    },
  };
  return {
    orders,
    timeline,
    prisma: {
      platformSettings: { findUnique: async () => ({ kitchenTimeZone: 'UTC' }) },
      $transaction: async <T>(callback: (value: typeof tx) => Promise<T>) => callback(tx),
    },
  };
}

test('transitions drafts and placed orders and marks placed orders billable', async () => {
  const fake = createFakePrisma();
  const processor = new CutoffProcessor(fake.prisma as never);

  const result = await processor.process(new Date('2026-10-07T15:00:00.000Z'));

  assert.deepEqual(result, {
    deliveryDate: '2026-10-07',
    processed: true,
    cancelled: 1,
    confirmed: 1,
    billable: 1,
  });
  assert.equal(fake.orders[0].status, 'CANCELLED');
  assert.equal(fake.orders[1].status, 'CONFIRMED');
  assert.equal(fake.orders[1].billable, true);
  assert.deepEqual(
    fake.timeline.map(({ orderId, status }) => ({ orderId, status })),
    [
      { orderId: 'draft-1', status: 'CANCELLED' },
      { orderId: 'placed-1', status: 'CONFIRMED' },
    ],
  );
});

test('processing the same date twice is idempotent', async () => {
  const fake = createFakePrisma();
  const processor = new CutoffProcessor(fake.prisma as never);

  await processor.process(new Date('2026-10-07T00:00:00.000Z'));
  const second = await processor.process(new Date('2026-10-07T23:59:59.000Z'));

  assert.equal(second.processed, false);
  assert.equal(second.cancelled, 0);
  assert.equal(second.confirmed, 0);
  assert.equal(fake.timeline.length, 2);
});
