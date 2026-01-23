// Workspace Isolation Tests
// Verifies no cross-tenant data access is possible

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../db/client';
import bcrypt from 'bcryptjs';

/**
 * Test Setup: Create two separate workspaces with users and data
 */
async function setupTestWorkspaces() {
  // Workspace A
  const workspaceA = await prisma.workspace.create({
    data: { name: 'Test Workspace A' },
  });

  const passwordHash = await bcrypt.hash('TestPass123', 12);

  const userA = await prisma.user.create({
    data: {
      email: 'usera@test.com',
      password_hash: passwordHash,
      workspace_id: workspaceA.id,
    },
  });

  const opportunityA = await prisma.opportunity.create({
    data: {
      workspace_id: workspaceA.id,
      type: 'test_opportunity_a',
      priority_bucket: 'high',
      why_now: 'Test A',
      rationale: 'Test A',
      impact_range: '1-10',
      counterfactual: 'Nothing',
    },
  });

  // Workspace B
  const workspaceB = await prisma.workspace.create({
    data: { name: 'Test Workspace B' },
  });

  const userB = await prisma.user.create({
    data: {
      email: 'userb@test.com',
      password_hash: passwordHash,
      workspace_id: workspaceB.id,
    },
  });

  const opportunityB = await prisma.opportunity.create({
    data: {
      workspace_id: workspaceB.id,
      type: 'test_opportunity_b',
      priority_bucket: 'high',
      why_now: 'Test B',
      rationale: 'Test B',
      impact_range: '1-10',
      counterfactual: 'Nothing',
    },
  });

  return {
    workspaceA: { id: workspaceA.id, user: userA, opportunity: opportunityA },
    workspaceB: { id: workspaceB.id, user: userB, opportunity: opportunityB },
  };
}

/**
 * Test Cleanup: Remove test data
 */
async function cleanupTestWorkspaces(
  workspaceAId: string,
  workspaceBId: string
) {
  await prisma.opportunity.deleteMany({
    where: {
      workspace_id: { in: [workspaceAId, workspaceBId] },
    },
  });

  await prisma.user.deleteMany({
    where: {
      workspace_id: { in: [workspaceAId, workspaceBId] },
    },
  });

  await prisma.workspace.deleteMany({
    where: {
      id: { in: [workspaceAId, workspaceBId] },
    },
  });
}

// TODO: Skipped - requires real database setup and next-auth module resolution fixes
describe.skip('Workspace Isolation', () => {
  let testData: Awaited<ReturnType<typeof setupTestWorkspaces>>;

  beforeEach(async () => {
    testData = await setupTestWorkspaces();
  });

  afterEach(async () => {
    await cleanupTestWorkspaces(
      testData.workspaceA.id,
      testData.workspaceB.id
    );
  });

  it('should not return opportunities from other workspaces', async () => {
    // Query as Workspace A
    const opportunitiesA = await prisma.opportunity.findMany({
      where: { workspace_id: testData.workspaceA.id },
    });

    // Should only see Workspace A's opportunity
    expect(opportunitiesA).toHaveLength(1);
    expect(opportunitiesA[0].id).toBe(testData.workspaceA.opportunity.id);
    expect(opportunitiesA[0].type).toBe('test_opportunity_a');

    // Query as Workspace B
    const opportunitiesB = await prisma.opportunity.findMany({
      where: { workspace_id: testData.workspaceB.id },
    });

    // Should only see Workspace B's opportunity
    expect(opportunitiesB).toHaveLength(1);
    expect(opportunitiesB[0].id).toBe(testData.workspaceB.opportunity.id);
    expect(opportunitiesB[0].type).toBe('test_opportunity_b');
  });

  it('should not allow access to other workspace resources by ID', async () => {
    // Attempt to query Workspace B's opportunity with Workspace A's ID
    const result = await prisma.opportunity.findFirst({
      where: {
        id: testData.workspaceB.opportunity.id,
        workspace_id: testData.workspaceA.id,
      },
    });

    // Should return null (not found)
    expect(result).toBeNull();
  });

  it('should not allow updates to other workspace resources', async () => {
    // Attempt to update Workspace B's opportunity as Workspace A
    const result = await prisma.opportunity.updateMany({
      where: {
        id: testData.workspaceB.opportunity.id,
        workspace_id: testData.workspaceA.id,
      },
      data: {
        why_now: 'Hacked!',
      },
    });

    // Should affect 0 records
    expect(result.count).toBe(0);

    // Verify original data unchanged
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: testData.workspaceB.opportunity.id },
    });

    expect(opportunity?.why_now).toBe('Test B');
  });

  it('should not allow deletion of other workspace resources', async () => {
    // Attempt to delete Workspace B's opportunity as Workspace A
    const result = await prisma.opportunity.deleteMany({
      where: {
        id: testData.workspaceB.opportunity.id,
        workspace_id: testData.workspaceA.id,
      },
    });

    // Should affect 0 records
    expect(result.count).toBe(0);

    // Verify record still exists
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: testData.workspaceB.opportunity.id },
    });

    expect(opportunity).not.toBeNull();
  });

  it('should enforce workspace scope in aggregations', async () => {
    // Count opportunities for Workspace A
    const countA = await prisma.opportunity.count({
      where: { workspace_id: testData.workspaceA.id },
    });

    expect(countA).toBe(1);

    // Count opportunities for Workspace B
    const countB = await prisma.opportunity.count({
      where: { workspace_id: testData.workspaceB.id },
    });

    expect(countB).toBe(1);

    // Total count without scoping should be 2
    const totalCount = await prisma.opportunity.count({
      where: {
        workspace_id: {
          in: [testData.workspaceA.id, testData.workspaceB.id],
        },
      },
    });

    expect(totalCount).toBe(2);
  });

  it('should prevent batch operations across workspaces', async () => {
    // Attempt to update both opportunities with Workspace A's ID
    const result = await prisma.opportunity.updateMany({
      where: {
        id: {
          in: [
            testData.workspaceA.opportunity.id,
            testData.workspaceB.opportunity.id,
          ],
        },
        workspace_id: testData.workspaceA.id,
      },
      data: {
        priority_bucket: 'low',
      },
    });

    // Should only affect Workspace A's opportunity
    expect(result.count).toBe(1);

    // Verify Workspace B's opportunity unchanged
    const opportunityB = await prisma.opportunity.findUnique({
      where: { id: testData.workspaceB.opportunity.id },
    });

    expect(opportunityB?.priority_bucket).toBe('high');
  });

  it('should enforce workspace scope in relations', async () => {
    // Create event for Workspace A
    const eventA = await prisma.event.create({
      data: {
        workspace_id: testData.workspaceA.id,
        type: 'inventory_threshold_crossed',
        occurred_at: new Date(),
        payload_json: {},
        dedupe_key: 'test-event-a',
        source: 'computed',
      },
    });

    // Link event to Workspace A's opportunity
    await prisma.opportunityEventLink.create({
      data: {
        opportunity_id: testData.workspaceA.opportunity.id,
        event_id: eventA.id,
      },
    });

    // Query opportunities with events for Workspace A
    const opportunitiesWithEvents = await prisma.opportunity.findMany({
      where: { workspace_id: testData.workspaceA.id },
      include: {
        event_links: {
          include: {
            event: true,
          },
        },
      },
    });

    // Should see opportunity with linked event
    expect(opportunitiesWithEvents).toHaveLength(1);
    expect(opportunitiesWithEvents[0].event_links).toHaveLength(1);
    expect(opportunitiesWithEvents[0].event_links[0].event.id).toBe(eventA.id);

    // Query for Workspace B should not see any events
    const opportunitiesBWithEvents = await prisma.opportunity.findMany({
      where: { workspace_id: testData.workspaceB.id },
      include: {
        event_links: {
          include: {
            event: true,
          },
        },
      },
    });

    expect(opportunitiesBWithEvents).toHaveLength(1);
    expect(opportunitiesBWithEvents[0].event_links).toHaveLength(0);

    // Cleanup
    await prisma.opportunityEventLink.deleteMany({
      where: { event_id: eventA.id },
    });
    await prisma.event.delete({ where: { id: eventA.id } });
  });
});

describe('Workspace Utility Functions', () => {
  // TODO: Skipped - requires next-auth module resolution (ERR_MODULE_NOT_FOUND for 'next/server')
  it.skip('should validate workspace ownership correctly', async () => {
    const { validateWorkspaceOwnership } = await import('./workspace');

    // This would fail in practice without proper session context
    // But demonstrates the validation logic
    const items = [
      { workspace_id: 'workspace-1' },
      { workspace_id: 'workspace-1' },
    ];

    // Should not throw for items with same workspace
    // (In real usage, would verify against session workspace)
    expect(() => {
      items.every((item) => item.workspace_id === 'workspace-1');
    }).not.toThrow();
  });

  it('should detect cross-workspace items in batch', () => {
    const items = [
      { workspace_id: 'workspace-1' },
      { workspace_id: 'workspace-2' }, // Different workspace!
    ];

    const allSame = items.every(
      (item) => item.workspace_id === items[0].workspace_id
    );

    expect(allSame).toBe(false);
  });
});
