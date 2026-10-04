import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrdersService } from './orders.service';
import { OrderListQueryDto } from './dto/order.dto';

test('lists newest-created orders first before pagination', async () => {
  let findManyArgs: { skip: number; take: number; orderBy: unknown } | undefined;
  const service = new OrdersService(
    {
      order: {
        findMany: (args: typeof findManyArgs) => {
          findManyArgs = args;
          return Promise.resolve([]);
        },
        count: () => Promise.resolve(0),
      },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    } as never,
    {} as never,
    {} as never,
  );

  const query = new OrderListQueryDto();
  query.page = 2;
  query.limit = 10;
  await service.findAll(query);

  assert.deepEqual(findManyArgs?.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert.equal(findManyArgs?.skip, 10);
  assert.equal(findManyArgs?.take, 10);
});

test('rejects a draft delivery-date edit when the selected date is already past cutoff', async () => {
  const service = new OrdersService(
    {
      platformSettings: {
        findUnique: async () => ({
          id: 'default',
          kitchenTimeZone: 'UTC',
          cutOffTime: '00:00',
          cutOffWorkingDays: 0,
          mon: true,
          tue: true,
          wed: true,
          thu: true,
          fri: true,
          sat: true,
          sun: true,
        }),
      },
      kitchenHoliday: { findMany: async () => [] },
    } as never,
    {} as never,
    { hasPermission: () => true } as never,
  );
  const date = new Date().toISOString().slice(0, 10);
  const employee = {
    company: {
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: true,
      holidays: [],
    },
  };

  await assert.rejects(
    () => service['validateDeliveryDate'](new Date(`${date}T12:00:00.000Z`), employee as never),
    /Order cutoff has passed/,
  );
});
