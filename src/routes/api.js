/* eslint-disable no-unused-vars */
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const StatsController = require('../controllers/StatsController');
const AnalyticsController = require('../controllers/AnalyticsController');
const shopifyRepos = require('../config/shopify');

// Statistics endpoints
router.get('/stats/daily', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await StatsController.getDailyStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Statistics endpoints
router.get('/do-some-shyt', async (req, res) => {
  try {
    const promises = shopifyRepos.map(async (repo) => {
      const orders = await repo.getOrders(8);

      for (const order of orders || []) {
        await OrderController.processShopifyOrder(order, repo.app);

        // await StatsController.updateOrderStats(order);
        // await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });

    await Promise.all(promises);

    res.json({
      success: true,
    });
  } catch (_) {
    res.status(500).json({
      success: false,
    });
  }
});

router.get('/do-some-shyt3', async (req, res) => {
  try {
    const promises = shopifyRepos.map(async (repo) => {
      await repo.getOrderById();
    });

    await Promise.all(promises);

    res.json({
      success: true,
    });
  } catch (_) {
    res.status(500).json({
      success: false,
    });
  }
});

router.get('/do-some-shyt2', async (req, res) => {
  try {
    await OrderController.calculateContributeMargin();

    res.json({
      success: true,
    });
  } catch (_) {
    res.status(500).json({
      success: false,
    });
  }
});

router.get('/stats/overall', async (req, res) => {
  try {
    const stats = await StatsController.getOverallStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching overall stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Order endpoints
router.get('/orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await OrderController.getOrdersWithPagination(page, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await OrderController.getOrderWithDetails(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Analytics endpoints
router.get('/products/analytics', async (req, res) => {
  try {
    const stats = await AnalyticsController.getProductAnalytics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching product analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/customers/analytics', async (req, res) => {
  try {
    const stats = await AnalyticsController.getCustomerAnalytics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
