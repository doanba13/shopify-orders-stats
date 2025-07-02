require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  WEBHOOK_SECRET: process.env.SHOPIFY_WEBHOOK_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,

  // Payment gateway fee rates
  PAYMENT_FEE_RATES: {
    shopify_payments: 0.029, // 2.9%
    paypal: 0.034, // 3.4%
    stripe: 0.029, // 2.9%
    manual: 0, // No fee for manual payments
  },

  DEFAULT_FEE_RATE: 0.03, // 3% default
};
