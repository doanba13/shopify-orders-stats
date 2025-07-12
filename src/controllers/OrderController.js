const prisma = require('../config/database');
const { calculatePaymentFee } = require('../utils/payment');

class OrderController {
  async processShopifyOrder(orderData, app) {
    try {
      // console.log('Processing order:', orderData.id);

      // Use Prisma transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // 1. Upsert customer
        const customer = await this.upsertCustomer(tx, orderData);

        // 2. Create/update order
        const order = await this.upsertOrder(tx, orderData, customer?.id, app);

        // 3. Process line items
        await this.processLineItems(tx, orderData, order.id);

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

  async upsertCustomer(tx, orderData) {
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

  async upsertOrder(tx, orderData, customerId, app) {
    return await tx.order.upsert({
      where: { id: orderData.id.toString() },
      update: {
        orderId: orderData.order_number?.toString() || orderData.id.toString(),
        customerId: customerId,
        shipCountry: orderData.shipping_address?.country_code,
        revenue: parseFloat(orderData.total_price || '0'),
        paygateName: orderData.gateway || orderData.payment_gateway_names?.[0],
        createdAt: new Date(orderData.created_at),
        cost: 0, // Will be calculated based on line items
        app: app,
      },
      create: {
        id: orderData.id.toString(),
        orderId: orderData.order_number?.toString() || orderData.id.toString(),
        customerId: customerId,
        shipCountry: orderData.shipping_address?.country_code,
        revenue: parseFloat(orderData.total_price || '0'),
        paygateName: orderData.gateway || orderData.payment_gateway_names?.[0],
        createdAt: new Date(orderData.created_at),
        cost: 0,
        app: app,
      },
    });
  }

  async processLineItems(tx, orderData, orderId) {
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
      }

      // Create order line item
      await tx.orderLineItem.create({
        data: {
          orderId: orderId,
          itemId: lineItem.product_id.toString(),
          sku: lineItem.sku,
          quantity: lineItem.quantity,
          price: parseFloat(lineItem.price || '0'),
          name: lineItem.name,
          title: lineItem.title,
          giftCard: lineItem.gift_card || false,
          totalDiscount: parseFloat(lineItem.total_discount || '0'),
          vendorName: lineItem.vendor,
        },
      });
    }
  }

  async processPaymentGateway(tx, orderData, orderId) {
    if (orderData.gateway || orderData.payment_gateway_names?.[0]) {
      const gatewayName =
        orderData.gateway || orderData.payment_gateway_names[0];
      await tx.paygate.upsert({
        where: { orderId: orderId },
        update: {
          name: gatewayName,
          fee: calculatePaymentFee(
            gatewayName,
            parseFloat(orderData.total_price || '0'),
          ),
        },
        create: {
          orderId: orderId,
          name: gatewayName,
          fee: calculatePaymentFee(
            gatewayName,
            parseFloat(orderData.total_price || '0'),
          ),
        },
      });
    }
  }

  async getOrderWithDetails(orderId) {
    return await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        orderLineItems: {
          include: {
            product: {
              include: {
                variants: {
                  include: {
                    bases: true,
                  },
                },
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

    const orders = await prisma.order.findMany({
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

    const totalOrders = await prisma.order.count();
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
}

module.exports = new OrderController();
