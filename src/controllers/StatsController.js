const prisma = require('../config/database');

class StatsController {
  async updateOrderStats(orderData) {
    try {
      const orderDate = new Date(orderData.created_at);
      const dateOnly = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate(),
      );
      const revenue = parseFloat(orderData.total_price);

      const existingStats = await prisma.orderStats.findUnique({
        where: { date: dateOnly },
      });

      if (existingStats) {
        const newTotalOrders = existingStats.totalOrders + 1;
        const newTotalRevenue = existingStats.totalRevenue.toNumber() + revenue;
        const newAverageOrderValue = newTotalRevenue / newTotalOrders;

        await prisma.orderStats.update({
          where: { date: dateOnly },
          data: {
            totalOrders: newTotalOrders,
            totalRevenue: newTotalRevenue,
            averageOrderValue: newAverageOrderValue,
          },
        });
      } else {
        await prisma.orderStats.create({
          data: {
            date: dateOnly,
            totalOrders: 1,
            totalRevenue: revenue,
            averageOrderValue: revenue,
          },
        });
      }
    } catch (error) {
      console.error('Error updating order stats:', error);
    }
  }

  async getDailyStats(startDate, endDate) {
    const whereClause = {};
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    return await prisma.orderStats.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      take: 30, // Last 30 days by default
    });
  }

  async getOverallStats() {
    const totalOrders = await prisma.order.count();

    const totalRevenue = await prisma.orderStats.aggregate({
      _sum: {
        totalRevenue: true,
      },
    });

    const averageOrderValue = totalRevenue._sum.totalRevenue
      ? totalRevenue._sum.totalRevenue.toNumber() / totalOrders
      : 0;

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderId: true,
        revenue: true,
        customer: {
          select: {
            fullname: true,
          },
        },
        createdAt: true,
        paygateName: true,
      },
    });

    return {
      totalOrders,
      totalRevenue: totalRevenue._sum.totalRevenue?.toNumber() || 0,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      recentOrders,
    };
  }
}

module.exports = new StatsController();
