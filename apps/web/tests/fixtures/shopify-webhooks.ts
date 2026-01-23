/**
 * Shopify Webhook Test Fixtures
 *
 * Sample webhook payloads and HMAC signatures for testing webhook handlers.
 */

import crypto from 'crypto';

// ============================================================================
// WEBHOOK PAYLOADS
// ============================================================================

/**
 * Sample order/create webhook payload
 */
export const orderCreatePayload = {
  id: 5678901234567,
  admin_graphql_api_id: 'gid://shopify/Order/5678901234567',
  app_id: 123456,
  browser_ip: '192.168.1.1',
  buyer_accepts_marketing: true,
  cancel_reason: null,
  cancelled_at: null,
  cart_token: 'abc123xyz',
  checkout_id: 1234567890123,
  checkout_token: 'checkout_abc123',
  client_details: {
    accept_language: 'en-US',
    browser_height: 1080,
    browser_ip: '192.168.1.1',
    browser_width: 1920,
    session_hash: null,
    user_agent: 'Mozilla/5.0',
  },
  closed_at: null,
  confirmed: true,
  contact_email: 'customer@example.com',
  created_at: '2024-01-15T10:30:00-05:00',
  currency: 'USD',
  current_subtotal_price: '99.99',
  current_total_discounts: '10.00',
  current_total_duties_set: null,
  current_total_price: '109.99',
  current_total_tax: '20.00',
  customer: {
    id: 9876543210987,
    email: 'customer@example.com',
    accepts_marketing: true,
    created_at: '2023-06-01T12:00:00-05:00',
    updated_at: '2024-01-15T10:30:00-05:00',
    first_name: 'John',
    last_name: 'Doe',
    orders_count: 5,
    state: 'enabled',
    total_spent: '549.95',
    last_order_id: 5678901234567,
    note: null,
    verified_email: true,
    multipass_identifier: null,
    tax_exempt: false,
    tags: 'loyal_customer,vip',
    last_order_name: '#1005',
    currency: 'USD',
    phone: '+15551234567',
    addresses: [],
    accepts_marketing_updated_at: '2023-06-01T12:00:00-05:00',
    marketing_opt_in_level: 'single_opt_in',
    tax_exemptions: [],
    admin_graphql_api_id: 'gid://shopify/Customer/9876543210987',
    default_address: {
      id: 1122334455667,
      customer_id: 9876543210987,
      first_name: 'John',
      last_name: 'Doe',
      company: null,
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'New York',
      province: 'New York',
      country: 'United States',
      zip: '10001',
      phone: '+15551234567',
      name: 'John Doe',
      province_code: 'NY',
      country_code: 'US',
      country_name: 'United States',
      default: true,
    },
  },
  customer_locale: 'en',
  device_id: null,
  discount_codes: [
    {
      code: 'WELCOME10',
      amount: '10.00',
      type: 'fixed_amount',
    },
  ],
  email: 'customer@example.com',
  estimated_taxes: false,
  financial_status: 'pending',
  fulfillment_status: null,
  gateway: 'shopify_payments',
  landing_site: '/products/cool-shirt',
  landing_site_ref: 'google',
  line_items: [
    {
      id: 11223344556677,
      admin_graphql_api_id: 'gid://shopify/LineItem/11223344556677',
      fulfillable_quantity: 2,
      fulfillment_service: 'manual',
      fulfillment_status: null,
      gift_card: false,
      grams: 500,
      name: 'Cool T-Shirt - Medium',
      price: '29.99',
      price_set: {
        shop_money: { amount: '29.99', currency_code: 'USD' },
        presentment_money: { amount: '29.99', currency_code: 'USD' },
      },
      product_exists: true,
      product_id: 7890123456789,
      properties: [],
      quantity: 2,
      requires_shipping: true,
      sku: 'COOL-SHIRT-MED',
      taxable: true,
      title: 'Cool T-Shirt',
      total_discount: '0.00',
      variant_id: 4567890123456,
      variant_inventory_management: 'shopify',
      variant_title: 'Medium',
      vendor: 'Cool Brand',
      tax_lines: [],
      duties: [],
      discount_allocations: [],
    },
    {
      id: 22334455667788,
      admin_graphql_api_id: 'gid://shopify/LineItem/22334455667788',
      fulfillable_quantity: 1,
      fulfillment_service: 'manual',
      fulfillment_status: null,
      gift_card: false,
      grams: 200,
      name: 'Awesome Hat - One Size',
      price: '19.99',
      price_set: {
        shop_money: { amount: '19.99', currency_code: 'USD' },
        presentment_money: { amount: '19.99', currency_code: 'USD' },
      },
      product_exists: true,
      product_id: 8901234567890,
      properties: [],
      quantity: 1,
      requires_shipping: true,
      sku: 'AWESOME-HAT-OS',
      taxable: true,
      title: 'Awesome Hat',
      total_discount: '0.00',
      variant_id: 5678901234567,
      variant_inventory_management: 'shopify',
      variant_title: 'One Size',
      vendor: 'Cool Brand',
      tax_lines: [],
      duties: [],
      discount_allocations: [],
    },
  ],
  location_id: null,
  name: '#1005',
  note: 'Please gift wrap',
  note_attributes: [],
  number: 5,
  order_number: 1005,
  order_status_url: 'https://example-store.myshopify.com/12345/orders/abc123/authenticate?key=xyz789',
  original_total_duties_set: null,
  payment_gateway_names: ['shopify_payments'],
  phone: null,
  presentment_currency: 'USD',
  processed_at: '2024-01-15T10:30:00-05:00',
  processing_method: 'direct',
  reference: null,
  referring_site: 'https://www.google.com',
  source_identifier: null,
  source_name: 'web',
  source_url: null,
  subtotal_price: '99.99',
  tags: 'online_order',
  tax_lines: [],
  taxes_included: false,
  test: false,
  token: 'token_abc123xyz',
  total_discounts: '10.00',
  total_line_items_price: '99.99',
  total_outstanding: '109.99',
  total_price: '109.99',
  total_price_set: {
    shop_money: { amount: '109.99', currency_code: 'USD' },
    presentment_money: { amount: '109.99', currency_code: 'USD' },
  },
  total_shipping_price_set: {
    shop_money: { amount: '0.00', currency_code: 'USD' },
    presentment_money: { amount: '0.00', currency_code: 'USD' },
  },
  total_tax: '20.00',
  total_tip_received: '0.00',
  total_weight: 1200,
  updated_at: '2024-01-15T10:30:00-05:00',
  user_id: null,
  billing_address: {
    first_name: 'John',
    address1: '123 Main St',
    phone: '+15551234567',
    city: 'New York',
    zip: '10001',
    province: 'New York',
    country: 'United States',
    last_name: 'Doe',
    address2: 'Apt 4B',
    company: null,
    latitude: 40.7128,
    longitude: -74.006,
    name: 'John Doe',
    country_code: 'US',
    province_code: 'NY',
  },
  shipping_address: {
    first_name: 'John',
    address1: '123 Main St',
    phone: '+15551234567',
    city: 'New York',
    zip: '10001',
    province: 'New York',
    country: 'United States',
    last_name: 'Doe',
    address2: 'Apt 4B',
    company: null,
    latitude: 40.7128,
    longitude: -74.006,
    name: 'John Doe',
    country_code: 'US',
    province_code: 'NY',
  },
  fulfillments: [],
  refunds: [],
  shipping_lines: [],
};

/**
 * Sample order/paid webhook payload
 */
export const orderPaidPayload = {
  ...orderCreatePayload,
  financial_status: 'paid',
  payment_details: {
    credit_card_bin: '424242',
    avs_result_code: 'Y',
    cvv_result_code: 'M',
    credit_card_number: 'XXXX-XXXX-XXXX-4242',
    credit_card_company: 'Visa',
  },
};

/**
 * Sample products/update webhook payload
 */
export const productUpdatePayload = {
  id: 7890123456789,
  title: 'Cool T-Shirt',
  body_html: '<p>An awesome t-shirt that you will love!</p>',
  vendor: 'Cool Brand',
  product_type: 'Apparel',
  created_at: '2023-12-01T10:00:00-05:00',
  handle: 'cool-t-shirt',
  updated_at: '2024-01-15T14:30:00-05:00',
  published_at: '2023-12-01T10:00:00-05:00',
  template_suffix: null,
  published_scope: 'web',
  tags: 't-shirt,casual,bestseller',
  status: 'active',
  admin_graphql_api_id: 'gid://shopify/Product/7890123456789',
  variants: [
    {
      id: 4567890123456,
      product_id: 7890123456789,
      title: 'Small',
      price: '29.99',
      sku: 'COOL-SHIRT-SM',
      position: 1,
      inventory_policy: 'deny',
      compare_at_price: '39.99',
      fulfillment_service: 'manual',
      inventory_management: 'shopify',
      option1: 'Small',
      option2: null,
      option3: null,
      created_at: '2023-12-01T10:00:00-05:00',
      updated_at: '2024-01-15T14:30:00-05:00',
      taxable: true,
      barcode: '123456789012',
      grams: 500,
      image_id: null,
      weight: 500,
      weight_unit: 'g',
      inventory_item_id: 6789012345678,
      inventory_quantity: 5,
      old_inventory_quantity: 5,
      requires_shipping: true,
      admin_graphql_api_id: 'gid://shopify/ProductVariant/4567890123456',
    },
    {
      id: 4567890123457,
      product_id: 7890123456789,
      title: 'Medium',
      price: '29.99',
      sku: 'COOL-SHIRT-MED',
      position: 2,
      inventory_policy: 'deny',
      compare_at_price: '39.99',
      fulfillment_service: 'manual',
      inventory_management: 'shopify',
      option1: 'Medium',
      option2: null,
      option3: null,
      created_at: '2023-12-01T10:00:00-05:00',
      updated_at: '2024-01-15T14:30:00-05:00',
      taxable: true,
      barcode: '123456789013',
      grams: 500,
      image_id: null,
      weight: 500,
      weight_unit: 'g',
      inventory_item_id: 6789012345679,
      inventory_quantity: 15,
      old_inventory_quantity: 25,
      requires_shipping: true,
      admin_graphql_api_id: 'gid://shopify/ProductVariant/4567890123457',
    },
    {
      id: 4567890123458,
      product_id: 7890123456789,
      title: 'Large',
      price: '29.99',
      sku: 'COOL-SHIRT-LG',
      position: 3,
      inventory_policy: 'deny',
      compare_at_price: '39.99',
      fulfillment_service: 'manual',
      inventory_management: 'shopify',
      option1: 'Large',
      option2: null,
      option3: null,
      created_at: '2023-12-01T10:00:00-05:00',
      updated_at: '2024-01-15T14:30:00-05:00',
      taxable: true,
      barcode: '123456789014',
      grams: 500,
      image_id: null,
      weight: 500,
      weight_unit: 'g',
      inventory_item_id: 6789012345680,
      inventory_quantity: 0,
      old_inventory_quantity: 8,
      requires_shipping: true,
      admin_graphql_api_id: 'gid://shopify/ProductVariant/4567890123458',
    },
  ],
  options: [
    {
      id: 8901234567890,
      product_id: 7890123456789,
      name: 'Size',
      position: 1,
      values: ['Small', 'Medium', 'Large'],
    },
  ],
  images: [
    {
      id: 9012345678901,
      product_id: 7890123456789,
      position: 1,
      created_at: '2023-12-01T10:00:00-05:00',
      updated_at: '2023-12-01T10:00:00-05:00',
      alt: null,
      width: 1200,
      height: 1200,
      src: 'https://cdn.shopify.com/s/files/1/0000/0000/0000/products/cool-shirt.jpg',
      variant_ids: [],
      admin_graphql_api_id: 'gid://shopify/ProductImage/9012345678901',
    },
  ],
  image: {
    id: 9012345678901,
    product_id: 7890123456789,
    position: 1,
    created_at: '2023-12-01T10:00:00-05:00',
    updated_at: '2023-12-01T10:00:00-05:00',
    alt: null,
    width: 1200,
    height: 1200,
    src: 'https://cdn.shopify.com/s/files/1/0000/0000/0000/products/cool-shirt.jpg',
    variant_ids: [],
    admin_graphql_api_id: 'gid://shopify/ProductImage/9012345678901',
  },
};

/**
 * Sample inventory_levels/update webhook payload
 */
export const inventoryLevelUpdatePayload = {
  inventory_item_id: 6789012345679,
  location_id: 1234567890,
  available: 15,
  updated_at: '2024-01-15T14:30:00-05:00',
  admin_graphql_api_id: 'gid://shopify/InventoryLevel/1234567890?inventory_item_id=6789012345679',
};

/**
 * Sample customers/update webhook payload
 */
export const customerUpdatePayload = {
  id: 9876543210987,
  email: 'customer@example.com',
  accepts_marketing: true,
  created_at: '2023-06-01T12:00:00-05:00',
  updated_at: '2024-01-15T10:30:00-05:00',
  first_name: 'John',
  last_name: 'Doe',
  orders_count: 5,
  state: 'enabled',
  total_spent: '549.95',
  last_order_id: 5678901234567,
  note: 'VIP customer - prefers email communication',
  verified_email: true,
  multipass_identifier: null,
  tax_exempt: false,
  tags: 'loyal_customer,vip',
  last_order_name: '#1005',
  currency: 'USD',
  phone: '+15551234567',
  addresses: [
    {
      id: 1122334455667,
      customer_id: 9876543210987,
      first_name: 'John',
      last_name: 'Doe',
      company: null,
      address1: '123 Main St',
      address2: 'Apt 4B',
      city: 'New York',
      province: 'New York',
      country: 'United States',
      zip: '10001',
      phone: '+15551234567',
      name: 'John Doe',
      province_code: 'NY',
      country_code: 'US',
      country_name: 'United States',
      default: true,
    },
  ],
  accepts_marketing_updated_at: '2023-06-01T12:00:00-05:00',
  marketing_opt_in_level: 'single_opt_in',
  tax_exemptions: [],
  admin_graphql_api_id: 'gid://shopify/Customer/9876543210987',
  default_address: {
    id: 1122334455667,
    customer_id: 9876543210987,
    first_name: 'John',
    last_name: 'Doe',
    company: null,
    address1: '123 Main St',
    address2: 'Apt 4B',
    city: 'New York',
    province: 'New York',
    country: 'United States',
    zip: '10001',
    phone: '+15551234567',
    name: 'John Doe',
    province_code: 'NY',
    country_code: 'US',
    country_name: 'United States',
    default: true,
  },
};

// ============================================================================
// HMAC SIGNATURE GENERATION
// ============================================================================

/**
 * Generate valid HMAC signature for webhook payload
 *
 * @param payload - Webhook payload object
 * @param secret - Shopify API secret
 * @returns Base64-encoded HMAC signature
 */
export function generateWebhookHmac(payload: any, secret: string): string {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString, 'utf8')
    .digest('base64');
}

/**
 * Generate invalid HMAC signature (for negative testing)
 */
export function generateInvalidHmac(): string {
  return 'invalid-hmac-signature-for-testing';
}

// ============================================================================
// WEBHOOK HEADERS
// ============================================================================

/**
 * Generate complete webhook headers
 */
export function generateWebhookHeaders(
  topic: string,
  payload: any,
  secret: string,
  shop: string = 'example-store.myshopify.com'
): Record<string, string> {
  return {
    'x-shopify-topic': topic,
    'x-shopify-hmac-sha256': generateWebhookHmac(payload, secret),
    'x-shopify-shop-domain': shop,
    'x-shopify-api-version': '2024-01',
    'x-shopify-webhook-id': `webhook-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    'content-type': 'application/json',
  };
}

// ============================================================================
// TEST SECRETS
// ============================================================================

/**
 * Test Shopify API secret (only for testing)
 */
export const TEST_SHOPIFY_SECRET = 'test-shopify-api-secret-for-testing-only';

/**
 * Pre-computed HMAC signatures for common test scenarios
 */
export const TEST_HMAC_SIGNATURES = {
  orderCreate: generateWebhookHmac(orderCreatePayload, TEST_SHOPIFY_SECRET),
  orderPaid: generateWebhookHmac(orderPaidPayload, TEST_SHOPIFY_SECRET),
  productUpdate: generateWebhookHmac(productUpdatePayload, TEST_SHOPIFY_SECRET),
  inventoryLevelUpdate: generateWebhookHmac(inventoryLevelUpdatePayload, TEST_SHOPIFY_SECRET),
  customerUpdate: generateWebhookHmac(customerUpdatePayload, TEST_SHOPIFY_SECRET),
  invalid: generateInvalidHmac(),
};
