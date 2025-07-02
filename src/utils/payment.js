const { PAYMENT_FEE_RATES, DEFAULT_FEE_RATE } = require("../config/constants");

function calculatePaymentFee(gatewayName, orderTotal) {
  const rate = PAYMENT_FEE_RATES[gatewayName.toLowerCase()] || DEFAULT_FEE_RATE;
  return Math.round(orderTotal * rate * 100) / 100; // Round to 2 decimal places
}

module.exports = { calculatePaymentFee };
