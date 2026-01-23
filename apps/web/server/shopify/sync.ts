/**
 * Shopify Initial Sync
 *
 * Handles initial data synchronization when a shop connects.
 * Fetches products, orders, customers, and inventory levels.
 * Uses pagination to handle large datasets safely.
 */

import crypto from 'crypto';

import { Prisma, ShopifyConnectionStatus } from '@prisma/client';

import { prisma } from '../db';

import { ShopifyClient } from './client';

export interface SyncProgress {
  products: number;
  orders: number;
  customers: number;
  inventoryLevels: number;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface SyncOptions {
  workspaceId: string;
  shop: string;
  encryptedToken: string;
  correlationId?: string;
  limits?: {
    products?: number;
    orders?: number;
    customers?: number;
  };
}

/**
 * Perform initial sync for a newly connected shop
 *
 * This is a long-running operation that should be executed
 * as a background job (BullMQ).
 */
export async function performInitialSync(
  options: SyncOptions
): Promise<SyncProgress> {
  const {
    workspaceId,
    shop,
    encryptedToken,
    correlationId = crypto.randomUUID(),
    limits = {},
  } = options;

  console.log('[Sync] Starting initial sync', {
    correlationId,
    workspaceId,
    shop,
  });

  const progress: SyncProgress = {
    products: 0,
    orders: 0,
    customers: 0,
    inventoryLevels: 0,
    status: 'in_progress',
  };

  const client = new ShopifyClient(shop, encryptedToken);

  try {
    // Update sync status to syncing
    await updateSyncStatus(workspaceId, 'syncing');

    // Sync products
    console.log('[Sync] Syncing products', { correlationId });
    progress.products = await syncProducts(
      workspaceId,
      client,
      correlationId,
      limits.products
    );

    // Sync orders
    console.log('[Sync] Syncing orders', { correlationId });
    progress.orders = await syncOrders(
      workspaceId,
      client,
      correlationId,
      limits.orders
    );

    // Sync customers
    console.log('[Sync] Syncing customers', { correlationId });
    progress.customers = await syncCustomers(
      workspaceId,
      client,
      correlationId,
      limits.customers
    );

    // Sync inventory levels
    console.log('[Sync] Syncing inventory levels', { correlationId });
    progress.inventoryLevels = await syncInventoryLevels(
      workspaceId,
      client,
      correlationId
    );

    progress.status = 'completed';

    // Update sync status to idle with success timestamp
    await updateSyncStatus(workspaceId, 'idle', new Date());

    console.log('[Sync] Initial sync completed', {
      correlationId,
      workspaceId,
      progress,
    });

    return progress;
  } catch (error) {
    progress.status = 'failed';
    progress.error = error instanceof Error ? error.message : 'Unknown error';

    // Update sync status to error
    await updateSyncStatus(
      workspaceId,
      'error',
      undefined,
      progress.error
    ).catch((updateError) => {
      console.error('[Sync] Failed to update error status', {
        correlationId,
        workspaceId,
        updateError: updateError instanceof Error ? updateError.message : 'Unknown error',
      });
    });

    console.error('[Sync] Initial sync failed', {
      correlationId,
      workspaceId,
      error: progress.error,
      progress,
    });

    throw error;
  }
}

/**
 * Sync products with pagination
 */
async function syncProducts(
  workspaceId: string,
  client: ShopifyClient,
  correlationId: string,
  maxProducts?: number
): Promise<number> {
  let count = 0;
  let sinceId: number | undefined;
  const batchSize = 50;
  let hasMore = true;

  while (hasMore) {
    const products = await client.getProducts({
      limit: batchSize,
      sinceId,
      correlationId,
    });

    if (products.length === 0) {
      hasMore = false;
      break;
    }

    // Store products in cache
    for (const product of products) {
      // Check limit before processing each product
      if (maxProducts && count >= maxProducts) {
        hasMore = false;
        break;
      }

      if (product.id) {
        await upsertProductCache(workspaceId, product as { id: number; [key: string]: unknown });
        count++;
      }
    }

    console.log('[Sync] Products batch synced', {
      correlationId,
      count,
      batchSize: products.length,
    });

    // Update pagination cursor
    const lastProduct = products[products.length - 1];
    sinceId = lastProduct?.id;

    // Check if we've reached the limit
    if (maxProducts && count >= maxProducts) {
      hasMore = false;
      break;
    }

    // Check if we got less than a full batch (last page)
    if (products.length < batchSize) {
      hasMore = false;
      break;
    }
  }

  return count;
}

/**
 * Sync orders with pagination
 */
async function syncOrders(
  workspaceId: string,
  client: ShopifyClient,
  correlationId: string,
  maxOrders?: number
): Promise<number> {
  let count = 0;
  let sinceId: number | undefined;
  const batchSize = 50;
  let hasMore = true;

  while (hasMore) {
    const orders = await client.getOrders({
      limit: batchSize,
      sinceId,
      status: 'any',
      correlationId,
    });

    if (orders.length === 0) {
      hasMore = false;
      break;
    }

    // Store orders in cache
    for (const order of orders) {
      // Check limit before processing each order
      if (maxOrders && count >= maxOrders) {
        hasMore = false;
        break;
      }

      if (order.id) {
        await upsertOrderCache(workspaceId, order as { id: number; [key: string]: unknown });
        count++;
      }
    }

    console.log('[Sync] Orders batch synced', {
      correlationId,
      count,
      batchSize: orders.length,
    });

    // Update pagination cursor
    const lastOrder = orders[orders.length - 1];
    sinceId = lastOrder?.id;

    // Check if we've reached the limit
    if (maxOrders && count >= maxOrders) {
      hasMore = false;
      break;
    }

    // Check if we got less than a full batch (last page)
    if (orders.length < batchSize) {
      hasMore = false;
      break;
    }
  }

  return count;
}

/**
 * Sync customers with pagination
 */
async function syncCustomers(
  workspaceId: string,
  client: ShopifyClient,
  correlationId: string,
  maxCustomers?: number
): Promise<number> {
  let count = 0;
  let sinceId: number | undefined;
  const batchSize = 50;
  let hasMore = true;

  while (hasMore) {
    const customers = await client.getCustomers({
      limit: batchSize,
      sinceId,
      correlationId,
    });

    if (customers.length === 0) {
      hasMore = false;
      break;
    }

    // Store customers in cache
    for (const customer of customers) {
      // Check limit before processing each customer
      if (maxCustomers && count >= maxCustomers) {
        hasMore = false;
        break;
      }

      if (customer.id) {
        await upsertCustomerCache(workspaceId, customer as { id: number; [key: string]: unknown });
        count++;
      }
    }

    console.log('[Sync] Customers batch synced', {
      correlationId,
      count,
      batchSize: customers.length,
    });

    // Update pagination cursor
    const lastCustomer = customers[customers.length - 1];
    sinceId = lastCustomer?.id;

    // Check if we've reached the limit
    if (maxCustomers && count >= maxCustomers) {
      hasMore = false;
      break;
    }

    // Check if we got less than a full batch (last page)
    if (customers.length < batchSize) {
      hasMore = false;
      break;
    }
  }

  return count;
}

/**
 * Sync inventory levels
 */
async function syncInventoryLevels(
  workspaceId: string,
  client: ShopifyClient,
  correlationId: string
): Promise<number> {
  let count = 0;

  // Note: Inventory levels are typically fetched per location
  // For MVP, we'll sync all inventory levels across all locations
  // In production, you might want to fetch locations first

  try {
    const inventoryLevels = await client.getInventoryLevels({
      limit: 250, // Max allowed by Shopify
      correlationId,
    });

    // Store inventory levels in cache
    for (const level of inventoryLevels) {
      const synced = await upsertInventoryLevelCache(workspaceId, level);
      if (synced) {
        count++;
      }
    }

    console.log('[Sync] Inventory levels synced', {
      correlationId,
      count,
    });

    return count;
  } catch (error) {
    console.error('[Sync] Failed to sync inventory levels', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Don't fail the entire sync if inventory fails
    return 0;
  }
}

/**
 * Upsert product in cache
 */
async function upsertProductCache(
  workspaceId: string,
  product: { id: number; [key: string]: unknown }
): Promise<void> {
  const shopifyId = product.id.toString();
  const now = new Date();

  console.log('[Sync] Caching product', {
    workspaceId,
    productId: product.id,
  });

  // Check if record exists to determine if we need to increment version
  const existing = await prisma.shopifyObjectCache.findUnique({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'product',
        shopify_id: shopifyId,
      },
    },
    select: {
      version: true,
      data_json: true,
    },
  });

  // Only update if data has changed to maintain idempotency
  const dataChanged = existing
    ? JSON.stringify(existing.data_json) !== JSON.stringify(product)
    : true;

  if (!dataChanged) {
    console.log('[Sync] Product unchanged, skipping update', {
      workspaceId,
      productId: product.id,
    });
    return;
  }

  await prisma.shopifyObjectCache.upsert({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'product',
        shopify_id: shopifyId,
      },
    },
    update: {
      data_json: product as Prisma.InputJsonValue,
      version: existing ? existing.version + 1 : 1,
      synced_at: now,
    },
    create: {
      workspace_id: workspaceId,
      object_type: 'product',
      shopify_id: shopifyId,
      data_json: product as Prisma.InputJsonValue,
      version: 1,
      synced_at: now,
    },
  });
}

/**
 * Upsert order in cache
 */
async function upsertOrderCache(
  workspaceId: string,
  order: { id: number; [key: string]: unknown }
): Promise<void> {
  const shopifyId = order.id.toString();
  const now = new Date();

  console.log('[Sync] Caching order', {
    workspaceId,
    orderId: order.id,
  });

  // Check if record exists to determine if we need to increment version
  const existing = await prisma.shopifyObjectCache.findUnique({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'order',
        shopify_id: shopifyId,
      },
    },
    select: {
      version: true,
      data_json: true,
    },
  });

  // Only update if data has changed to maintain idempotency
  const dataChanged = existing
    ? JSON.stringify(existing.data_json) !== JSON.stringify(order)
    : true;

  if (!dataChanged) {
    console.log('[Sync] Order unchanged, skipping update', {
      workspaceId,
      orderId: order.id,
    });
    return;
  }

  await prisma.shopifyObjectCache.upsert({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'order',
        shopify_id: shopifyId,
      },
    },
    update: {
      data_json: order as Prisma.InputJsonValue,
      version: existing ? existing.version + 1 : 1,
      synced_at: now,
    },
    create: {
      workspace_id: workspaceId,
      object_type: 'order',
      shopify_id: shopifyId,
      data_json: order as Prisma.InputJsonValue,
      version: 1,
      synced_at: now,
    },
  });
}

/**
 * Upsert customer in cache
 */
async function upsertCustomerCache(
  workspaceId: string,
  customer: { id: number; [key: string]: unknown }
): Promise<void> {
  const shopifyId = customer.id.toString();
  const now = new Date();

  console.log('[Sync] Caching customer', {
    workspaceId,
    customerId: customer.id,
  });

  // Check if record exists to determine if we need to increment version
  const existing = await prisma.shopifyObjectCache.findUnique({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'customer',
        shopify_id: shopifyId,
      },
    },
    select: {
      version: true,
      data_json: true,
    },
  });

  // Only update if data has changed to maintain idempotency
  const dataChanged = existing
    ? JSON.stringify(existing.data_json) !== JSON.stringify(customer)
    : true;

  if (!dataChanged) {
    console.log('[Sync] Customer unchanged, skipping update', {
      workspaceId,
      customerId: customer.id,
    });
    return;
  }

  await prisma.shopifyObjectCache.upsert({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'customer',
        shopify_id: shopifyId,
      },
    },
    update: {
      data_json: customer as Prisma.InputJsonValue,
      version: existing ? existing.version + 1 : 1,
      synced_at: now,
    },
    create: {
      workspace_id: workspaceId,
      object_type: 'customer',
      shopify_id: shopifyId,
      data_json: customer as Prisma.InputJsonValue,
      version: 1,
      synced_at: now,
    },
  });
}

/**
 * Upsert inventory level in cache
 * @returns true if synced successfully, false if skipped
 */
async function upsertInventoryLevelCache(
  workspaceId: string,
  level: { inventory_item_id?: number; location_id?: number; [key: string]: unknown }
): Promise<boolean> {
  if (!level.inventory_item_id || !level.location_id) {
    console.warn('[Sync] Skipping inventory level without required IDs', {
      workspaceId,
      level,
    });
    return false;
  }

  // Use compound key for inventory levels: inventory_item_id:location_id
  const shopifyId = `${level.inventory_item_id}:${level.location_id}`;
  const now = new Date();

  console.log('[Sync] Caching inventory level', {
    workspaceId,
    inventoryItemId: level.inventory_item_id,
    locationId: level.location_id,
  });

  // Check if record exists to determine if we need to increment version
  const existing = await prisma.shopifyObjectCache.findUnique({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'inventory_level',
        shopify_id: shopifyId,
      },
    },
    select: {
      version: true,
      data_json: true,
    },
  });

  // Only update if data has changed to maintain idempotency
  const dataChanged = existing
    ? JSON.stringify(existing.data_json) !== JSON.stringify(level)
    : true;

  if (!dataChanged) {
    console.log('[Sync] Inventory level unchanged, skipping update', {
      workspaceId,
      inventoryItemId: level.inventory_item_id,
      locationId: level.location_id,
    });
    return true; // Still counted as synced
  }

  await prisma.shopifyObjectCache.upsert({
    where: {
      workspace_id_object_type_shopify_id: {
        workspace_id: workspaceId,
        object_type: 'inventory_level',
        shopify_id: shopifyId,
      },
    },
    update: {
      data_json: level as Prisma.InputJsonValue,
      version: existing ? existing.version + 1 : 1,
      synced_at: now,
    },
    create: {
      workspace_id: workspaceId,
      object_type: 'inventory_level',
      shopify_id: shopifyId,
      data_json: level as Prisma.InputJsonValue,
      version: 1,
      synced_at: now,
    },
  });

  return true;
}

/**
 * Update sync status for a workspace connection
 */
async function updateSyncStatus(
  workspaceId: string,
  status: 'idle' | 'syncing' | 'error',
  _lastSyncedAt?: Date,
  _lastError?: string
): Promise<void> {
  const connectionStatus: ShopifyConnectionStatus =
    status === 'error'
      ? ShopifyConnectionStatus.error
      : ShopifyConnectionStatus.active;

  try {
    // For now, we don't have last_synced_at or sync_state fields in ShopifyConnection
    // This would require a schema migration. For MVP, we'll just update status
    await prisma.shopifyConnection.updateMany({
      where: {
        workspace_id: workspaceId,
      },
      data: {
        status: connectionStatus,
        // TODO: Add these fields in schema migration
        // sync_state: status,
        // last_synced_at: lastSyncedAt,
        // last_error: lastError,
      },
    });

    console.log('[Sync] Updated sync status', {
      workspaceId,
      status,
      lastSyncedAt: _lastSyncedAt,
    });
  } catch (error) {
    console.error('[Sync] Failed to update sync status', {
      workspaceId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - this is a non-critical update
  }
}

/**
 * Check sync status for a workspace
 */
export async function getSyncStatus(
  workspaceId: string
): Promise<SyncProgress | null> {
  console.log('[Sync] Checking sync status', { workspaceId });

  try {
    // Get object counts from cache
    const [products, orders, customers, inventoryLevels] = await Promise.all([
      prisma.shopifyObjectCache.count({
        where: { workspace_id: workspaceId, object_type: 'product' },
      }),
      prisma.shopifyObjectCache.count({
        where: { workspace_id: workspaceId, object_type: 'order' },
      }),
      prisma.shopifyObjectCache.count({
        where: { workspace_id: workspaceId, object_type: 'customer' },
      }),
      prisma.shopifyObjectCache.count({
        where: { workspace_id: workspaceId, object_type: 'inventory_level' },
      }),
    ]);

    // Get connection status
    const connection = await prisma.shopifyConnection.findUnique({
      where: { workspace_id: workspaceId },
      select: { status: true },
    });

    if (!connection) {
      return null;
    }

    const status: SyncProgress['status'] =
      connection.status === ShopifyConnectionStatus.error
        ? 'failed'
        : products > 0 || orders > 0 || customers > 0
          ? 'completed'
          : 'in_progress';

    return {
      products,
      orders,
      customers,
      inventoryLevels,
      status,
    };
  } catch (error) {
    console.error('[Sync] Failed to get sync status', {
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
