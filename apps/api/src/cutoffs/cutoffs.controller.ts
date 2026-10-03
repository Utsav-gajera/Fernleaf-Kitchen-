import { BadRequestException, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../authorization/guards/admin.guard';
import { CutoffProcessor } from '../orders/cutoff-processor.service';

@Controller('cutoffs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class CutoffsController {
  constructor(private readonly cutoffProcessor: CutoffProcessor) {}

  @Post(':deliveryDate/process')
  process(@Param('deliveryDate') deliveryDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      throw new BadRequestException('Delivery date must use YYYY-MM-DD format.');
    }
    const date = new Date(`${deliveryDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== deliveryDate) {
      throw new BadRequestException('Delivery date must be valid.');
    }
    return this.cutoffProcessor.process(date);
  }
}
