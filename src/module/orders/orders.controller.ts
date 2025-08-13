import { Controller, Get, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Get()
  async syncAllShop(@Query('time') time: number) {
    return { data: await this.service.syncAllApp(time) };
  }
}
