import { Controller, Get, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { ShopifyType } from '../services/types';

@Controller('api/orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Post()
  async syncAllShop(@Query('time') time: number) {
    return { data: await this.service.syncAllApp(4) };
  }

  @Get('contribute-margin')
  async calculateContributeMargin(
    @Query('startDate') startDate: number,
    @Query('endDate') endDate: number,
    @Query('app') app: ShopifyType,
  ) {
    const { result, orders } = await this.service.calContributeMargin(
      startDate,
      endDate,
      app,
    );

    return { result, orders };
  }
}
