import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CompanyCalendarService,
  CutoffCalculator,
  FixedClock,
  KitchenCalendarService,
} from './cutoff-calculator';

const kitchen = (holidays: string[] = []) => new KitchenCalendarService(holidays);

function calculator(
  deliveryDate: string,
  cutOffWorkingDays: number,
  holidays: string[] = [],
  now = '2024-01-01T00:00:00.000Z',
) {
  return new CutoffCalculator({
    kitchenTimeZone: 'Asia/Kolkata',
    cutOffTime: '16:00',
    cutOffWorkingDays,
    kitchenCalendar: kitchen(holidays),
    clock: new FixedClock(new Date(now)),
  }).calculate(new Date(deliveryDate));
}

test('calculates Wednesday delivery with two working-day cutoff as Monday', () => {
  assert.equal(
    calculator('2024-01-10T00:00:00.000Z', 2).toISOString(),
    '2024-01-08T10:30:00.000Z',
  );
});

test('skips weekends when calculating cutoff', () => {
  assert.equal(
    calculator('2024-01-08T00:00:00.000Z', 1).toISOString(),
    '2024-01-05T10:30:00.000Z',
  );
});

test('skips kitchen holidays', () => {
  assert.equal(
    calculator('2024-01-10T00:00:00.000Z', 2, ['2024-01-09']).toISOString(),
    '2024-01-05T10:30:00.000Z',
  );
});

test('uses configured kitchen working days', () => {
  const service = new CutoffCalculator({
    kitchenTimeZone: 'Asia/Kolkata',
    cutOffTime: '16:00',
    cutOffWorkingDays: 1,
    kitchenCalendar: new KitchenCalendarService([], {
      mon: true,
      tue: true,
      wed: true,
      thu: true,
      fri: true,
      sat: true,
      sun: false,
    }),
    clock: new FixedClock(new Date('2024-01-04T00:00:00.000Z')),
  });

  assert.equal(service.calculate(new Date('2024-01-08T00:00:00.000Z')).toISOString(), '2024-01-06T10:30:00.000Z');
});

test('handles month boundaries', () => {
  assert.equal(
    calculator('2024-02-01T00:00:00.000Z', 2).toISOString(),
    '2024-01-30T10:30:00.000Z',
  );
});

test('rejects working-day subtraction when no kitchen weekdays are enabled', () => {
  const calendar = new KitchenCalendarService([], {
    mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false,
  });

  assert.throws(
    () => calendar.subtractWorkingDays('2026-10-07', 1),
    /Select at least one kitchen working day/,
  );
  assert.equal(calendar.subtractWorkingDays('2026-10-07', 0), '2026-10-07');
});

test('supports a single kitchen working weekday and skips holidays on that weekday', () => {
  const calendar = new KitchenCalendarService(['2026-10-07'], {
    mon: false, tue: false, wed: true, thu: false, fri: false, sat: false, sun: false,
  });

  assert.equal(calendar.subtractWorkingDays('2026-10-08', 1), '2026-09-30');
});

test('handles year boundaries', () => {
  assert.equal(
    calculator('2024-01-01T00:00:00.000Z', 1).toISOString(),
    '2023-12-29T10:30:00.000Z',
  );
});

test('company holidays do not alter kitchen cutoff', () => {
  const cutoff = calculator('2024-01-10T00:00:00.000Z', 2);
  const company = new CompanyCalendarService(
    { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    ['2024-01-08'],
  );
  assert.equal(cutoff.toISOString(), '2024-01-08T10:30:00.000Z');
  assert.equal(company.canReceiveDelivery('2024-01-08'), false);
});

test('uses the configured timezone safely', () => {
  const cutoff = new CutoffCalculator({
    kitchenTimeZone: 'America/New_York',
    cutOffTime: '16:00',
    cutOffWorkingDays: 1,
    kitchenCalendar: kitchen(),
    clock: new FixedClock(new Date('2024-07-04T00:00:00.000Z')),
  }).calculate(new Date('2024-07-08T00:00:00.000Z'));
  assert.equal(cutoff.toISOString(), '2024-07-05T20:00:00.000Z');
});

test('zero working-day cutoff uses the delivery local date', () => {
  assert.equal(
    calculator('2024-01-10T00:00:00.000Z', 0).toISOString(),
    '2024-01-10T10:30:00.000Z',
  );
});

test('cutoff is not past at the exact cutoff instant', () => {
  const cutoff = calculator('2024-01-10T00:00:00.000Z', 2);
  const service = new CutoffCalculator({
    kitchenTimeZone: 'Asia/Kolkata',
    cutOffTime: '16:00',
    cutOffWorkingDays: 2,
    kitchenCalendar: kitchen(),
    clock: new FixedClock(cutoff),
  });
  assert.equal(service.isPastCutoff(new Date('2024-01-10T00:00:00.000Z')), false);
});

test('rejects invalid calendar dates and delivery dates', () => {
  assert.throws(() => kitchen().isWorkingDay('2024-02-30'));
  assert.throws(() => new CompanyCalendarService({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  }).canReceiveDelivery('not-a-date'));
  assert.throws(() => calculator('invalid-date', 1));
});

test('rejects invalid timezone and cutoff configuration', () => {
  assert.throws(() => new CutoffCalculator({
    kitchenTimeZone: 'Not/A-Timezone',
    cutOffTime: '16:00',
    cutOffWorkingDays: 1,
    kitchenCalendar: kitchen(),
    clock: new FixedClock(new Date()),
  }));
  assert.throws(() => new CutoffCalculator({
    kitchenTimeZone: 'Asia/Kolkata',
    cutOffTime: '25:00',
    cutOffWorkingDays: 1,
    kitchenCalendar: kitchen(),
    clock: new FixedClock(new Date()),
  }));
});

test('FixedClock is isolated from later mutation of the input date', () => {
  const source = new Date('2024-01-01T00:00:00.000Z');
  const clock = new FixedClock(source);
  source.setUTCFullYear(2030);
  assert.equal(clock.now().toISOString(), '2024-01-01T00:00:00.000Z');
});
