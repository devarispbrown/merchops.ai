/**
 * Shopify Sync Tests
 *
 * Comprehensive test suite for Shopify data synchronization.
 * Tests upsert logic, idempotency, batch processing, and error handling.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { Prisma } from '@prisma/client';

import { prisma } from '../../db';

import { ShopifyClient } from '../client';
import { performInitialSync, getSyncStatus } from '../sync';

// Mock environment variables before imports
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = '0'.repeat(64);

// Mock the Shopify client and OAuth
vi.mock('../client');
vi.mock('../oauth', () => ({
  decryptToken: vi.fn((token) => token),
  encryptToken: vi.fn((token) => token),
}));
vi.mock('../../db', () => ({
  prisma: {
    shopifyObjectCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    shopifyConnection: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

describe('Shopify Sync', () => {
  const mockWorkspaceId = 'workspace-123';
  const mockShop = 'test-shop.myshopify.com';
  const mockEncryptedToken = 'encrypted-token-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('performInitialSync', () => {
    test('syncs products successfully', async () => {
      const mockProducts = [
        {
          id: 1,
          title: 'Product 1',
          status: 'active',
          variants: [],
          handle: 'product-1',
        },
        {
          id: 2,
          title: 'Product 2',
          status: 'active',
          variants: [],
          handle: 'product-2',
        },
      ];

      // Mock ShopifyClient methods
      const mockClient = {
        getProducts: vi.fn()
          .mockResolvedValueOnce(mockProducts)
          .mockResolvedValueOnce([]), // Empty array to stop pagination
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);

      // Mock Prisma responses
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: mockProducts[0] as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.products).toBe(2);
      expect(result.status).toBe('completed');
      expect(mockClient.getProducts).toHaveBeenCalled();
    });

    test('syncs orders successfully', async () => {
      const mockOrders = [
        {
          id: 101,
          order_number: 1001,
          email: 'customer@example.com',
          total_price: '100.00',
          line_items: [],
          created_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockClient = {
        getProducts: vi.fn().mockResolvedValue([]),
        getOrders: vi.fn()
          .mockResolvedValueOnce(mockOrders)
          .mockResolvedValueOnce([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'order',
        shopify_id: '101',
        data_json: mockOrders[0] as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.orders).toBe(1);
      expect(result.status).toBe('completed');
    });

    test('syncs customers successfully', async () => {
      const mockCustomers = [
        {
          id: 201,
          email: 'customer@example.com',
          first_name: 'John',
          last_name: 'Doe',
          orders_count: 5,
          total_spent: '500.00',
        },
      ];

      const mockClient = {
        getProducts: vi.fn().mockResolvedValue([]),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn()
          .mockResolvedValueOnce(mockCustomers)
          .mockResolvedValueOnce([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'customer',
        shopify_id: '201',
        data_json: mockCustomers[0] as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.customers).toBe(1);
      expect(result.status).toBe('completed');
    });

    test('syncs inventory levels successfully', async () => {
      const mockInventoryLevels = [
        {
          inventory_item_id: 301,
          location_id: 401,
          available: 100,
          updated_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockClient = {
        getProducts: vi.fn().mockResolvedValue([]),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue(mockInventoryLevels),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'inventory_level',
        shopify_id: '301:401',
        data_json: mockInventoryLevels[0] as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.inventoryLevels).toBe(1);
      expect(result.status).toBe('completed');
    });

    test('handles idempotency - skips unchanged records', async () => {
      const mockProduct = {
        id: 1,
        title: 'Product 1',
        status: 'active',
        variants: [],
        handle: 'product-1',
      };

      const mockClient = {
        getProducts: vi.fn()
          .mockResolvedValueOnce([mockProduct])
          .mockResolvedValueOnce([]),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);

      // Mock existing record with same data (idempotent case)
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: mockProduct as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });

      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      // Should still count as synced
      expect(result.products).toBe(1);
      expect(result.status).toBe('completed');

      // But should NOT call upsert since data unchanged
      expect(prisma.shopifyObjectCache.upsert).not.toHaveBeenCalled();
    });

    test('increments version on updates', async () => {
      const oldProduct = {
        id: 1,
        title: 'Old Title',
        status: 'active',
        variants: [],
        handle: 'product-1',
      };

      const updatedProduct = {
        id: 1,
        title: 'New Title',
        status: 'active',
        variants: [],
        handle: 'product-1',
      };

      const mockClient = {
        getProducts: vi.fn()
          .mockResolvedValueOnce([updatedProduct])
          .mockResolvedValueOnce([]),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);

      // Mock existing record with old data
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: oldProduct as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });

      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: updatedProduct as Prisma.JsonValue,
        version: 2, // Incremented
        synced_at: new Date(),
      });

      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.products).toBe(1);

      // Should call upsert with version 2
      expect(prisma.shopifyObjectCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            version: 2,
          }),
        })
      );
    });

    test('handles pagination correctly', async () => {
      const batch1 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Product ${i + 1}`,
        status: 'active',
        variants: [],
        handle: `product-${i + 1}`,
      }));

      const batch2 = Array.from({ length: 30 }, (_, i) => ({
        id: i + 51,
        title: `Product ${i + 51}`,
        status: 'active',
        variants: [],
        handle: `product-${i + 51}`,
      }));

      const mockClient = {
        getProducts: vi.fn()
          .mockResolvedValueOnce(batch1) // First batch (50 items)
          .mockResolvedValueOnce(batch2), // Second batch (30 items, less than batchSize so stops)
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: {} as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      expect(result.products).toBe(80); // 50 + 30
      // Should call twice: once for batch1, once for batch2 (which is < batchSize so stops)
      expect(mockClient.getProducts).toHaveBeenCalledTimes(2);
    });

    test('respects sync limits', async () => {
      // Create 100 products, but return them in batches of 50
      const batch1 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Product ${i + 1}`,
        status: 'active',
        variants: [],
        handle: `product-${i + 1}`,
      }));

      const batch2 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 51,
        title: `Product ${i + 51}`,
        status: 'active',
        variants: [],
        handle: `product-${i + 51}`,
      }));

      const mockClient = {
        getProducts: vi.fn()
          .mockResolvedValueOnce(batch1)  // Will stop after processing only 10 due to limit
          .mockResolvedValueOnce(batch2), // Should not be called
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'product',
        shopify_id: '1',
        data_json: {} as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
        limits: {
          products: 10, // Limit to 10 products
        },
      });

      expect(result.products).toBe(10);
      expect(result.status).toBe('completed');
    });

    test('handles sync errors and updates status', async () => {
      const mockClient = {
        getProducts: vi.fn().mockRejectedValue(new Error('API error')),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      await expect(
        performInitialSync({
          workspaceId: mockWorkspaceId,
          shop: mockShop,
          encryptedToken: mockEncryptedToken,
        })
      ).rejects.toThrow('API error');

      // Should update connection status to error
      expect(prisma.shopifyConnection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspace_id: mockWorkspaceId },
          data: expect.objectContaining({
            status: 'error',
          }),
        })
      );
    });

    test('skips inventory levels with missing IDs', async () => {
      const mockInventoryLevels = [
        {
          inventory_item_id: 301,
          location_id: 401,
          available: 100,
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          // Missing inventory_item_id - should be skipped
          location_id: 402,
          available: 50,
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          inventory_item_id: 303,
          // Missing location_id - should be skipped
          available: 75,
          updated_at: '2024-01-15T10:00:00Z',
        },
      ];

      const mockClient = {
        getProducts: vi.fn().mockResolvedValue([]),
        getOrders: vi.fn().mockResolvedValue([]),
        getCustomers: vi.fn().mockResolvedValue([]),
        getInventoryLevels: vi.fn().mockResolvedValue(mockInventoryLevels),
      };

      vi.mocked(ShopifyClient).mockImplementation(() => mockClient as any);
      vi.mocked(prisma.shopifyObjectCache.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.shopifyObjectCache.upsert).mockResolvedValue({
        id: 'cache-id',
        workspace_id: mockWorkspaceId,
        object_type: 'inventory_level',
        shopify_id: '301:401',
        data_json: mockInventoryLevels[0] as Prisma.JsonValue,
        version: 1,
        synced_at: new Date(),
      });
      vi.mocked(prisma.shopifyConnection.updateMany).mockResolvedValue({ count: 1 });

      const result = await performInitialSync({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
        encryptedToken: mockEncryptedToken,
      });

      // Should only sync the valid inventory level
      expect(result.inventoryLevels).toBe(1);
      expect(result.status).toBe('completed');
    });
  });

  describe('getSyncStatus', () => {
    test('returns sync status with counts', async () => {
      vi.mocked(prisma.shopifyObjectCache.count)
        .mockResolvedValueOnce(10) // products
        .mockResolvedValueOnce(25) // orders
        .mockResolvedValueOnce(15) // customers
        .mockResolvedValueOnce(50); // inventory levels

      vi.mocked(prisma.shopifyConnection.findUnique).mockResolvedValue({
        id: 'connection-id',
        workspace_id: mockWorkspaceId,
        store_domain: mockShop,
        access_token_encrypted: mockEncryptedToken,
        scopes: 'read_products,read_orders',
        status: 'active',
        installed_at: new Date(),
        revoked_at: null,
      });

      const status = await getSyncStatus(mockWorkspaceId);

      expect(status).toEqual({
        products: 10,
        orders: 25,
        customers: 15,
        inventoryLevels: 50,
        status: 'completed',
      });
    });

    test('returns null for non-existent workspace', async () => {
      vi.mocked(prisma.shopifyObjectCache.count).mockResolvedValue(0);
      vi.mocked(prisma.shopifyConnection.findUnique).mockResolvedValue(null);

      const status = await getSyncStatus('non-existent-workspace');

      expect(status).toBeNull();
    });

    test('returns failed status for error connection', async () => {
      vi.mocked(prisma.shopifyObjectCache.count)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(20);

      vi.mocked(prisma.shopifyConnection.findUnique).mockResolvedValue({
        id: 'connection-id',
        workspace_id: mockWorkspaceId,
        store_domain: mockShop,
        access_token_encrypted: mockEncryptedToken,
        scopes: 'read_products,read_orders',
        status: 'error',
        installed_at: new Date(),
        revoked_at: null,
      });

      const status = await getSyncStatus(mockWorkspaceId);

      expect(status?.status).toBe('failed');
    });

    test('returns in_progress status for workspace with no data', async () => {
      vi.mocked(prisma.shopifyObjectCache.count).mockResolvedValue(0);
      vi.mocked(prisma.shopifyConnection.findUnique).mockResolvedValue({
        id: 'connection-id',
        workspace_id: mockWorkspaceId,
        store_domain: mockShop,
        access_token_encrypted: mockEncryptedToken,
        scopes: 'read_products,read_orders',
        status: 'active',
        installed_at: new Date(),
        revoked_at: null,
      });

      const status = await getSyncStatus(mockWorkspaceId);

      expect(status?.status).toBe('in_progress');
    });

    test('handles database errors gracefully', async () => {
      vi.mocked(prisma.shopifyObjectCache.count).mockRejectedValue(
        new Error('Database error')
      );

      const status = await getSyncStatus(mockWorkspaceId);

      expect(status).toBeNull();
    });
  });
});
