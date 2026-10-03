import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const [settings, holidays] = await Promise.all([
      this.prisma.platformSettings.findUnique({ where: { id: 'default' } }),
      this.prisma.kitchenHoliday.findMany({ orderBy: { date: 'asc' } }),
    ]);
    return {
      id: settings?.id ?? 'default',
      kitchenTimeZone: settings?.kitchenTimeZone ?? 'Asia/Kolkata',
      cutOffTime: settings?.cutOffTime ?? '16:00',
      cutOffWorkingDays: settings?.cutOffWorkingDays ?? 2,
      mon: settings?.mon ?? true,
      tue: settings?.tue ?? true,
      wed: settings?.wed ?? true,
      thu: settings?.thu ?? true,
      fri: settings?.fri ?? true,
      sat: settings?.sat ?? false,
      sun: settings?.sun ?? false,
      kitchenHolidays: holidays.map((holiday) => ({
        id: holiday.id,
        date: holiday.date.toISOString().slice(0, 10),
        name: holiday.name,
      })),
    };
  }

  async updateSettings(data: UpdateSettingsDto) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: data.kitchenTimeZone }).format();
    } catch {
      throw new BadRequestException('kitchenTimeZone must be a valid IANA timezone.');
    }
    const holidayDates = [...new Set(data.kitchenHolidays ?? [])];
    const parsedHolidays = holidayDates.map((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || Number.isNaN(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== date
      ) {
        throw new BadRequestException('Kitchen holiday dates must use YYYY-MM-DD format.');
      }
      return { date: parsed, name: 'Kitchen holiday' };
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.platformSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          kitchenTimeZone: data.kitchenTimeZone,
          cutOffTime: data.cutOffTime,
          cutOffWorkingDays: data.cutOffWorkingDays,
          mon: data.mon, tue: data.tue, wed: data.wed, thu: data.thu,
          fri: data.fri, sat: data.sat, sun: data.sun,
        },
        update: {
          kitchenTimeZone: data.kitchenTimeZone,
          cutOffTime: data.cutOffTime,
          cutOffWorkingDays: data.cutOffWorkingDays,
          mon: data.mon, tue: data.tue, wed: data.wed, thu: data.thu,
          fri: data.fri, sat: data.sat, sun: data.sun,
        },
      });
      await tx.kitchenHoliday.deleteMany({});
      if (parsedHolidays.length) {
        await tx.kitchenHoliday.createMany({ data: parsedHolidays });
      }
    });
    return this.getSettings();
  }
}
