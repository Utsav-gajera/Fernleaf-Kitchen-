import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { Permission } from '@project/shared';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(Permission.ORDER_VIEW)
  async findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_VIEW)
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  async create(@Body() data: Record<string, unknown>) {
    return this.ordersService.create(data);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.ORDER_OVERRIDE)
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
