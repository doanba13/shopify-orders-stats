import { Injectable } from '@nestjs/common';
import { ShopifyRegistry } from '../services/shopify.registry';
import { OrderRepository } from './order.repository';

@Injectable()
export class OrdersService {
  constructor(
    private appRegistry: ShopifyRegistry,
    private orderRepository: OrderRepository,
  ) {}

  async syncAllApp(time: number) {
    const apps = this.appRegistry.getAllApp();

    for (const app of apps) {
      const orders = await app.repo.getOrders(time);
      for (const order of orders) {
        await this.orderRepository.processShopifyOrder(order, app.type);
      }
    }
  }
}
