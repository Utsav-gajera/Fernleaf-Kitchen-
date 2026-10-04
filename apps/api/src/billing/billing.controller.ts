import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Permission } from '@project/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/billing.dto';

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermissions(Permission.BILLING_MANAGE)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing/companies/:companyId/uninvoiced')
  getUninvoiced(@Param('companyId') companyId: string) {
    return this.billingService.getUninvoicedOrders(companyId);
  }

  @Post('invoices')
  createInvoice(@Body() data: CreateInvoiceDto) {
    return this.billingService.createInvoice(data.companyId, data.orderIds);
  }

  @Get('invoices')
  getInvoices() {
    return this.billingService.getInvoices();
  }

  @Get('invoices/:id')
  getInvoice(@Param('id') invoiceId: string) {
    return this.billingService.getInvoice(invoiceId);
  }

  @Post('invoices/:id/paid')
  markAsPaid(@Param('id') invoiceId: string) {
    return this.billingService.markAsPaid(invoiceId);
  }

  @Delete('invoices/:id/orders/:orderId')
  removeOrder(@Param('id') invoiceId: string, @Param('orderId') orderId: string) {
    return this.billingService.removeOrder(invoiceId, orderId);
  }
}
