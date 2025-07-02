const express = require("express");
const router = express.Router();
const { verifyShopifyWebhook } = require("../middleware/webhook");
const OrderManager = require("../controllers/OrderManager");
const StatsManager = require("../controllers/StatsManager");

// Shopify order webhook handler
router.post("/orders/create", verifyShopifyWebhook, async (req, res) => {
  try {
    const orderData = req.body;

    // Process order
    await OrderManager.processShopifyOrder(orderData);

    // Update daily stats
    await StatsManager.updateOrderStats(orderData);

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing order webhook:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
