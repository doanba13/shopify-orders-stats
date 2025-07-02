const express = require('express');
const router = express.Router();
const { verifyShopifyWebhook } = require('../middleware/webhook');
const OrderController = require('../controllers/OrderController');
const StatsController = require('../controllers/StatsController');

// Shopify order webhook handler
router.post('/orders/create', verifyShopifyWebhook, async (req, res) => {
  try {
    const orderData = req.body;

    // Process order
    await OrderController.processShopifyOrder(orderData);

    // Update daily stats
    await StatsController.updateOrderStats(orderData);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing order webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
