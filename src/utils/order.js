class Util {
  /**
   * Get subtotal (product line items total before shipping/tax)
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static getSubtotal(order) {
    return parseFloat(
      order.subtotal_price ||
        order.current_subtotal_price ||
        order.total_line_items_price ||
        0,
    );
  }

  /**
   * Get total tax amount
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static getTax(order) {
    return parseFloat(order.total_tax || order.current_total_tax || 0);
  }

  /**
   * Get total shipping cost (shop currency)
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static getShipping(order) {
    if (order.total_shipping_price_set?.shop_money?.amount) {
      return parseFloat(order.total_shipping_price_set.shop_money.amount);
    }
    if (
      Array.isArray(order.shipping_lines) &&
      order.shipping_lines.length > 0
    ) {
      // Fallback: sum shipping lines
      return order.shipping_lines.reduce((sum, line) => {
        return sum + parseFloat(line.price || 0);
      }, 0);
    }
    return 0;
  }

  /**
   * Get total discount amount
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static getDiscount(order) {
    return parseFloat(
      order.total_discounts || order.current_total_discounts || 0,
    );
  }

  /**
   * Get total paid by customer
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static getTotal(order) {
    return parseFloat(order.total_price || order.current_total_price || 0);
  }

  /**
   * Get total paid by customer
   * @param {Object} order Shopify order payload
   * @returns {Number}
   */
  static toUSD(order) {
    return parseFloat(
      (order.total_price || order.current_total_price || 0) * 1.15,
    );
  }
}

module.exports = Util;
