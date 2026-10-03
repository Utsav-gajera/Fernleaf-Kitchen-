import { Module, Get, Controller } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { StaffModule } from './staff/staff.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { MenuModule } from './menu/menu.module';
import { PricingModule } from './pricing/pricing.module';
import { OrdersModule } from './orders/orders.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { BillingModule } from './billing/billing.module';
import { SettingsModule } from './settings/settings.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CutoffsModule } from './cutoffs/cutoffs.module';

@Controller()
class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getRoot() {
    return {
      name: 'Kitchen Operations Admin Panel API',
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return {
        status: 'degraded',
        database: 'disconnected',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuthorizationModule,
    StaffModule,
    CompaniesModule,
    EmployeesModule,
    CatalogueModule,
    MenuModule,
    PricingModule,
    OrdersModule,
    KitchenModule,
    DispatchModule,
    BillingModule,
    SettingsModule,
    DashboardModule,
    CutoffsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
