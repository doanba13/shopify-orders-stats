import { Controller, Get, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { ShopifyType } from '../services/types';

@Controller('api/orders')
export class OrdersController {
  constructor(private service: OrdersService) { }

  @Post()
  async syncAllShop() {
    return { data: await this.service.syncAllApp(1) };
  }

  @Get('contribute-margin')
  async calculateContributeMargin(
    @Query('startDate') startDate: number,
    @Query('endDate') endDate: number,
    @Query('app') app: ShopifyType,
  ) {
    return await this.service.calContributeMargin(
      startDate,
      endDate,
      app,
    );
  }
}
