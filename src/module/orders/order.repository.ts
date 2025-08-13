/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { ShopifyRegistry } from '../services/shopify.registry';
import { Order, ShopifyType } from '../services/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { PrismaService } from 'src/prisma.service';
import { DefaultArgs } from '@prisma/client/runtime/binary';
import { Prisma, PrismaClient } from '@prisma/client';
import { Util } from './util';

dayjs.extend(utc);

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
  constructor(
    private appRegistry: ShopifyRegistry,
    private prisma: PrismaService,
    private util = new Util(),
  ) {}

  async processShopifyOrder(orderData: Order, app: ShopifyType) {
    try {
      // console.log('Processing order:', orderData.id);

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

      // console.log('Order processed successfully:', orderData.id);
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
        fullname: `${customer.first_name || ''} ${
          customer.last_name || ''
        }`.trim(),
        country: orderData.shipping_address?.country_code,
      },
      create: {
        id: customer.id.toString(),
        email: customer.email,
        fullname: `${customer.first_name || ''} ${
          customer.last_name || ''
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

  // +1
  generateParadisDate(startDate, endDate = null) {
    const startUnix =
      dayjs.unix(startDate).utc().startOf('day').unix() - 60 * 60;
    const endUnix =
      (endDate
        ? dayjs.unix(endDate).utc().endOf('day').unix()
        : dayjs.unix(startDate).utc().endOf('day').unix()) -
      60 * 60;

    const startDay = dayjs.unix(startUnix).utc();
    const endDay = dayjs.unix(endUnix).utc();

    console.log('hehe', startDay, endDay);

    return { startDay, endDay };
  }

  // -8
  generatePersoliebeDate(startDate, endDate = null) {
    const startUnix =
      dayjs.unix(startDate).utc().startOf('day').unix() + 8 * 60 * 60;
    const endUnix =
      (endDate
        ? dayjs.unix(endDate).utc().endOf('day').unix()
        : dayjs.unix(startDate).utc().endOf('day').unix()) +
      8 * 60 * 60;

    const startDay = dayjs.unix(startUnix).utc();
    const endDay = dayjs.unix(endUnix).utc();

    return { startDay, endDay };
  }

  generateAllDate(startDate, endDate) {
    const startDay = dayjs.unix(startDate).utc().startOf('day');
    const endDay = endDate
      ? dayjs.unix(endDate).utc().endOf('day')
      : dayjs.unix(startDate).utc().endOf('day');

    return { startDay, endDay };
  }

  dateFactory(startDate, endDate = null, app) {
    console.log('app', app);
    switch (app) {
      case 'Persoliebe':
        return this.generatePersoliebeDate(startDate, endDate);
      case 'Paradis':
        return this.generateParadisDate(startDate, endDate);

      default:
        return this.generateAllDate(startDate, endDate);
    }
  }

  generateParadisOrderDate(date) {
    const orderDate = dayjs(date).utc().unix() + 60 * 60;

    return dayjs.unix(orderDate).utc().format('DD-MM-YYYY');
  }

  generatePersoliebeOrderDate(date) {
    const orderDate = dayjs(date).utc().unix() - 8 * 60 * 60;

    return dayjs.unix(orderDate).utc().format('DD-MM-YYYY');
  }

  genOrderDateFactory(date, app) {
    switch (app) {
      case 'Persoliebe':
        return this.generatePersoliebeOrderDate(date);
      case 'Paradis':
        return this.generateParadisOrderDate(date);

      default:
        return dayjs(date).utc().format('DD-MM-YYYY');
    }
  }

  async calculateContributeMargin(
    startDate: number,
    endDate = null,
    app: ShopifyType,
  ) {
    try {
      const repo = this.appRegistry.getApp(app);
      const { startDay, endDay } = this.dateFactory(startDate, endDate, app);

      const faceBookAds = await repo?.fb.getAdsExpense(startDate, endDate);
      // const faceBookAds = {};

      // Find orders within the date range
      const orders = await this.prisma.client.order.findMany({
        where: {
          createdAt: {
            gte: startDay.toDate(),
            lte: endDay.toDate(),
          },
          app,
        },
        include: {
          orderLineItems: true,
        },
      });

      console.log(startDay.toDate(), endDay.toDate());

      if (orders.length === 0) {
        return [];
      }

      console.log(orders);

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

      // Group orders by date and calculate metrics
      const dailyMetrics = {};

      for (const order of orders) {
        const orderDate = this.genOrderDateFactory(order.createdAt, app);

        // Initialize daily metrics if not exists
        if (!dailyMetrics[orderDate]) {
          dailyMetrics[orderDate] = {
            date: orderDate,
            revenue: 0,
            spend: 0,
            orders: 0,
          };
        }

        // Add revenue for this order
        dailyMetrics[orderDate].revenue += +order.revenue;
        dailyMetrics[orderDate].orders += 1;

        // Calculate spend for this order
        for (const item of order.orderLineItems) {
          const itemsBase =
            baseCost[`${item.sku}_${order.shipCountry}`] ?? 18.99;
          dailyMetrics[orderDate].spend += itemsBase.toNumber() * item.quantity;
        }
      }

      // Convert to array and apply margin multiplier
      const result: Record<string, any>[] = Object.values(dailyMetrics).map(
        (day: Record<string, any>) => ({
          date: day.date,
          revenue: day.revenue,
          spend: day.spend,
          orders: day.orders,
          ads: faceBookAds?.[day.date],
        }),
      );

      // Sort by date
      result.sort((a, b) =>
        dayjs(a.date, 'DD-MM-YYYY').diff(dayjs(b.date, 'DD-MM-YYYY').utc()),
      );

      return { result, orders };
    } catch (error) {
      console.error('Error calculating contribute margin:', error);
      throw error;
    }
  }
}
