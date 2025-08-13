import { FacebookAdsRepository } from './facebook-ads.service';
import { ShopifyRepository } from './shopify.repository';

export type ShopifyType = 'Paradis' | 'Thermuse' | 'Persoliebe';

export interface ShopifyService {
  type: ShopifyType;
  repo: ShopifyRepository;
  fb: FacebookAdsRepository;
}

export interface OrdersResponse {
  orders: Order[];
}

export interface Order {
  id: number;
  admin_graphql_api_id: string;
  app_id: number | null;
  browser_ip: string | null;
  buyer_accepts_marketing: boolean;
  cancel_reason: string | null;
  cancelled_at: string | null; // ISO date string
  cart_token: string | null;
  checkout_id: number | null;
  checkout_token: string | null;
  closed_at: string | null; // ISO date string
  confirmed: boolean;
  created_at: string; // ISO date string
  currency: string; // e.g., "USD"
  current_subtotal_price: number;
  current_total_discounts: string;
  current_total_price: number;
  current_total_tax: string;
  customer_locale: string | null;
  device_id: number | null;
  email: string;
  financial_status: string; // e.g., "paid", "pending"
  fulfillment_status: string | null; // e.g., "fulfilled"
  gateway: string | null;
  landing_site: string | null;
  location_id: number | null;
  name: string; // e.g., "#1001"
  note: string | null;
  number: number; // order number without prefix
  order_number: number; // human-readable order number
  payment_gateway_names: string[];
  phone: string | null;
  processed_at: string; // ISO date string
  referring_site: string | null;
  source_name: string;
  subtotal_price: number;
  tags: string;
  tax_lines: {
    price: number;
    rate: number;
    title: string;
  }[];
  taxes_included: boolean;
  test: boolean;
  token: string;
  total_discounts: string;
  total_line_items_price: number;
  total_outstanding: string;
  total_price: number;
  total_price_usd: number;
  total_tax: number;
  total_tip_received: number;
  total_weight: number;
  updated_at: string; // ISO date string
  user_id: number | null;

  // Relationships
  customer: Customer | null;

  billing_address: null;

  shipping_address: ShippingAddress | null;

  shipping_lines: ShippingLine[] | null;

  line_items: Variant[];
}

export interface ShippingLine {
  code: string;
  price: string;
  price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  discounted_price: string;
  discounted_price_set: {
    shop_money: {
      amount: string;
      currency_code: string;
    };
    presentment_money: {
      amount: string;
      currency_code: string;
    };
  };
  source: string;
  title: string;
  tax_lines: [];
  carrier_identifier: string;
  requested_fulfillment_service_id: string;
  is_removed: false;
}

export interface BillingAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  province_code: string;
  country: string;
  country_code: string;
  zip: string;
  phone: string | null;
}

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  province_code: string;
  country: string;
  country_code: string;
  zip: string;
  phone: string | null;
}

export interface Variant {
  id: number;
  variant_id: number | null;
  title: string;
  quantity: number;
  sku: string;
  price: number;
  grams: number;
  vendor: string;
  fulfillment_service: string;
  product_id: number | null;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  variant_title: string | null;
  total_discount: string;
}

export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  tags: string;
}
