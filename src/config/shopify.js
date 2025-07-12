/* eslint-disable no-unused-vars */
const axios = require('axios');

class ShopifyRepository {
  constructor(baseURL, secret, app) {
    this.app = app;

    this.shopifyAPI = axios.create({
      baseURL: baseURL + '/admin/api/2025-07',
      headers: {
        'X-Shopify-Access-Token': secret,
        'Content-Type': 'application/json',
      },
    });
  }

  logger(...msg) {
    console.log(`${this.app} - `, ...msg);
  }

  error(...msg) {
    console.error(`${this.app} - `, ...msg);
  }

  async getOrders(time = 1) {
    let pageInfo;
    const result = [];

    try {
      for (const t of Array(time)
        .fill()
        .map((_, i) => i)) {
        const response = await this.shopifyAPI.get(
          `/orders.json?limit=250&${
            pageInfo
              ? pageInfo
              : 'status=any&fulfillment_status=any&financial_status=any'
          }`,
        );

        const headerLink = response.headers['link'];
        pageInfo = headerLink
          ?.split(';')?.[0]
          ?.split('&')
          ?.reverse()?.[0]
          .replace('>', '');

        result.push(...(response.data?.orders || []));
      }

      this.logger('Total orders:', result.length);
      this.logger('Process Successfully - Going to save orders');

      return result;
    } catch (error) {
      this.error('We have error sir: ', error);
      this.handleError(error);
      throw error;
    }
  }

  async getCustomer(ids) {
    try {
      const response = await this.shopifyAPI.get('/customers.json', {
        params: {
          ids,
        },
      });

      this.logger(response.data);

      return response.data.customers?.[0];
    } catch (error) {
      this.error('We have error sir: ', error);
      return null;
    }
  }

  handleError = (err, req, res, _next) => {
    this.error('API Error:', err.message);

    if (err.response) {
      const status = err.response.status;
      const message =
        err.response.data?.errors || err.response.data?.error || err.message;

      return res.status(status).json({
        success: false,
        error: message,
        details: err.response.data,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  };
}

const secrets = process.env.SHOPIFY_SECRET.split(',');
const apps = process.env.SHOPIFY_APP.split(',');
const url = process.env.SHOPIFY_URL.split(',');

module.exports = apps.map(
  (app, idx) => new ShopifyRepository(url[idx], secrets[idx], app),
);
