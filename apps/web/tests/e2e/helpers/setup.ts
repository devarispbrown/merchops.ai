/**
 * E2E Test Setup Utilities
 * MerchOps Beta MVP - Database seeding and cleanup for E2E tests
 *
 * Provides:
 * - Database seeding for tests
 * - Cleanup after tests
 * - Workspace isolation utilities
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import {
  TEST_USER_EMAIL,
  TEST_USER_PASSWORD,
  TEST_WORKSPACE_ID,
  TEST_STORE_DOMAIN,
  MOCK_OPPORTUNITY_HIGH_PRIORITY,
  MOCK_OPPORTUNITY_MEDIUM_PRIORITY,
} from './mocks';

const prisma = new PrismaClient();

// ============================================================================
// DATABASE SEEDING
// ============================================================================

/**
 * Seed database with test user, workspace, and Shopify connection
 */
export async function seedTestData(): Promise<{
  workspace: any;
  user: any;
  connection: any;
}> {
  // Create workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: TEST_WORKSPACE_ID },
    update: {},
    create: {
      id: TEST_WORKSPACE_ID,
      name: 'Test Workspace E2E',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_at: new Date('2024-01-01T00:00:00Z'),
    },
  });

  // Create user with hashed password
  const passwordHash = await hash(TEST_USER_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {
      password_hash: passwordHash,
      workspace_id: workspace.id,
    },
    create: {
      id: 'test-user-e2e',
      email: TEST_USER_EMAIL,
      password_hash: passwordHash,
      workspace_id: workspace.id,
      created_at: new Date('2024-01-01T00:00:00Z'),
    },
  });

  // Create Shopify connection
  const connection = await prisma.shopifyConnection.upsert({
    where: { workspace_id: workspace.id },
    update: {},
    create: {
      id: 'test-connection-e2e',
      workspace_id: workspace.id,
      store_domain: TEST_STORE_DOMAIN,
      access_token_encrypted: 'encrypted_test_token_e2e',
      scopes: 'read_products,write_products,read_orders,write_orders,read_inventory',
      status: 'active',
      installed_at: new Date('2024-01-01T00:00:00Z'),
    },
  });

  return { workspace, user, connection };
}

/**
 * Seed opportunities for testing queue flows
 */
export async function seedOpportunities(): Promise<any[]> {
  const opportunities = [];

  // High-priority opportunity
  const highPriority = await prisma.opportunity.upsert({
    where: { id: MOCK_OPPORTUNITY_HIGH_PRIORITY.id },
    update: {},
    create: {
      id: MOCK_OPPORTUNITY_HIGH_PRIORITY.id,
      workspace_id: TEST_WORKSPACE_ID,
      type: MOCK_OPPORTUNITY_HIGH_PRIORITY.type,
      priority_bucket: MOCK_OPPORTUNITY_HIGH_PRIORITY.priority_bucket,
      why_now: MOCK_OPPORTUNITY_HIGH_PRIORITY.why_now,
      rationale: MOCK_OPPORTUNITY_HIGH_PRIORITY.rationale,
      impact_range: MOCK_OPPORTUNITY_HIGH_PRIORITY.impact_range,
      counterfactual: MOCK_OPPORTUNITY_HIGH_PRIORITY.counterfactual,
      decay_at: new Date(MOCK_OPPORTUNITY_HIGH_PRIORITY.decay_at),
      confidence: MOCK_OPPORTUNITY_HIGH_PRIORITY.confidence,
      state: MOCK_OPPORTUNITY_HIGH_PRIORITY.state,
      created_at: new Date(MOCK_OPPORTUNITY_HIGH_PRIORITY.created_at),
      updated_at: new Date(MOCK_OPPORTUNITY_HIGH_PRIORITY.updated_at),
    },
  });
  opportunities.push(highPriority);

  // Medium-priority opportunity
  const mediumPriority = await prisma.opportunity.upsert({
    where: { id: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.id },
    update: {},
    create: {
      id: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.id,
      workspace_id: TEST_WORKSPACE_ID,
      type: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.type,
      priority_bucket: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.priority_bucket,
      why_now: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.why_now,
      rationale: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.rationale,
      impact_range: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.impact_range,
      counterfactual: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.counterfactual,
      decay_at: new Date(MOCK_OPPORTUNITY_MEDIUM_PRIORITY.decay_at),
      confidence: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.confidence,
      state: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.state,
      created_at: new Date(MOCK_OPPORTUNITY_MEDIUM_PRIORITY.created_at),
      updated_at: new Date(MOCK_OPPORTUNITY_MEDIUM_PRIORITY.updated_at),
    },
  });
  opportunities.push(mediumPriority);

  return opportunities;
}

/**
 * Seed events that triggered opportunities
 */
export async function seedEvents(): Promise<any[]> {
  const events = [];

  // Inventory threshold event
  const inventoryEvent = await prisma.event.upsert({
    where: { dedupe_key: 'inventory_threshold_crossed:123456:2024-01-15' },
    update: {},
    create: {
      id: 'event-inventory-001',
      workspace_id: TEST_WORKSPACE_ID,
      type: 'inventory_threshold_crossed',
      occurred_at: new Date('2024-01-15T12:00:00Z'),
      payload_json: {
        product_id: 'gid://shopify/Product/123456',
        current_inventory: 5,
        threshold: 10,
      },
      dedupe_key: 'inventory_threshold_crossed:123456:2024-01-15',
      source: 'computed',
      created_at: new Date('2024-01-15T12:05:00Z'),
    },
  });
  events.push(inventoryEvent);

  // Customer inactivity event
  const inactivityEvent = await prisma.event.upsert({
    where: { dedupe_key: 'customer_inactivity_60d:2024-01-15' },
    update: {},
    create: {
      id: 'event-inactivity-001',
      workspace_id: TEST_WORKSPACE_ID,
      type: 'customer_inactivity_threshold',
      occurred_at: new Date('2024-01-15T00:00:00Z'),
      payload_json: {
        threshold_days: 60,
        customer_count: 127,
        total_prior_value: 12400,
      },
      dedupe_key: 'customer_inactivity_60d:2024-01-15',
      source: 'computed',
      created_at: new Date('2024-01-15T09:00:00Z'),
    },
  });
  events.push(inactivityEvent);

  // Link events to opportunities
  await prisma.opportunityEventLink.upsert({
    where: {
      opportunity_id_event_id: {
        opportunity_id: MOCK_OPPORTUNITY_HIGH_PRIORITY.id,
        event_id: inventoryEvent.id,
      },
    },
    update: {},
    create: {
      opportunity_id: MOCK_OPPORTUNITY_HIGH_PRIORITY.id,
      event_id: inventoryEvent.id,
    },
  });

  await prisma.opportunityEventLink.upsert({
    where: {
      opportunity_id_event_id: {
        opportunity_id: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.id,
        event_id: inactivityEvent.id,
      },
    },
    update: {},
    create: {
      opportunity_id: MOCK_OPPORTUNITY_MEDIUM_PRIORITY.id,
      event_id: inactivityEvent.id,
    },
  });

  return events;
}

/**
 * Seed action draft for approval flow testing
 */
export async function seedActionDraft(opportunityId: string = MOCK_OPPORTUNITY_HIGH_PRIORITY.id): Promise<any> {
  return await prisma.actionDraft.upsert({
    where: { id: 'draft-e2e-001' },
    update: {},
    create: {
      id: 'draft-e2e-001',
      workspace_id: TEST_WORKSPACE_ID,
      opportunity_id: opportunityId,
      operator_intent: 'reduce_inventory_risk',
      execution_type: 'discount_draft',
      payload_json: {
        discount_code: 'CLEARANCE15',
        discount_percent: 15,
        product_ids: ['gid://shopify/Product/123456'],
        starts_at: '2024-01-16T00:00:00Z',
        ends_at: '2024-01-22T23:59:59Z',
        title: 'Inventory Clearance - Premium Widget',
      },
      editable_fields_json: {
        discount_code: { type: 'string', max_length: 50 },
        discount_percent: { type: 'number', min: 5, max: 50 },
        starts_at: { type: 'datetime' },
        ends_at: { type: 'datetime' },
      },
      state: 'draft',
      created_at: new Date('2024-01-15T12:15:00Z'),
      updated_at: new Date('2024-01-15T12:15:00Z'),
    },
  });
}

/**
 * Seed execution (for history and failure testing)
 */
export async function seedExecution(draftId: string, status: 'success' | 'failed' = 'success'): Promise<any> {
  const baseData = {
    workspace_id: TEST_WORKSPACE_ID,
    action_draft_id: draftId,
    request_payload_json: {
      discount_code: 'CLEARANCE15',
      discount_percent: 15,
      product_ids: ['gid://shopify/Product/123456'],
    },
    idempotency_key: `exec:${draftId}:${Date.now()}`,
    started_at: new Date('2024-01-15T12:20:00Z'),
  };

  if (status === 'success') {
    return await prisma.execution.create({
      data: {
        id: `exec-e2e-success-${Date.now()}`,
        ...baseData,
        status: 'success',
        provider_response_json: {
          id: 'gid://shopify/PriceRule/555666',
          title: 'CLEARANCE15',
          value_type: 'percentage',
          value: '-15.0',
        },
        finished_at: new Date('2024-01-15T12:20:15Z'),
      },
    });
  } else {
    return await prisma.execution.create({
      data: {
        id: `exec-e2e-failed-${Date.now()}`,
        ...baseData,
        status: 'failed',
        error_code: 'SHOPIFY_API_ERROR',
        error_message: 'Discount code already exists',
        provider_response_json: {
          errors: ['Discount code must be unique'],
        },
        finished_at: new Date('2024-01-15T12:20:05Z'),
      },
    });
  }
}

/**
 * Seed all test data in one operation
 */
export async function seedAll(): Promise<void> {
  await seedTestData();
  await seedEvents();
  await seedOpportunities();
  const draft = await seedActionDraft();
  await seedExecution(draft.id, 'success');
}

// ============================================================================
// CLEANUP UTILITIES
// ============================================================================

/**
 * Clean up test data for a specific workspace
 */
export async function cleanupWorkspace(workspaceId: string = TEST_WORKSPACE_ID): Promise<void> {
  // Delete in correct order to respect foreign keys
  await prisma.execution.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.actionDraft.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.opportunityEventLink.deleteMany({
    where: { opportunity: { workspace_id: workspaceId } },
  });
  await prisma.opportunity.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.event.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.shopifyConnection.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.user.deleteMany({ where: { workspace_id: workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

/**
 * Clean up all test data
 */
export async function cleanupAll(): Promise<void> {
  // Delete test workspaces (cascade should handle relationships)
  await cleanupWorkspace(TEST_WORKSPACE_ID);

  // Clean up any orphaned test data
  await prisma.execution.deleteMany({ where: { id: { startsWith: 'exec-e2e-' } } });
  await prisma.actionDraft.deleteMany({ where: { id: { startsWith: 'draft-e2e-' } } });
  await prisma.opportunity.deleteMany({ where: { id: { startsWith: 'opp-' } } });
  await prisma.event.deleteMany({ where: { id: { startsWith: 'event-' } } });
}

/**
 * Reset database to clean state
 */
export async function resetDatabase(): Promise<void> {
  await cleanupAll();
  await seedAll();
}

/**
 * Disconnect Prisma client
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

// ============================================================================
// TEST ISOLATION UTILITIES
// ============================================================================

/**
 * Create isolated workspace for a specific test
 */
export async function createIsolatedWorkspace(testName: string): Promise<string> {
  const workspaceId = `test-workspace-${testName}-${Date.now()}`;

  await prisma.workspace.create({
    data: {
      id: workspaceId,
      name: `Test Workspace - ${testName}`,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  return workspaceId;
}

/**
 * Get or create test session token for authentication
 */
export async function getTestSessionToken(userId: string = 'test-user-e2e'): Promise<string> {
  // In a real implementation, this would create a valid NextAuth session token
  // For E2E tests, we can use a mock token that the test environment recognizes
  return `test-session-${userId}-${Date.now()}`;
}
