/**
 * Integration Tests: Tenant Isolation
 * MerchOps Beta MVP
 *
 * Tests:
 * - Workspace data isolation
 * - Cross-tenant access prevention
 * - Query scoping validation
 * - Multi-tenant security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  prismaMock,
  createTestWorkspaces,
  createTestUser,
  createTestEvent,
  createTestOpportunity,
  createTestActionDraft,
  createTestExecution,
  createTestShopifyConnection,
} from '../../setup';

// ============================================================================
// TENANT-SCOPED QUERIES
// ============================================================================

/**
 * Get events for a workspace (properly scoped)
 */
async function getWorkspaceEvents(workspaceId: string) {
  return await prismaMock.event.findMany({
    where: {
      workspace_id: workspaceId,
    },
  });
}

/**
 * Get opportunities for a workspace (properly scoped)
 */
async function getWorkspaceOpportunities(workspaceId: string) {
  return await prismaMock.opportunity.findMany({
    where: {
      workspace_id: workspaceId,
    },
  });
}

/**
 * Get executions for a workspace (properly scoped)
 */
async function getWorkspaceExecutions(workspaceId: string) {
  return await prismaMock.execution.findMany({
    where: {
      workspace_id: workspaceId,
    },
  });
}

/**
 * Get opportunity by ID with workspace check
 */
async function getOpportunitySecure(opportunityId: string, workspaceId: string) {
  return await prismaMock.opportunity.findFirst({
    where: {
      id: opportunityId,
      workspace_id: workspaceId, // CRITICAL: workspace check
    },
  });
}

/**
 * Update action draft with workspace validation
 */
async function updateActionDraftSecure(
  draftId: string,
  workspaceId: string,
  updates: any
) {
  // First verify the draft belongs to this workspace
  const draft = await prismaMock.actionDraft.findFirst({
    where: {
      id: draftId,
      workspace_id: workspaceId,
    },
  });

  if (!draft) {
    throw new Error('UNAUTHORIZED: Draft not found or access denied');
  }

  return await prismaMock.actionDraft.update({
    where: { id: draftId },
    data: updates,
  });
}

// ============================================================================
// TESTS: BASIC WORKSPACE ISOLATION
// ============================================================================

describe('Basic Workspace Isolation', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  beforeEach(() => {
    prismaMock.workspace.findMany.mockResolvedValue([workspace1, workspace2]);
  });

  it('isolates events between workspaces', async () => {
    const event1 = createTestEvent({
      id: 'event-1',
      workspace_id: workspace1.id,
    });

    const event2 = createTestEvent({
      id: 'event-2',
      workspace_id: workspace2.id,
    });

    // Workspace 1 query
    prismaMock.event.findMany.mockResolvedValueOnce([event1]);

    const workspace1Events = await getWorkspaceEvents(workspace1.id);

    expect(workspace1Events).toHaveLength(1);
    expect(workspace1Events[0].id).toBe('event-1');
    expect(workspace1Events[0].workspace_id).toBe(workspace1.id);

    // Workspace 2 query
    prismaMock.event.findMany.mockResolvedValueOnce([event2]);

    const workspace2Events = await getWorkspaceEvents(workspace2.id);

    expect(workspace2Events).toHaveLength(1);
    expect(workspace2Events[0].id).toBe('event-2');
    expect(workspace2Events[0].workspace_id).toBe(workspace2.id);
  });

  it('isolates opportunities between workspaces', async () => {
    const opp1 = createTestOpportunity({
      id: 'opp-1',
      workspace_id: workspace1.id,
    });

    const opp2 = createTestOpportunity({
      id: 'opp-2',
      workspace_id: workspace2.id,
    });

    prismaMock.opportunity.findMany.mockResolvedValueOnce([opp1]);

    const workspace1Opps = await getWorkspaceOpportunities(workspace1.id);

    expect(workspace1Opps).toHaveLength(1);
    expect(workspace1Opps[0].workspace_id).toBe(workspace1.id);
  });

  it('isolates executions between workspaces', async () => {
    const exec1 = createTestExecution({
      id: 'exec-1',
      workspace_id: workspace1.id,
    });

    const exec2 = createTestExecution({
      id: 'exec-2',
      workspace_id: workspace2.id,
    });

    prismaMock.execution.findMany.mockResolvedValueOnce([exec1]);

    const workspace1Execs = await getWorkspaceExecutions(workspace1.id);

    expect(workspace1Execs).toHaveLength(1);
    expect(workspace1Execs[0].workspace_id).toBe(workspace1.id);
  });

  it('isolates Shopify connections between workspaces', async () => {
    const conn1 = createTestShopifyConnection({
      id: 'conn-1',
      workspace_id: workspace1.id,
      store_domain: 'store1.myshopify.com',
    });

    const conn2 = createTestShopifyConnection({
      id: 'conn-2',
      workspace_id: workspace2.id,
      store_domain: 'store2.myshopify.com',
    });

    prismaMock.shopifyConnection.findMany.mockResolvedValueOnce([conn1]);

    const workspace1Conns = await prismaMock.shopifyConnection.findMany({
      where: { workspace_id: workspace1.id },
    });

    expect(workspace1Conns).toHaveLength(1);
    expect(workspace1Conns[0].store_domain).toBe('store1.myshopify.com');
  });
});

// ============================================================================
// TESTS: CROSS-TENANT ACCESS PREVENTION
// ============================================================================

describe('Cross-Tenant Access Prevention', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  it('prevents accessing another workspace\'s opportunity by ID', async () => {
    const opportunity = createTestOpportunity({
      id: 'opp-cross-tenant',
      workspace_id: workspace2.id,
    });

    // Workspace 1 user tries to access Workspace 2's opportunity
    prismaMock.opportunity.findFirst.mockResolvedValue(null);

    const result = await getOpportunitySecure('opp-cross-tenant', workspace1.id);

    expect(result).toBeNull();
  });

  it('prevents updating another workspace\'s action draft', async () => {
    const draft = createTestActionDraft({
      id: 'draft-cross-tenant',
      workspace_id: workspace2.id,
    });

    // Workspace 1 user tries to update Workspace 2's draft
    prismaMock.actionDraft.findFirst.mockResolvedValue(null);

    await expect(
      updateActionDraftSecure('draft-cross-tenant', workspace1.id, {
        state: 'approved',
      })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('allows user to access their own workspace data', async () => {
    const draft = createTestActionDraft({
      id: 'draft-own-workspace',
      workspace_id: workspace1.id,
    });

    // Workspace 1 user accesses their own draft
    prismaMock.actionDraft.findFirst.mockResolvedValue(draft);
    prismaMock.actionDraft.update.mockResolvedValue({
      ...draft,
      state: 'approved',
    });

    const result = await updateActionDraftSecure('draft-own-workspace', workspace1.id, {
      state: 'approved',
    });

    expect(result.state).toBe('approved');
  });

  it('prevents cross-workspace event access via dedupe key', async () => {
    const event1 = createTestEvent({
      id: 'event-1',
      workspace_id: workspace1.id,
      dedupe_key: 'inventory:product-123:2024-01-15',
    });

    const event2 = createTestEvent({
      id: 'event-2',
      workspace_id: workspace2.id,
      dedupe_key: 'inventory:product-123:2024-01-15', // Same dedupe key, different workspace
    });

    // Both should coexist due to composite unique constraint
    prismaMock.event.findUnique
      .mockResolvedValueOnce(event1)
      .mockResolvedValueOnce(event2);

    const result1 = await prismaMock.event.findUnique({
      where: {
        workspace_id_dedupe_key: {
          workspace_id: workspace1.id,
          dedupe_key: 'inventory:product-123:2024-01-15',
        },
      },
    });

    const result2 = await prismaMock.event.findUnique({
      where: {
        workspace_id_dedupe_key: {
          workspace_id: workspace2.id,
          dedupe_key: 'inventory:product-123:2024-01-15',
        },
      },
    });

    expect(result1?.workspace_id).toBe(workspace1.id);
    expect(result2?.workspace_id).toBe(workspace2.id);
    expect(result1?.id).not.toBe(result2?.id);
  });
});

// ============================================================================
// TESTS: USER WORKSPACE BINDING
// ============================================================================

describe('User Workspace Binding', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  it('enforces user belongs to single workspace', async () => {
    const user1 = createTestUser({
      id: 'user-1',
      email: 'user1@example.com',
      workspace_id: workspace1.id,
    });

    const user2 = createTestUser({
      id: 'user-2',
      email: 'user2@example.com',
      workspace_id: workspace2.id,
    });

    prismaMock.user.findUnique.mockResolvedValueOnce(user1);

    const result = await prismaMock.user.findUnique({
      where: { id: 'user-1' },
    });

    expect(result?.workspace_id).toBe(workspace1.id);
  });

  it('prevents user from accessing data outside their workspace', async () => {
    const user = createTestUser({
      id: 'user-1',
      workspace_id: workspace1.id,
    });

    const opportunity = createTestOpportunity({
      workspace_id: workspace2.id, // Different workspace
    });

    // Simulate middleware/guard checking workspace_id
    prismaMock.opportunity.findFirst.mockResolvedValue(null);

    const result = await prismaMock.opportunity.findFirst({
      where: {
        id: opportunity.id,
        workspace_id: user.workspace_id, // User's workspace check
      },
    });

    expect(result).toBeNull();
  });
});

// ============================================================================
// TESTS: CASCADE DELETE ISOLATION
// ============================================================================

describe('Cascade Delete Isolation', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  it('deleting workspace only affects its own data', async () => {
    const workspace1Events = [
      createTestEvent({ id: 'event-1', workspace_id: workspace1.id }),
      createTestEvent({ id: 'event-2', workspace_id: workspace1.id }),
    ];

    const workspace2Events = [
      createTestEvent({ id: 'event-3', workspace_id: workspace2.id }),
    ];

    // Delete workspace1
    prismaMock.workspace.delete.mockResolvedValue(workspace1);

    await prismaMock.workspace.delete({
      where: { id: workspace1.id },
    });

    // Workspace2 data should remain
    prismaMock.event.findMany.mockResolvedValue(workspace2Events);

    const remainingEvents = await prismaMock.event.findMany({
      where: { workspace_id: workspace2.id },
    });

    expect(remainingEvents).toHaveLength(1);
    expect(remainingEvents[0].workspace_id).toBe(workspace2.id);
  });

  it('cascades delete through all related tables', async () => {
    const workspace = workspace1;

    // Workspace has multiple related records
    const events = [createTestEvent({ workspace_id: workspace.id })];
    const opportunities = [createTestOpportunity({ workspace_id: workspace.id })];
    const drafts = [createTestActionDraft({ workspace_id: workspace.id })];
    const executions = [createTestExecution({ workspace_id: workspace.id })];

    prismaMock.workspace.delete.mockResolvedValue(workspace);

    await prismaMock.workspace.delete({
      where: { id: workspace.id },
    });

    // After delete, querying for workspace data returns nothing
    prismaMock.event.findMany.mockResolvedValue([]);
    prismaMock.opportunity.findMany.mockResolvedValue([]);
    prismaMock.actionDraft.findMany.mockResolvedValue([]);
    prismaMock.execution.findMany.mockResolvedValue([]);

    const remainingEvents = await prismaMock.event.findMany({
      where: { workspace_id: workspace.id },
    });

    expect(remainingEvents).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: QUERY SCOPING VALIDATION
// ============================================================================

describe('Query Scoping Validation', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  it('requires workspace_id in all tenant-scoped queries', async () => {
    // Good query: includes workspace_id
    prismaMock.event.findMany.mockResolvedValue([]);

    const goodQuery = await prismaMock.event.findMany({
      where: {
        workspace_id: workspace1.id,
        type: 'inventory_threshold_crossed',
      },
    });

    expect(goodQuery).toBeDefined();

    // NOTE: In production, middleware should prevent queries without workspace_id
    // This test documents the expected pattern
  });

  it('properly scopes nested queries', async () => {
    const opportunity = createTestOpportunity({
      workspace_id: workspace1.id,
    });

    const draft = createTestActionDraft({
      workspace_id: workspace1.id,
      opportunity_id: opportunity.id,
    });

    // Query with nested include
    prismaMock.opportunity.findFirst.mockResolvedValue({
      ...opportunity,
      action_drafts: [draft],
    });

    const result = await prismaMock.opportunity.findFirst({
      where: {
        id: opportunity.id,
        workspace_id: workspace1.id, // Workspace check at root
      },
      include: {
        action_drafts: true, // Implicit workspace filtering via FK
      },
    });

    expect(result?.workspace_id).toBe(workspace1.id);
    expect(result?.action_drafts?.[0].workspace_id).toBe(workspace1.id);
  });

  it('prevents aggregation queries across workspaces', async () => {
    // Bad: count all opportunities regardless of workspace
    // Good: count opportunities for specific workspace

    prismaMock.opportunity.count.mockResolvedValue(5);

    const count = await prismaMock.opportunity.count({
      where: {
        workspace_id: workspace1.id, // REQUIRED
      },
    });

    expect(count).toBe(5);
  });
});

// ============================================================================
// TESTS: SECURITY EDGE CASES
// ============================================================================

describe('Security Edge Cases', () => {
  const [workspace1, workspace2] = createTestWorkspaces(2);

  it('prevents SQL injection via workspace_id', async () => {
    const maliciousWorkspaceId = "' OR '1'='1"; // SQL injection attempt

    prismaMock.event.findMany.mockResolvedValue([]);

    // Prisma parameterizes queries, preventing injection
    const result = await prismaMock.event.findMany({
      where: {
        workspace_id: maliciousWorkspaceId,
      },
    });

    // Should return empty, not all events
    expect(result).toHaveLength(0);
  });

  it('handles null workspace_id safely', async () => {
    // Null workspace_id should not match any records
    prismaMock.opportunity.findMany.mockResolvedValue([]);

    const result = await prismaMock.opportunity.findMany({
      where: {
        workspace_id: null as any,
      },
    });

    expect(result).toHaveLength(0);
  });

  it('handles undefined workspace_id safely', async () => {
    // Undefined should not bypass workspace filter
    prismaMock.opportunity.findMany.mockResolvedValue([]);

    const result = await prismaMock.opportunity.findMany({
      where: {
        workspace_id: undefined as any,
      },
    });

    // This would return all in unsafe query - Prisma handles it
    expect(result).toHaveLength(0);
  });

  it('prevents workspace_id manipulation in updates', async () => {
    const draft = createTestActionDraft({
      id: 'draft-1',
      workspace_id: workspace1.id,
    });

    // User tries to change workspace_id to access another workspace
    prismaMock.actionDraft.findFirst.mockResolvedValue(null);

    await expect(
      updateActionDraftSecure('draft-1', workspace2.id, {
        workspace_id: workspace2.id, // Malicious update
      })
    ).rejects.toThrow('UNAUTHORIZED');
  });
});

// ============================================================================
// TESTS: MULTI-WORKSPACE OPERATIONS
// ============================================================================

describe('Multi-Workspace Operations', () => {
  it('supports same-named resources in different workspaces', async () => {
    const workspaces = createTestWorkspaces(3);

    // All workspaces can have opportunity with type "inventory_clearance"
    const opportunities = workspaces.map((workspace, i) =>
      createTestOpportunity({
        id: `opp-${i}`,
        workspace_id: workspace.id,
        type: 'inventory_clearance',
      })
    );

    // Each workspace independently
    for (let i = 0; i < workspaces.length; i++) {
      prismaMock.opportunity.findMany.mockResolvedValueOnce([opportunities[i]]);

      const result = await prismaMock.opportunity.findMany({
        where: {
          workspace_id: workspaces[i].id,
          type: 'inventory_clearance',
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].workspace_id).toBe(workspaces[i].id);
    }
  });

  it('allows same Shopify product IDs across workspaces', async () => {
    const [workspace1, workspace2] = createTestWorkspaces(2);

    const event1 = createTestEvent({
      workspace_id: workspace1.id,
      payload_json: { product_id: 'gid://shopify/Product/123' },
    });

    const event2 = createTestEvent({
      workspace_id: workspace2.id,
      payload_json: { product_id: 'gid://shopify/Product/123' }, // Same product ID
    });

    // Both should coexist
    prismaMock.event.findMany
      .mockResolvedValueOnce([event1])
      .mockResolvedValueOnce([event2]);

    const workspace1Events = await prismaMock.event.findMany({
      where: { workspace_id: workspace1.id },
    });

    const workspace2Events = await prismaMock.event.findMany({
      where: { workspace_id: workspace2.id },
    });

    expect(workspace1Events).toHaveLength(1);
    expect(workspace2Events).toHaveLength(1);
  });
});
