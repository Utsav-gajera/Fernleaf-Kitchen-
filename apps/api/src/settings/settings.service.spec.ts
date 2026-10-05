import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const noWorkingDays: UpdateSettingsDto = {
  kitchenTimeZone: 'Asia/Kolkata',
  cutOffTime: '16:00',
  cutOffWorkingDays: 1,
  kitchenReadyBufferMinutes: 30,
  mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
  kitchenHolidays: [],
};

for (const cutOffWorkingDays of [0, 1, 2]) {
  test(`rejects an empty kitchen schedule before database access with a ${cutOffWorkingDays}-day cutoff`, async () => {
    const service = new SettingsService({} as never);

    await assert.rejects(
      () => service.updateSettings({ ...noWorkingDays, cutOffWorkingDays }),
      (error: unknown) => error instanceof BadRequestException
        && error.getStatus() === 400
        && error.message === 'Select at least one kitchen working day.',
    );
  });
}

test('saves a kitchen schedule with only Sunday enabled', async () => {
  let savedSettings: unknown;
  const prisma = {
    platformSettings: {
      upsert: async ({ create }: { create: unknown }) => { savedSettings = create; },
      findUnique: async () => savedSettings,
    },
    kitchenHoliday: {
      deleteMany: async () => undefined,
      findMany: async () => [],
    },
    $transaction: async (callback: (tx: unknown) => Promise<void>) => callback(prisma),
  };
  const service = new SettingsService(prisma as never);

  const result = await service.updateSettings({ ...noWorkingDays, sun: true });

  assert.equal(result.sun, true);
  assert.equal(result.mon, false);
  assert.equal(result.cutOffWorkingDays, 1);
});
