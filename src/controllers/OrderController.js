const prisma = require('../config/database');
const { calculatePaymentFee } = require('../utils/payment');

class OrderController {
  async processShopifyOrder(orderData) {
    try {
      console.log('Processing order:', orderData.id);

      // Use Prisma transaction to ensure data consistency
      await prisma.$transaction(async (tx) => {
        // 1. Upsert customer
        const customer = await this.upsertCustomer(tx, orderData);

        // 2. Create/update order
        const order = await this.upsertOrder(tx, orderData, customer?.id);

        // 3. Process line items
        await this.processLineItems(tx, orderData, order.id);

        // 4. Handle payment gateway
        await this.processPaymentGateway(tx, orderData, order.id);
      });

      console.log('Order processed successfully:', orderData.id);
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

    return await tx.customer.upsert({
      where: { id: orderData.customer.id.toString() },
      update: {
        email: orderData.customer.email,
        fullname: `${orderData.customer.first_name || ''} ${
          orderData.customer.last_name || ''
        }`.trim(),
        country: orderData.shipping_address?.country_code,
      },
      create: {
        id: orderData.customer.id.toString(),
        email: orderData.customer.email,
        fullname: `${orderData.customer.first_name || ''} ${
          orderData.customer.last_name || ''
        }`.trim(),
        country: orderData.shipping_address?.country_code,
      },
    });
  }

  async upsertOrder(tx, orderData, customerId) {
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
      },
    });
  }

  async processLineItems(tx, orderData, orderId) {
    for (const lineItem of orderData.line_items || []) {
      // Upsert product
      await tx.product.upsert({
        where: { id: lineItem.product_id.toString() },
        update: {
          title: lineItem.title,
          body: lineItem.name,
          productType: lineItem.product_type || 'unknown',
          updatedAt: new Date(),
        },
        create: {
          id: lineItem.product_id.toString(),
          title: lineItem.title,
          body: lineItem.name,
          productType: lineItem.product_type || 'unknown',
          updatedAt: new Date(),
        },
      });

      // Upsert product variant if variant_id exists
      if (lineItem.variant_id) {
        await tx.productVariant.upsert({
          where: { id: lineItem.variant_id.toString() },
          update: {
            soldNumber: { increment: lineItem.quantity },
          },
          create: {
            id: lineItem.variant_id.toString(),
            productId: lineItem.product_id.toString(),
            size: lineItem.variant_title?.includes('Size')
              ? lineItem.variant_title
              : null,
            color: lineItem.variant_title?.includes('Color')
              ? lineItem.variant_title
              : null,
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
