/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Logger } from '@nestjs/common';
import { Order, OrdersResponse, ShopifyType, Variant } from './types';
import axios, { AxiosError } from 'axios';

export class ShopifyRepository {
  private readonly app: ShopifyType;
  private readonly url: string;
  private readonly secrets: string;

  private variant = new Map<number, Variant>();

  private readonly _log = new Logger(ShopifyRepository.name);

  private readonly api: axios.AxiosInstance;

  constructor(app: ShopifyType, url: string, secrets: string) {
    this.secrets = secrets;
    this.app = app;
    this.url = url;

    this.api = axios.create({
      baseURL: this.url + '/admin/api/2025-07',
      headers: {
        'X-Shopify-Access-Token': this.secrets,
        'Content-Type': 'application/json',
      },
    });
  }

  logger(...msg) {
    this._log.log(`${this.app} - `, ...msg);
  }

  error(...msg) {
    this._log.error(`${this.app} - `, ...msg);
  }

  async getOrders(time = 1) {
    let pageInfo: string = '';
    const result: Order[] = [];
    const set = new Set<string>();

    try {
      for (const _ of Array(time)
        .fill(null)
        .map((_, i) => i)) {
        const response = await this.api.get<OrdersResponse>(
          `/orders.json?limit=250&${pageInfo
            ? pageInfo
            : 'status=any&fulfillment_status=any&financial_status=any'
          }`,
        );

        const headerLink = response.headers['link'] as string | undefined;

        pageInfo =
          headerLink
            ?.split(';')?.[0]
            ?.split('&')
            ?.reverse()?.[0]
            .replace('>', '') || '';

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

  /**
 * Fetch all Shopify orders by batching with date ranges.
 * 
 * @param {string} startDate - ISO8601 start date (e.g., "2025-01-01T00:00:00Z")
 * @param {string} endDate - ISO8601 end date (e.g., "2025-02-01T00:00:00Z")
 * @returns {Promise<Array>} - all orders between the dates
 */
  async fetchOrdersByDateRange(startDate: string, endDate: string) {
    let orders = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `/orders.json`;
      const params = {
        status: "any",
        created_at_min: startDate,
        created_at_max: endDate,
        limit: 250,
      };

      const response = await this.api.get(url, {
        params,
      });

      const batch = response.data.orders;
      orders = orders.concat(batch);

      if (batch.length < 250) {
        hasMore = false;
      } else {
        page += 1;
      }
    }

    return orders;
  }

  async getVariantById(id: number) {
    const _v = this.variant.get(id);
    if (_v) return _v;

    try {
      const response = await this.api.get<{ variant: Variant }>(
        `/variants/${id}.json`,
      );

      this.logger('Need to get variant: ', id);

      const v = response.data.variant;
      this.variant.set(id, v);
      return v;
    } catch (error) {
      this.error('Get variant fail: ', id);
      return null;
    }
  }

  handleError = (err: AxiosError) => {
    this.error('API Error:', err.message);
  };
}
