/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ShopifyRegistry } from '../services/shopify.registry';
import { OrderRepository } from './order.repository';
import { ShopifyService, ShopifyType } from '../services/types';

@Injectable()
export class OrdersService {
  constructor(
    private appRegistry: ShopifyRegistry,
    private orderRepository: OrderRepository,
  ) { }

  private logger = new Logger(OrdersService.name);

  async syncAllApp(time: number) {
    const apps = this.appRegistry.getAllApp();

    const repo: ShopifyService[] = [];
    for (const app of apps) repo.push(app);

    const quests = await Promise.all(
      repo.map(async (e) => ({
        app: e.type,
        data: await e.repo.getOrders(time),
      })),
    );

    for (const { app, data } of quests) {
      for (const o of data) {
        await this.orderRepository.processShopifyOrder(o, app);
      }
    }
  }

  async calContributeMargin(
    startDate: number,
    endDate: number,
    app?: ShopifyType,
  ) {
    if (app)
      return this.orderRepository.calculateContributeMargin(
        startDate,
        endDate,
        app,
      );

    return this.calContributeMarginAll(startDate, endDate);
  }

  // date: day.date,
  // revenue: day.revenue,
  // spend: day.spend,
  // orders: day.orders,
  // ads: faceBookAds?.[day.date],
  async calContributeMarginAll(startDate: number, endDate: number) {
    const apps = this.appRegistry.getAllApp();

    const results = {};
    let totalOrders: any[] = [];
    let newCustomer: any[] = [];

    for (const app of apps) {
      const { result, orders, newCustomer: nC } =
        await this.orderRepository.calculateContributeMargin(
          startDate,
          endDate,
          app.type,
        );

      totalOrders = [...totalOrders, ...orders];
      newCustomer = [...newCustomer, ...nC];

      for (const key in result) {
        if (Object.prototype.hasOwnProperty.call(result, key)) {
          const stat = result[key];
          
          if (results[key]) {
            results[key as string].orders += stat?.orders || 0;
            results[key as string].revenue += stat?.revenue || 0;
            results[key as string].spend += stat?.spend || 0;
            results[key as string].ads += stat?.ads || 0;
        } else {
          results[key] = stat;
        }
        }
      }
    }

    return { result: results, orders: totalOrders, newCustomer };
  }
}
