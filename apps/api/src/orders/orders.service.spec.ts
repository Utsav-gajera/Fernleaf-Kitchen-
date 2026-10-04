import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrdersService } from './orders.service';

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
