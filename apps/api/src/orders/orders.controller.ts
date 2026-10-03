import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Permission, Role } from '@project/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { RequirePermissions } from '../authorization/decorators/permissions.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, OrderListQueryDto, UpdateOrderDto } from './dto/order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions(Permission.ORDER_VIEW)
  findAll(@Query() query: OrderListQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('next-delivery-date')
  @RequirePermissions(Permission.ORDER_CREATE)
  nextDeliveryDate(@Query('employeeId') employeeId: string) {
    return this.ordersService.getNextDeliveryDate(employeeId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ORDER_VIEW)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.ORDER_CREATE)
  create(@Body() data: CreateOrderDto, @Req() request: { user: { id: string; role: Role } }) {
    return this.ordersService.create(data, request.user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ORDER_CREATE)
  update(
    @Param('id') id: string,
    @Body() data: UpdateOrderDto,
    @Req() request: { user: { role: Role } },
  ) {
    return this.ordersService.update(id, data, request.user);
  }

  @Post(':id/place')
  @RequirePermissions(Permission.ORDER_CREATE)
  place(@Param('id') id: string, @Req() request: { user: { role: Role } }) {
    return this.ordersService.place(id, request.user);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.ORDER_CREATE)
  cancel(@Param('id') id: string, @Req() request: { user: { role: Role } }) {
    return this.ordersService.cancel(id, request.user);
  }

  @Post(':id/force-complete')
  @RequirePermissions(Permission.ORDER_OVERRIDE)
  forceComplete(@Param('id') id: string, @Req() request: { user: { role: Role } }) {
    return this.ordersService.forceComplete(id, request.user);
  }
}
