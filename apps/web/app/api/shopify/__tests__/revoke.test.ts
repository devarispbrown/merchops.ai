/**
 * Revocation Handler Tests
 *
 * Tests for the Shopify app uninstall webhook handler, focusing on:
 * - Workspace lookup from shop domain
 * - Connection status update to revoked
 * - Cancellation of pending work (executions, opportunities, action drafts)
 * - Cleanup of scheduled jobs
 * - Idempotency
 *
 * TODO: Convert from Jest to Vitest
 */
import { NextRequest } from 'next/server';
import { describe, expect, beforeEach, vi } from 'vitest';

import { prisma } from '@/server/db/client';

import { POST } from '../revoke/route';

// Mock dependencies
vi.mock('@/server/db/client', () => ({
  prisma: {
    shopifyConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    execution: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    actionDraft: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/server/jobs/queues', () => ({
  getAllQueues: vi.fn(() => [
    {
      name: 'shopify-sync',
      getJobs: vi.fn().mockResolvedValue([]),
    },
    {
      name: 'execution',
      getJobs: vi.fn().mockResolvedValue([]),
    },
  ]),
}));

vi.mock('@/server/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/server/shopify/webhooks', () => ({
  verifyWebhookHmac: vi.fn().mockReturnValue(true),
  parseWebhookHeaders: vi.fn().mockReturnValue({
    hmac: 'valid-hmac',
    shop: 'test-store.myshopify.com',
    topic: 'app/uninstalled',
    webhookId: 'webhook-123',
  }),
}));

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - Workspace Lookup', () => {
  const mockShop = 'test-store.myshopify.com';
  const mockWorkspaceId = 'workspace-123';
  const mockConnectionId = 'connection-456';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock finding connection
    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: mockConnectionId,
      workspace_id: mockWorkspaceId,
      store_domain: mockShop,
      status: 'active',
      workspace: {
        id: mockWorkspaceId,
        name: 'Test Workspace',
      },
    });

    // Mock no pending work
    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    const request = new NextRequest(url, {
      method: 'POST',
      body,
    });

    return request;
  }

  test('looks up workspace by shop domain', async () => {
    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(prisma.shopifyConnection.findFirst).toHaveBeenCalledWith({
      where: { store_domain: mockShop },
      include: { workspace: true },
    });
  });

  test('handles shop not found gracefully', async () => {
    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue(null);

    const body = JSON.stringify({ shop_domain: 'unknown-shop.myshopify.com' });
    const request = createMockRequest(body);

    const response = await POST(request);

    // Should return 200 to prevent Shopify retries
    expect(response.status).toBe(200);

    // Should not attempt to update connection
    expect(prisma.shopifyConnection.update).not.toHaveBeenCalled();
  });
});

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - Connection Status Update', () => {
  const mockShop = 'test-store.myshopify.com';
  const mockWorkspaceId = 'workspace-123';
  const mockConnectionId = 'connection-456';

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: mockConnectionId,
      workspace_id: mockWorkspaceId,
      store_domain: mockShop,
      status: 'active',
      workspace: {
        id: mockWorkspaceId,
        name: 'Test Workspace',
      },
    });

    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    return new NextRequest(url, {
      method: 'POST',
      body,
    });
  }

  test('updates connection status to revoked', async () => {
    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(prisma.shopifyConnection.update).toHaveBeenCalledWith({
      where: { id: mockConnectionId },
      data: {
        status: 'revoked',
        revoked_at: expect.any(Date),
      },
    });
  });

  test('sets revoked_at timestamp', async () => {
    const beforeRevocation = new Date();

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    const updateCall = (prisma.shopifyConnection.update as jest.Mock).mock.calls[0][0];
    const revokedAt = updateCall.data.revoked_at;

    expect(revokedAt).toBeInstanceOf(Date);
    expect(revokedAt.getTime()).toBeGreaterThanOrEqual(beforeRevocation.getTime());
  });

  test('is idempotent - can be called multiple times', async () => {
    const body = JSON.stringify({ shop_domain: mockShop });
    const request1 = createMockRequest(body);
    const request2 = createMockRequest(body);

    // First call
    await POST(request1);
    expect(prisma.shopifyConnection.update).toHaveBeenCalledTimes(1);

    // Second call should also succeed
    await POST(request2);
    expect(prisma.shopifyConnection.update).toHaveBeenCalledTimes(2);
  });
});

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - Cancel Pending Work', () => {
  const mockShop = 'test-store.myshopify.com';
  const mockWorkspaceId = 'workspace-123';
  const mockConnectionId = 'connection-456';

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: mockConnectionId,
      workspace_id: mockWorkspaceId,
      store_domain: mockShop,
      status: 'active',
      workspace: {
        id: mockWorkspaceId,
        name: 'Test Workspace',
      },
    });
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    return new NextRequest(url, {
      method: 'POST',
      body,
    });
  }

  test('cancels pending executions', async () => {
    (prisma.execution.findMany as jest.Mock).mockResolvedValue([
      { id: 'exec-1', status: 'pending' },
      { id: 'exec-2', status: 'running' },
    ]);

    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(prisma.execution.updateMany).toHaveBeenCalledWith({
      where: {
        workspace_id: mockWorkspaceId,
        status: {
          in: ['pending', 'running', 'retrying'],
        },
      },
      data: {
        status: 'failed',
        error_code: 'CANCELLED_REVOKED',
        error_message: 'Execution cancelled due to app uninstallation',
        finished_at: expect.any(Date),
      },
    });
  });

  test('dismisses active opportunities', async () => {
    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([
      { id: 'opp-1', state: 'new' },
      { id: 'opp-2', state: 'viewed' },
    ]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(prisma.opportunity.updateMany).toHaveBeenCalledWith({
      where: {
        workspace_id: mockWorkspaceId,
        state: {
          in: ['new', 'viewed', 'approved'],
        },
      },
      data: {
        state: 'dismissed',
      },
    });
  });

  test('rejects active action drafts', async () => {
    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([
      { id: 'draft-1', state: 'draft' },
      { id: 'draft-2', state: 'approved' },
    ]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(prisma.actionDraft.updateMany).toHaveBeenCalledWith({
      where: {
        workspace_id: mockWorkspaceId,
        state: {
          in: ['draft', 'edited', 'approved', 'executing'],
        },
      },
      data: {
        state: 'rejected',
      },
    });
  });

  test('handles case when no pending work exists', async () => {
    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(200);
    // Should not call updateMany if no records found
    expect(prisma.execution.updateMany).not.toHaveBeenCalled();
    expect(prisma.opportunity.updateMany).not.toHaveBeenCalled();
    expect(prisma.actionDraft.updateMany).not.toHaveBeenCalled();
  });
});

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - Cleanup Jobs', () => {
  const mockShop = 'test-store.myshopify.com';
  const mockWorkspaceId = 'workspace-123';
  const mockConnectionId = 'connection-456';

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: mockConnectionId,
      workspace_id: mockWorkspaceId,
      store_domain: mockShop,
      status: 'active',
      workspace: {
        id: mockWorkspaceId,
        name: 'Test Workspace',
      },
    });

    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    return new NextRequest(url, {
      method: 'POST',
      body,
    });
  }

  test('removes scheduled jobs for workspace', async () => {
    const mockJob1 = {
      data: { workspaceId: mockWorkspaceId },
      remove: vi.fn().mockResolvedValue(true),
    };
    const mockJob2 = {
      data: { workspaceId: 'other-workspace' },
      remove: vi.fn().mockResolvedValue(true),
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllQueues } = require('@/server/jobs/queues');
    getAllQueues.mockReturnValue([
      {
        name: 'shopify-sync',
        getJobs: vi.fn().mockResolvedValue([mockJob1, mockJob2]),
      },
    ]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    // Should only remove jobs for the revoked workspace
    expect(mockJob1.remove).toHaveBeenCalled();
    expect(mockJob2.remove).not.toHaveBeenCalled();
  });

  test('handles job removal errors gracefully', async () => {
    const mockJob = {
      data: { workspaceId: mockWorkspaceId },
      remove: vi.fn().mockRejectedValue(new Error('Job removal failed')),
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAllQueues } = require('@/server/jobs/queues');
    getAllQueues.mockReturnValue([
      {
        name: 'shopify-sync',
        getJobs: vi.fn().mockResolvedValue([mockJob]),
      },
    ]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    const response = await POST(request);

    // Should still return 200 even if job removal fails
    expect(response.status).toBe(200);
  });
});

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - Audit Trail', () => {
  const mockShop = 'test-store.myshopify.com';
  const mockWorkspaceId = 'workspace-123';
  const mockConnectionId = 'connection-456';

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: mockConnectionId,
      workspace_id: mockWorkspaceId,
      store_domain: mockShop,
      status: 'active',
      workspace: {
        id: mockWorkspaceId,
        name: 'Test Workspace',
      },
    });

    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    return new NextRequest(url, {
      method: 'POST',
      body,
    });
  }

  test('logs revocation event with timestamp', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { logger } = require('@/server/observability/logger');

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: mockWorkspaceId,
        shop: mockShop,
      }),
      expect.stringContaining('Revocation complete')
    );
  });

  test('preserves historical data (does not delete records)', async () => {
    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    await POST(request);

    // Verify we're using update/updateMany, not delete/deleteMany
    expect(prisma.shopifyConnection.update).toHaveBeenCalled();

    // Ensure no delete operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = prisma as any;
    expect(prismaClient.shopifyConnection.delete).toBeUndefined();
    expect(prismaClient.execution.delete).toBeUndefined();
    expect(prismaClient.opportunity.delete).toBeUndefined();
  });
});

// TODO: Skipped - requires Jest to Vitest migration (uses jest.clearAllMocks and jest.Mock)
describe.skip('Revocation Handler - HMAC Verification', () => {
  const mockShop = 'test-store.myshopify.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockRequest(body: string): NextRequest {
    const url = new URL('http://localhost:3000/api/shopify/revoke');
    return new NextRequest(url, {
      method: 'POST',
      body,
    });
  }

  test('rejects webhook with invalid HMAC', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { verifyWebhookHmac } = require('@/server/shopify/webhooks');
    verifyWebhookHmac.mockReturnValue(false);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  test('accepts webhook with valid HMAC', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { verifyWebhookHmac } = require('@/server/shopify/webhooks');
    verifyWebhookHmac.mockReturnValue(true);

    (prisma.shopifyConnection.findFirst as jest.Mock).mockResolvedValue({
      id: 'connection-456',
      workspace_id: 'workspace-123',
      store_domain: mockShop,
      status: 'active',
      workspace: { id: 'workspace-123', name: 'Test' },
    });

    (prisma.execution.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.opportunity.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionDraft.findMany as jest.Mock).mockResolvedValue([]);

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    const response = await POST(request);

    expect(response.status).toBe(200);
  });

  test('always returns 200 on error to prevent Shopify retries', async () => {
    (prisma.shopifyConnection.findFirst as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const body = JSON.stringify({ shop_domain: mockShop });
    const request = createMockRequest(body);

    const response = await POST(request);

    // Should return 200 even on error to prevent Shopify from retrying
    expect(response.status).toBe(200);
  });
});
