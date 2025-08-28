/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ShopifyRegistry } from '../services/shopify.registry';
import { Order, ShopifyType } from '../services/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { PrismaService } from 'src/prisma.service';
import { DefaultArgs } from '@prisma/client/runtime/binary';
import { Prisma, PrismaClient, Order as DBOrder } from '@prisma/client';
import { Util } from './util';
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

type TX = Omit<
  PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Payment gateway fee rates
const PAYMENT_FEE_RATES: Record<string, number> = {
  shopify_payments: 0.029, // 2.9%
  paypal: 0.034, // 3.4%
  stripe: 0.029, // 2.9%
  manual: 0, // No fee for manual payments
};

const DEFAULT_FEE_RATE = 0.03;

function calculatePaymentFee(gatewayName: string, orderTotal: number) {
  const rate = PAYMENT_FEE_RATES[gatewayName.toLowerCase()] || DEFAULT_FEE_RATE;
  return Math.round(orderTotal * rate * 100) / 100; // Round to 2 decimal places
}

@Injectable()
export class OrderRepository {
  private util = new Util();
  private logger = new Logger(OrderRepository.name);

  constructor(
    private appRegistry: ShopifyRegistry,
    private prisma: PrismaService,
  ) { }

  async processShopifyOrder(orderData: Order, app: ShopifyType) {
    try {
      const order = await this.prisma.client.order.findUnique({
        where: { id: orderData.id.toString() },
      });

      if (order) {
        this.logger.log('Return due to Order already saved!');
        return;
      }

      // Use Prisma transaction to ensure data consistency
      await this.prisma.client.$transaction(async (tx) => {
        // 1. Upsert customer
        const customer = await this.upsertCustomer(tx, orderData);

        // 2. Create/update order
        const order = await this.upsertOrder(tx, orderData, customer?.id, app);

        // 3. Process line items
        await this.processLineItems(tx, orderData, order.id, app);

        // 4. Handle payment gateway
        await this.processPaymentGateway(tx, orderData, order.id);
      });

      return { success: true };
    } catch (error) {
      console.error('Error processing order:', error);
      throw error;
    }
  }

  async upsertCustomer(tx: TX, orderData: Order) {
    if (!orderData.customer) {
      return null;
    }

    const customer = orderData.customer;

    return await tx.customer.upsert({
      where: { id: customer.id.toString() },
      update: {
        email: customer.email,
        fullname: `${customer.first_name || ''} ${customer.last_name || ''
          }`.trim(),
        country: orderData.shipping_address?.country_code,
      },
      create: {
        id: customer.id.toString(),
        email: customer.email,
        fullname: `${customer.first_name || ''} ${customer.last_name || ''
          }`.trim(),
        country: orderData.shipping_address?.country_code,
      },
    });
  }

  async upsertOrder(
    tx: TX,
    orderData: Order,
    customerId?: string,
    app?: ShopifyType,
  ) {
    return await tx.order.upsert({
      where: { id: orderData.id.toString() },
      update: {
        orderId: orderData.order_number?.toString() || orderData.id.toString(),
        customerId: customerId,
        shipCountry: orderData.shipping_address?.country_code,
        revenue: parseFloat(`${orderData.total_price || '0'}`),
        paygateName: orderData.gateway || orderData.payment_gateway_names?.[0],
        createdAt: new Date(orderData.created_at),
        cost: 0, // Will be calculated based on line items
        app: app,

        revenueUSD: Util.toUSD(orderData),
        discount: Util.getDiscount(orderData),
        tax: Util.getTax(orderData),
        shipped: Util.getShipping(orderData),
        subTotal: Util.getSubtotal(orderData),
      },
      create: {
        id: orderData.id.toString(),
        orderId: orderData.order_number?.toString() || orderData.id.toString(),
        customerId: customerId,
        shipCountry: orderData.shipping_address?.country_code,
        revenue: parseFloat(`${orderData.total_price || '0'}`),
        paygateName: orderData.gateway || orderData.payment_gateway_names?.[0],
        createdAt: new Date(orderData.created_at),
        cost: 0,
        app: app!,
        revenueUSD: Util.toUSD(orderData),
        discount: Util.getDiscount(orderData),
        tax: Util.getTax(orderData),
        shipped: Util.getShipping(orderData),
        subTotal: Util.getSubtotal(orderData),
      },
    });
  }

  async processLineItems(
    tx: TX,
    orderData: Order,
    orderId: string,
    app: ShopifyType,
  ) {
    for (const lineItem of orderData.line_items || []) {
      if (!lineItem.product_id) {
        continue;
      }

      const productType =
        lineItem.variant_title?.split('/')?.[0]?.trim() || 'unknown';
      // Upsert product
      await tx.product.upsert({
        where: { id: lineItem.product_id.toString() },
        update: {
          title: lineItem.title,
          body: lineItem.name,
          productType,
          updatedAt: new Date(),
        },
        create: {
          id: lineItem.product_id.toString(),
          title: lineItem.title,
          body: lineItem.name,
          productType,
          updatedAt: new Date(),
        },
      });

      // Upsert product variant if variant_id exists
      if (lineItem.variant_id) {
        const size = lineItem.variant_title?.split('/')?.reverse()?.[0]?.trim();
        if (!size) {
          return;
        }

        await tx.productVariant.upsert({
          where: { id: lineItem.variant_id.toString(), size },
          update: {
            soldNumber: { increment: lineItem.quantity },
          },
          create: {
            id: lineItem.variant_id.toString(),
            productId: lineItem.product_id.toString(),
            size,
            soldNumber: lineItem.quantity,
          },
        });

        let sku = lineItem.sku;
        if (!lineItem.sku || sku === 'PPF005') {
          const repo = this.appRegistry.getApp(app);
          const vr = await repo?.repo.getVariantById(lineItem.variant_id);
          sku = vr?.sku || lineItem.sku;
        }

        // Create order line item
        if (sku) {
          await tx.orderLineItem.create({
            data: {
              orderId: orderId,
              itemId: lineItem.product_id.toString(),
              sku,
              quantity: lineItem.quantity,
              price: parseFloat(`${lineItem.price || '0'}`),
              name: lineItem.name,
              title: lineItem.title,
              giftCard: lineItem.gift_card || false,
              totalDiscount: parseFloat(`${lineItem.total_discount || '0'}`),
              vendorName: lineItem.vendor,
            },
          });
        }
      }
    }
  }

  async processPaymentGateway(tx: TX, orderData: Order, orderId: string) {
    if (orderData.gateway || orderData.payment_gateway_names?.[0]) {
      const gatewayName =
        orderData.gateway || orderData.payment_gateway_names[0];
      await tx.paygate.upsert({
        where: { orderId: orderId },
        update: {
          name: gatewayName,
          fee: calculatePaymentFee(
            gatewayName,
            parseFloat(`${orderData.total_price || '0'}`),
          ),
        },
        create: {
          orderId: orderId,
          name: gatewayName,
          fee: calculatePaymentFee(
            gatewayName,
            parseFloat(`${orderData.total_price || '0'}`),
          ),
        },
      });
    }
  }

  async getOrderWithDetails(orderId: string) {
    return await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        orderLineItems: {
          include: {
            product: {
              include: {
                variants: true,
              },
            },
          },
        },
        refund: true,
        paygate: true,
      },
    });
  }

  async getOrdersWithPagination(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const orders = await this.prisma.client.order.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        orderLineItems: {
          include: {
            product: true,
          },
        },
        refund: true,
        paygate: true,
      },
    });

    const totalOrders = await this.prisma.client.order.count();
    const totalPages = Math.ceil(totalOrders / limit);

    return {
      orders,
      pagination: {
        currentPage: page,
        totalPages,
        totalOrders,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  generateZoneDates(startDate: number, endDate?: number, zone = "UTC") {
    // interpret timestamp as a local calendar day, not as an instant
    const startStr = dayjs.unix(startDate).utc().format("YYYY-MM-DD");
    const endStr = endDate
      ? dayjs.unix(endDate).utc().format("YYYY-MM-DD")
      : startStr;

    const startLocal = dayjs.tz(startStr, "YYYY-MM-DD", zone).startOf("day");
    const endLocal = dayjs.tz(endStr, "YYYY-MM-DD", zone).endOf("day").millisecond(0);

    return {
      startUTC: startLocal.utc().toDate(),
      endUTC: endLocal.utc().toDate(),
    };
  }



  // your app-specific wrappers
  generateParadisDate(startDate: number, endDate?: number) {
    return this.generateZoneDates(startDate, endDate, "Europe/Amsterdam");
  }
  generatePersoliebeDate(startDate: number, endDate?: number) {
    return this.generateZoneDates(startDate, endDate, "Pacific/Pitcairn"); // UTC-8
  }
  generateAllDate(startDate: number, endDate?: number) {
    return this.generateZoneDates(startDate, endDate, "UTC");
  }

  dateFactory(startDate: number, endDate?: number, app?: string) {
    switch (app) {
      case "Persoliebe":
        return this.generatePersoliebeDate(startDate, endDate);
      case "Paradis":
        return this.generateParadisDate(startDate, endDate);
      default:
        return this.generateAllDate(startDate, endDate);
    }
  }

  genOrderDateFactory(date: string, app: string) {
    const zones: Record<string, string> = {
      Persoliebe: "Pacific/Pitcairn",       // UTC-8
      Paradis: "Europe/Amsterdam",   // Dutch timezone (+1/+2 DST)
    };

    const zone = zones[app] || "UTC";

    return dayjs.utc(date).tz(zone).format("DD-MM-YYYY");
  }


  async calculateContributeMargin(
    startDate: number,
    endDate: number | null,
    app: ShopifyType,
  ): Promise<{ result: Record<string, any>; orders: any[]; newCustomer: any[] }> {
    try {
      const repo = this.appRegistry.getApp(app);
      this.logger.log(`Calculate Contribution Margin of: ${app}`)

      const { startUTC: startDay, endUTC: endDay } = this.dateFactory(startDate, endDate || undefined, app);


      this.logger.log(startDate, endDate || undefined, dayjs.unix(startDate).toDate(), startDay, endDay)

      if (!repo?.fb) return { orders: [], result: [], newCustomer: [] };

      const faceBookAds = await repo?.fb.getAdsExpense(startDate, endDate);
      const dailyMetrics = {};
      for (const key in faceBookAds) {
        if (Object.prototype.hasOwnProperty.call(faceBookAds, key)) {
          dailyMetrics[key] = {
            ads: faceBookAds[key].spend,
            date: key,
            revenue: 0,
            spend: 0,
            orders: 0,
            newRevenue: 0,
            newOrder: 0,
            newSpend: 0,
          }
        }
      }

      // Find orders within the date range
      const orders = await this.prisma.client.order.findMany({
        where: {
          createdAt: {
            gte: startDay,
            lte: endDay,
          },
          app,
        },
        include: {
          orderLineItems: true,
        },
        orderBy: {
          createdAt: "asc",
        }
      });

      if (orders.length === 0) {
        this.logger.log(`These are no orders of: ${app}`)
        return { orders: [], result: dailyMetrics, newCustomer: [] };
      }

      const newCustomer = await this.findNewCustomer(orders);
      const _newCustomer = new Set(newCustomer.map(e => e.id));

      // Collect all country-sku combinations
      const countrySku: { sku: string; country: string }[] = [];
      for (const order of orders) {
        const country = order.shipCountry;
        for (const lineItem of order.orderLineItems) {
          if (lineItem.sku && country)
            countrySku.push({ sku: lineItem.sku, country });
        }
      }

      // Get base costs for all country-sku combinations
      const bases = await this.prisma.client.base.findMany({
        where: {
          OR: countrySku,
        },
      });

      // Create base cost lookup map
      const baseCost: Record<string, Prisma.Decimal> = {};
      for (const bs of bases) {
        baseCost[`${bs.sku}_${bs.country}`] = bs.baseCost;
      }

      for (const order of orders) {
        const orderDate = this.genOrderDateFactory(order.createdAt.toISOString(), app);

        // Initialize daily metrics if not exists
        if (!dailyMetrics[orderDate]) {
          dailyMetrics[orderDate] = {
            date: orderDate,
            revenue: 0,
            spend: 0,
            orders: 0,
            newOrder: 0,
            newRevenue: 0,
          };
        }

        // Add revenue for this order
        dailyMetrics[orderDate].revenue += +order.revenue;
        dailyMetrics[orderDate].orders += 1;



        let base = 0;

        // Calculate spend for this order
        for (const item of order.orderLineItems) {
          const itemsBase =
            baseCost[`${item.sku}_${order.shipCountry}`] ??
            Prisma.Decimal(14.99);

          dailyMetrics[orderDate].spend += itemsBase.toNumber() * item.quantity;
          base += itemsBase.toNumber() * item.quantity;
          item['cost'] = itemsBase.toNumber() * item.quantity;
        }
        const shipDiscount = this.calcShipDiscount(order.orderLineItems)

        order['base'] = base - shipDiscount;
        order['shipDiscount'] = shipDiscount;
        dailyMetrics[orderDate].spend -= shipDiscount;

        if (order.customerId && _newCustomer.has(order.customerId)) {
          dailyMetrics[orderDate].newOrder += 1;
          dailyMetrics[orderDate].newRevenue += +order.revenue;
          dailyMetrics[orderDate].newSpend += base - shipDiscount;
        }
      }

      return { result: dailyMetrics, orders, newCustomer };
    } catch (error) {
      console.error('Error calculating contribute margin:', error);
      throw error;
    }
  }

  private calcShipDiscount(items: { quantity: number }[]) {
    const count = items.reduce((p, c) => p + c.quantity, 0);
    if (count < 1) return 0;
    return 2.5 * (count - 1)
  }

  private async findNewCustomer(orders: DBOrder[]) {
    const customerIds = orders.filter(e => e.customerId !== null).map(e => e.customerId)

    const grouped = await this.prisma.client.order.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: customerIds as string[] },
      },
      _count: {
        customerId: true,
      },
      having: {
        customerId: {
          _count: { equals: 1 },
        },
      },
    });

    const newCustomerIds = grouped.map(g => g.customerId);

    return await this.prisma.client.customer.findMany({
      where: {
        id: { in: newCustomerIds as string[] },
      }
    });
  }
}
