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
  ) {}

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

    for (const app of apps) {
      const { result, orders } =
        await this.orderRepository.calculateContributeMargin(
          startDate,
          endDate,
          app.type,
        );

      totalOrders = [...totalOrders, ...orders];

      for (const stat of result) {
        if (results[stat.date] && result[stat.date as string]) {
          result[stat.date as string].orders += stat.orders;
          result[stat.date as string].revenue += stat.revenue;
          result[stat.date as string].spend += stat.spend;
          result[stat.date as string].ads += stat.ads;
        } else {
          results[stat.date] = stat;
        }
      }
    }

    return { result: results, orders: totalOrders };
  }
}
