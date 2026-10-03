export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private readonly currentTime: Date;

  constructor(currentTime: Date) {
    this.currentTime = new Date(currentTime.getTime());
    if (Number.isNaN(this.currentTime.getTime())) {
      throw new Error('Fixed clock time must be a valid date');
    }
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }
}

export interface CalendarDate {
  isWorkingDay(date: string): boolean;
}

export class KitchenCalendarService implements CalendarDate {
  private readonly holidays: ReadonlySet<string>;

  constructor(
    holidays: readonly string[] = [],
    private readonly workingDays: CompanyWorkingDays = {
      mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false,
    },
  ) {
    this.holidays = new Set(holidays);
  }

  isWorkingDay(date: string): boolean {
    const weekday = parseCalendarDate(date).getUTCDay();
    const enabled = [
      this.workingDays.sun, this.workingDays.mon, this.workingDays.tue,
      this.workingDays.wed, this.workingDays.thu, this.workingDays.fri, this.workingDays.sat,
    ];
    return enabled[weekday] === true && !this.holidays.has(date);
  }

  subtractWorkingDays(date: string, days: number): string {
    if (!Number.isInteger(days) || days < 0) {
      throw new Error('Working-day count must be a non-negative integer');
    }

    const cursor = parseCalendarDate(date);
    let remaining = days;
    while (remaining > 0) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      const candidate = cursor.toISOString().slice(0, 10);
      if (this.isWorkingDay(candidate)) {
        remaining -= 1;
      }
    }
    return cursor.toISOString().slice(0, 10);
  }
}

export interface CompanyCalendar {
  canReceiveDelivery(date: string): boolean;
}

export interface CompanyWorkingDays {
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
}

export class CompanyCalendarService implements CompanyCalendar {
  private readonly holidays: ReadonlySet<string>;

  constructor(
    private readonly workingDays: CompanyWorkingDays,
    holidays: readonly string[] = [],
  ) {
    this.holidays = new Set(holidays);
  }

  canReceiveDelivery(date: string): boolean {
    if (this.holidays.has(date)) {
      return false;
    }

    const weekday = parseCalendarDate(date).getUTCDay();
    const enabled = [
      this.workingDays.sun,
      this.workingDays.mon,
      this.workingDays.tue,
      this.workingDays.wed,
      this.workingDays.thu,
      this.workingDays.fri,
      this.workingDays.sat,
    ];
    return enabled[weekday] === true;
  }
}

export interface CutoffCalculatorOptions {
  kitchenTimeZone: string;
  cutOffTime: string;
  cutOffWorkingDays: number;
  kitchenCalendar: KitchenCalendarService;
  clock: Clock;
}

export class CutoffCalculator {
  constructor(private readonly options: CutoffCalculatorOptions) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: options.kitchenTimeZone });
    } catch {
      throw new Error(`Invalid kitchen timezone: ${options.kitchenTimeZone}`);
    }
    this.validateTime(options.cutOffTime);
    if (!Number.isInteger(options.cutOffWorkingDays) || options.cutOffWorkingDays < 0) {
      throw new Error('Cutoff working days must be a non-negative integer');
    }
  }

  calculate(deliveryDate: Date): Date {
    if (Number.isNaN(deliveryDate.getTime())) {
      throw new Error('Delivery date must be valid');
    }
    const deliveryLocalDate = this.localDate(deliveryDate);
    const cutoffDate = this.options.kitchenCalendar.subtractWorkingDays(
      deliveryLocalDate,
      this.options.cutOffWorkingDays,
    );
    return this.localDateTimeToInstant(cutoffDate, this.options.cutOffTime);
  }

  isPastCutoff(deliveryDate: Date): boolean {
    return this.options.clock.now().getTime() > this.calculate(deliveryDate).getTime();
  }

  private localDate(value: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.options.kitchenTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  private localDateTimeToInstant(date: string, time: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    let guess = Date.UTC(year, month - 1, day, hour, minute);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const offset = this.timeZoneOffset(new Date(guess));
      guess = Date.UTC(year, month - 1, day, hour, minute) - offset;
    }
    return new Date(guess);
  }

  private timeZoneOffset(value: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.options.kitchenTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    return asUtc - value.getTime();
  }

  private validateTime(time: string): void {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error('Cutoff time must use HH:mm format');
    }
  }

}

function parseCalendarDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  if (parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return parsed;
}
