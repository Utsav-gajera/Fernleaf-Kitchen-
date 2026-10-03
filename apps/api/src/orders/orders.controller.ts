import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll() {
    return this.ordersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  async create(@Body() data: Record<string, unknown>) {
    return this.ordersService.create(data);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
