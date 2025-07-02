const prisma = require("../config/database");

class AnalyticsController {
  async getProductAnalytics() {
    const topProducts = await prisma.product.findMany({
      include: {
        orderLineItems: {
          select: {
            quantity: true,
            price: true,
          },
        },
        variants: {
          select: {
            soldNumber: true,
          },
        },
      },
      orderBy: {
        variants: {
          _count: "desc",
        },
      },
      take: 10,
    });

    return topProducts.map((product) => {
      const totalQuantitySold = product.orderLineItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      const totalRevenue = product.orderLineItems.reduce(
        (sum, item) => sum + item.quantity * item.price.toNumber(),
        0
      );
      const variantsSold = product.variants.reduce(
        (sum, variant) => sum + variant.soldNumber,
        0
      );

      return {
        id: product.id,
        title: product.title,
        productType: product.productType,
        totalQuantitySold,
        totalRevenue,
        variantsSold,
        averagePrice:
          totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0,
      };
    });
  }

  async getCustomerAnalytics() {
    const topCustomers = await prisma.customer.findMany({
      include: {
        orders: {
          select: {
            revenue: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        orders: {
          _count: "desc",
        },
      },
      take: 10,
    });

    return topCustomers.map((customer) => {
      const totalOrders = customer.orders.length;
      const totalSpent = customer.orders.reduce(
        (sum, order) => sum + order.revenue.toNumber(),
        0
      );
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const lastOrderDate =
        customer.orders.length > 0
          ? Math.max(
              ...customer.orders.map((order) =>
                new Date(order.createdAt).getTime()
              )
            )
          : null;

      return {
        id: customer.id,
        email: customer.email,
        fullname: customer.fullname,
        country: customer.country,
        totalOrders,
        totalSpent,
        averageOrderValue,
        lastOrderDate: lastOrderDate ? new Date(lastOrderDate) : null,
      };
    });
  }
}

module.exports = new AnalyticsController();
