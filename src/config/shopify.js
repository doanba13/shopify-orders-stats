/* eslint-disable no-unused-vars */
const axios = require('axios');

const variant = {};

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
    const set = new Set();

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

        for (const o of response.data?.orders || []) {
          if (set.has(o.id)) {
            continue;
          }

          set.add(o.id);
          result.push(o);
        }
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

  async getOrderById(id = '6281629171962') {
    try {
      const response = await this.shopifyAPI.get(`/orders/${id}.json`);

      const response2 = await this.shopifyAPI.get(
        '/products/8734241816826.json',
      );

      console.log(response.data.order);
      console.log(response2.data.product.variants.length);
      console.log(
        response2.data.product.variants.filter(
          (e) => e.id === '15188698333434' || e.id === 47160651481338,
        ),
      );
      console.log(response2.data.product.variants[0]);
    } catch (error) {
      this.error('We have error sir: ', error);
      this.handleError(error);
      throw error;
    }
  }

  async getVariantById(id) {
    const _v = variant[id];
    if(_v) {return _v;}

    try {
      const response = await this.shopifyAPI.get(
        `/variants/${id}.json`,
      );

      this.logger('Need to get variant: ', id);

      const v = response.data.variant;
      variant[v.id] = v;
      return v;
    } catch (error) {
      this.error('Get variant fail: ', id);
      return null;
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
