const crypto = require("crypto");
const { WEBHOOK_SECRET } = require("../config/constants");

function verifyShopifyWebhook(req, res, next) {
  const hmac = req.get("X-Shopify-Hmac-Sha256");
  const body = req.body;

  if (!WEBHOOK_SECRET) {
    console.error("SHOPIFY_WEBHOOK_SECRET is not configured");
    return res.status(500).send("Server configuration error");
  }

  const hash = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  if (hash !== hmac) {
    console.log("Webhook verification failed");
    return res.status(401).send("Unauthorized");
  }

  // Parse the JSON for further processing
  try {
    req.body = JSON.parse(body);
    next();
  } catch (error) {
    console.error("Invalid JSON in webhook payload:", error);
    res.status(400).send("Invalid JSON");
  }
}

module.exports = { verifyShopifyWebhook };
