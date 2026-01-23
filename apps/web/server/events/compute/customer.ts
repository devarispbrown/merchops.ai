/**
 * Customer Event Computation
 *
 * Computes customer-related events:
 * - Customer inactivity threshold crossed (30/60/90 days)
 */

import { prisma } from '../../db/client';
import { createEvent } from '../create';
import { CustomerInactivityThresholdPayload } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const INACTIVITY_THRESHOLDS = [30, 60, 90]; // Days of inactivity to track
const MIN_LIFETIME_ORDERS = 2; // Minimum orders to consider for win-back

// ============================================================================
// CUSTOMER INACTIVITY COMPUTATION
// ============================================================================

interface CustomerInactivityData {
  customer_id: string;
  customer_email: string;
  customer_name?: string;
  days_inactive: number;
  last_order_at: Date;
  total_orders: number;
  total_value: number;
  average_order_value: number;
  preferred_categories?: string[];
}

/**
 * Computes customer inactivity threshold events
 * Identifies customers who have crossed inactivity thresholds
 */
export async function computeCustomerInactivityEvents(
  workspace_id: string
): Promise<void> {
  const inactiveCustomers = await findInactiveCustomers(workspace_id);

  for (const customer of inactiveCustomers) {
    // Find which threshold was crossed
    const threshold = findCrossedThreshold(customer.days_inactive);

    if (!threshold) {
      continue; // Not at a threshold
    }

    // Check if already notified for this threshold
    const alreadyNotified = await checkExistingThresholdEvent(
      workspace_id,
      customer.customer_id,
      threshold
    );

    if (alreadyNotified) {
      continue; // Already created event for this threshold
    }

    const payload: CustomerInactivityThresholdPayload = {
      customer_id: customer.customer_id,
      customer_email: customer.customer_email,
      customer_name: customer.customer_name,
      days_inactive: customer.days_inactive,
      threshold,
      last_order_at: customer.last_order_at.toISOString(),
      total_lifetime_orders: customer.total_orders,
      total_lifetime_value: customer.total_value,
      average_order_value: customer.average_order_value,
      preferred_product_categories: customer.preferred_categories,
    };

    await createEvent({
      workspace_id,
      type: 'customer_inactivity_threshold',
      occurred_at: new Date(),
      payload,
      source: 'computed',
    });
  }
}

// ============================================================================
// CUSTOMER ANALYSIS
// ============================================================================

/**
 * Finds customers who have become inactive
 */
async function findInactiveCustomers(
  workspace_id: string
): Promise<CustomerInactivityData[]> {
  // Fetch all customers
  const customers = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'customer',
    },
  });

  // Fetch all orders for analysis
  const orders = await prisma.shopifyObjectCache.findMany({
    where: {
      workspace_id,
      object_type: 'order',
    },
    orderBy: {
      synced_at: 'desc',
    },
  });

  const now = new Date();
  const inactiveCustomers: CustomerInactivityData[] = [];

  for (const customer of customers) {
    const customerData = customer.data_json as any;
    const customerId = customerData.id;

    // Get customer's orders
    const customerOrders = orders.filter((order) => {
      const orderData = order.data_json as any;
      return orderData.customer?.id === customerId;
    });

    // Skip if no orders or too few orders
    if (customerOrders.length < MIN_LIFETIME_ORDERS) {
      continue;
    }

    // Find last order
    const lastOrder = customerOrders[0];
    const lastOrderData = lastOrder.data_json as any;
    const lastOrderDate = new Date(lastOrderData.created_at);

    // Calculate days inactive
    const daysInactive = Math.floor(
      (now.getTime() - lastOrderDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Only include if inactive beyond minimum threshold
    if (daysInactive < Math.min(...INACTIVITY_THRESHOLDS)) {
      continue;
    }

    // Calculate lifetime metrics
    const { totalValue, categories } = analyzeCustomerOrders(customerOrders);

    inactiveCustomers.push({
      customer_id: customerId,
      customer_email: customerData.email,
      customer_name:
        customerData.first_name && customerData.last_name
          ? `${customerData.first_name} ${customerData.last_name}`
          : undefined,
      days_inactive: daysInactive,
      last_order_at: lastOrderDate,
      total_orders: customerOrders.length,
      total_value: totalValue,
      average_order_value: totalValue / customerOrders.length,
      preferred_categories: categories.length > 0 ? categories : undefined,
    });
  }

  return inactiveCustomers;
}

/**
 * Analyzes customer orders to extract insights
 */
function analyzeCustomerOrders(orders: any[]): {
  totalValue: number;
  categories: string[];
} {
  let totalValue = 0;
  const categorySet = new Set<string>();

  for (const order of orders) {
    const orderData = order.data_json as any;

    // Add to total value
    totalValue += parseFloat(orderData.total_price || '0');

    // Extract product categories
    for (const item of orderData.line_items || []) {
      if (item.product_type) {
        categorySet.add(item.product_type);
      }
    }
  }

  return {
    totalValue: parseFloat(totalValue.toFixed(2)),
    categories: Array.from(categorySet).slice(0, 3), // Top 3 categories
  };
}

/**
 * Finds the threshold that was crossed
 * Returns the threshold value or null if not at a threshold
 */
function findCrossedThreshold(daysInactive: number): number | null {
  // Find exact threshold matches (within 1 day tolerance)
  for (const threshold of INACTIVITY_THRESHOLDS) {
    if (Math.abs(daysInactive - threshold) <= 1) {
      return threshold;
    }
  }

  return null;
}

/**
 * Checks if event already exists for this customer and threshold
 */
async function checkExistingThresholdEvent(
  workspace_id: string,
  customer_id: string,
  threshold: number
): Promise<boolean> {
  // Check events from the last 7 days to avoid duplicates
  const recentEvent = await prisma.event.findFirst({
    where: {
      workspace_id,
      type: 'customer_inactivity_threshold',
      created_at: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (!recentEvent) {
    return false;
  }

  const payload = recentEvent.payload_json as any;
  return payload.customer_id === customer_id && payload.threshold === threshold;
}

/**
 * Gets customer inactivity data for a specific customer
 * Useful for on-demand checks
 */
export async function getCustomerInactivityData(
  workspace_id: string,
  customer_id: string
): Promise<CustomerInactivityData | null> {
  const allInactive = await findInactiveCustomers(workspace_id);
  return allInactive.find((c) => c.customer_id === customer_id) || null;
}

/**
 * Computes inactivity for all customers and returns summary
 */
export async function getInactivitySummary(workspace_id: string): Promise<{
  total_inactive: number;
  by_threshold: Record<number, number>;
}> {
  const inactive = await findInactiveCustomers(workspace_id);

  const byThreshold: Record<number, number> = {};
  for (const threshold of INACTIVITY_THRESHOLDS) {
    byThreshold[threshold] = 0;
  }

  for (const customer of inactive) {
    for (const threshold of INACTIVITY_THRESHOLDS) {
      if (customer.days_inactive >= threshold) {
        byThreshold[threshold]++;
      }
    }
  }

  return {
    total_inactive: inactive.length,
    by_threshold: byThreshold,
  };
}
