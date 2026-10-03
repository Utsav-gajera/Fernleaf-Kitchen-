import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../authorization/guards/roles.guard';
import { Roles } from '../authorization/decorators/roles.decorator';
import { Role } from '@project/shared';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @Roles(Role.ADMIN)
  async getInvoices() {
    return this.billingService.getInvoices();
  }

  @Post('invoices')
  @Roles(Role.ADMIN)
  async createInvoice(@Body('companyId') companyId: string, @Body('orderIds') orderIds: string[]) {
    return this.billingService.createInvoice(companyId, orderIds);
  }

  @Patch('invoices/:id/pay')
  @Roles(Role.ADMIN)
  async markAsPaid(@Param('id') invoiceId: string) {
    return this.billingService.markAsPaid(invoiceId);
  }
}
