import { BadRequestException, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';
import { CutoffProcessor } from '../orders/cutoff-processor.service';
import { PrismaService } from '../prisma/prisma.service';
import { CutoffCalculator, KitchenCalendarService } from '../orders/domain/cutoff-calculator';

@Controller('cutoffs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CutoffsController {
  constructor(
    private readonly cutoffProcessor: CutoffProcessor,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':deliveryDate/process')
  @RequirePermissions(Permission.ORDER_OVERRIDE)
  async process(@Param('deliveryDate') deliveryDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      throw new BadRequestException('Delivery date must use YYYY-MM-DD format.');
    }
    const date = new Date(`${deliveryDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== deliveryDate) {
      throw new BadRequestException('Delivery date must be valid.');
    }
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'default' } });
    if (!settings) throw new BadRequestException('Kitchen cutoff settings are not configured.');
    const holidays = await this.prisma.kitchenHoliday.findMany({ select: { date: true } });
    const calculator = new CutoffCalculator({
      kitchenTimeZone: settings.kitchenTimeZone,
      cutOffTime: settings.cutOffTime,
      cutOffWorkingDays: settings.cutOffWorkingDays,
      kitchenCalendar: new KitchenCalendarService(
        holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
        settings,
      ),
      clock: { now: () => new Date() },
    });
    if (!calculator.isPastCutoff(this.localDateAtNoon(deliveryDate, settings.kitchenTimeZone))) {
      throw new BadRequestException('Manual cutoff processing is allowed only after the configured cutoff has passed.');
    }
    return this.cutoffProcessor.process(date);
  }

  private localDateAtNoon(date: string, timeZone: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    const target = Date.UTC(year, month - 1, day, 12, 0);
    let guess = target;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).formatToParts(new Date(guess));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const localAsUtc = Date.UTC(
        Number(values.year), Number(values.month) - 1, Number(values.day),
        Number(values.hour), Number(values.minute), Number(values.second),
      );
      guess += target - localAsUtc;
    }
    return new Date(guess);
  }
}
