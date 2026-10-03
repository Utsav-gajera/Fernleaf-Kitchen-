import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoices')
  @RequirePermissions(Permission.BILLING_MANAGE)
  async getInvoices() {
    return this.billingService.getInvoices();
  }

  @Post('invoices')
  @RequirePermissions(Permission.BILLING_MANAGE)
  async createInvoice(@Body('companyId') companyId: string, @Body('orderIds') orderIds: string[]) {
    return this.billingService.createInvoice(companyId, orderIds);
  }

  @Patch('invoices/:id/pay')
  @RequirePermissions(Permission.BILLING_MANAGE)
  async markAsPaid(@Param('id') invoiceId: string) {
    return this.billingService.markAsPaid(invoiceId);
  }
}
