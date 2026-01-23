# Test Fixtures

Comprehensive test fixtures and mocks for MerchOps testing.

## Overview

This directory contains realistic, comprehensive test data for all MerchOps entities:

- **Shopify Webhooks**: Sample webhook payloads with valid HMAC signatures
- **Opportunities**: All opportunity types, states, and priority buckets
- **Events**: All event types with proper dedupe keys
- **Drafts**: Action drafts for each execution type
- **Executions**: Success and failure scenarios with provider responses
- **Users**: Authentication and workspace test data

## Quick Start

```typescript
import {
  // Shopify webhooks
  orderCreatePayload,
  generateWebhookHeaders,
  TEST_SHOPIFY_SECRET,

  // Opportunities
  inventoryClearanceHighPriority,
  opportunitiesByState,

  // Events
  velocitySpikeEvent1,
  eventsByType,

  // Drafts
  discountDraftNew,
  draftsByType,

  // Executions
  executionDiscountSuccess,
  executionsByStatus,

  // Users
  userOwner,
  workspaceActive,
  shopifyConnectionActive,
} from '../fixtures';
```

## Fixtures by Type

### 1. Shopify Webhooks (`shopify-webhooks.ts`)

Complete webhook payloads for all Shopify webhook topics:

**Order Webhooks:**
- `orderCreatePayload` - New order creation
- `orderPaidPayload` - Order payment completed

**Product Webhooks:**
- `productUpdatePayload` - Product updates with variants

**Inventory Webhooks:**
- `inventoryLevelUpdatePayload` - Inventory level changes

**Customer Webhooks:**
- `customerUpdatePayload` - Customer information updates

**HMAC Helpers:**
```typescript
// Generate valid HMAC signature
const hmac = generateWebhookHmac(orderCreatePayload, TEST_SHOPIFY_SECRET);

// Generate complete webhook headers
const headers = generateWebhookHeaders('orders/create', orderCreatePayload, TEST_SHOPIFY_SECRET);

// Pre-computed signatures
const { orderCreate, productUpdate } = TEST_HMAC_SIGNATURES;
```

### 2. Opportunities (`opportunities.ts`)

Opportunities for all types, states, and priority buckets:

**By Type:**
- `INVENTORY_CLEARANCE` - Excess inventory scenarios
- `STOCKOUT_PREVENTION` - Low stock alerts
- `RESTOCK_NOTIFICATION` - Back-in-stock opportunities
- `WINBACK_CAMPAIGN` - Customer reactivation
- `HIGH_VELOCITY_PROTECTION` - Viral product spikes

**By State:**
- `new`, `viewed`, `approved`, `executed`, `resolved`, `dismissed`, `expired`

**By Priority:**
- `high`, `medium`, `low`

**Usage:**
```typescript
// Get all high priority opportunities
const highPriorityOpps = opportunitiesByPriority[PriorityBucket.high];

// Get all new opportunities
const newOpps = opportunitiesByState[OpportunityState.new];

// Get specific opportunity type
const inventoryOpps = opportunitiesByType[OpportunityType.INVENTORY_CLEARANCE];
```

### 3. Events (`events.ts`)

Events for all event types with proper dedupe keys:

**Event Types:**
- `inventory_threshold_crossed` - Inventory below threshold
- `product_out_of_stock` - Product stockout
- `product_back_in_stock` - Product restocked
- `velocity_spike` - Sales velocity spike
- `customer_inactivity_threshold` - Customer inactive

**Usage:**
```typescript
// Get all velocity spike events
const velocityEvents = eventsByType[EventType.velocity_spike];

// Get all webhook-sourced events
const webhookEvents = eventsBySource[EventSource.webhook];

// Generate dedupe key
const dedupeKey = generateInventoryThresholdDedupeKey(
  productId,
  variantId,
  new Date()
);
```

### 4. Action Drafts (`drafts.ts`)

Drafts for all execution types in different states:

**Execution Types:**
- `DISCOUNT_DRAFT` - Discount code creation
- `WINBACK_EMAIL` - Email campaign drafts
- `PAUSE_PRODUCT` - Product pause actions

**Usage:**
```typescript
// Get all discount drafts
const discountDrafts = draftsByType[ExecutionType.DISCOUNT_DRAFT];

// Get approved drafts
const approvedDrafts = draftsByState[ActionDraftState.APPROVED];

// Access payload examples
const discountPayload: DiscountDraftPayload = discountDraftPayloadPercentage;
const emailPayload: WinbackEmailPayload = winbackEmailPayloadHighValue;
const pausePayload: PauseProductPayload = pauseProductPayloadStockout;
```

### 5. Executions (`executions.ts`)

Executions with success/failure scenarios:

**Success Scenarios:**
- `executionDiscountSuccess` - Successful discount creation
- `executionEmailSuccess` - Successful email send
- `executionPauseSuccess` - Successful product pause

**Failure Scenarios:**
- Validation errors (`INVALID_PAYLOAD`)
- Business logic errors (`DISCOUNT_ALREADY_EXISTS`, `PRODUCT_NOT_FOUND`)
- Network errors (`NETWORK_ERROR`, `TIMEOUT`)
- Rate limiting (`RATE_LIMIT_EXCEEDED`)

**Usage:**
```typescript
// Get all succeeded executions
const successfulExecs = executionsByStatus[ExecutionStatus.SUCCEEDED];

// Get retryable failures
const retryableExecs = retryableExecutions;

// Access provider responses
const shopifyResponse = shopifyDiscountSuccessResponse;
const emailResponse = emailProviderSuccessResponse;
```

### 6. Users & Auth (`users.ts`)

User, workspace, and Shopify connection data:

**Workspaces:**
```typescript
const workspace = workspaceActive;
const allWorkspaces = [workspaceActive, workspaceSecondary, workspaceNew];
```

**Users:**
```typescript
const owner = userOwner;
const admin = userAdmin;
const member = userMember;

// Test passwords
const password = TEST_PASSWORD; // "TestPassword123!"
const hash = TEST_PASSWORD_HASH;
```

**Shopify Connections:**
```typescript
const connection = shopifyConnectionActive;
const revokedConnection = shopifyConnectionRevoked;

// Encryption utilities
const encrypted = encryptTestToken('shpat_token123');
```

**Sessions:**
```typescript
const session = sessionUserOwner;
const jwt = jwtTokenOwner;
```

**OAuth Flow:**
```typescript
const startParams = shopifyOAuthStartParams;
const callbackParams = shopifyOAuthCallbackParams;
const tokenResponse = shopifyOAuthTokenResponse;
```

## Factory Functions

Create custom test data on the fly:

```typescript
import {
  createTestOpportunity,
  createTestEvent,
  createTestDraft,
  createTestExecution,
  createTestWorkspace,
  createTestUser,
  createTestShopifyConnection,
} from '../fixtures';

// Create custom opportunity
const opportunity = createTestOpportunity({
  type: OpportunityType.INVENTORY_CLEARANCE,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.new,
});

// Create batch of events
const events = createTestEvents(10, {
  workspace_id: 'my-workspace',
  type: EventType.velocity_spike,
});

// Create complete test scenario
const scenario = createTestScenario({
  workspaceName: 'My Test Store',
  opportunityType: OpportunityType.WINBACK_CAMPAIGN,
  eventCount: 5,
});
// Returns: { workspace, user, shopifyConnection, events, opportunity, draft, execution }
```

## Mocks

### Shopify API Mock (`mocks/shopify-api.ts`)

Mock Shopify API client for testing:

```typescript
import {
  createMockShopifyClient,
  mockShopifyApiSuccess,
  mockShopifyApiNetworkError,
  mockShopifyApiRateLimit,
} from '../mocks';

// Create mock client
const mockClient = createMockShopifyClient();

// Configure for success
mockClient.mockSuccess();

// Configure for failure
mockClient.mockFailure('network');
mockClient.mockFailure('rate_limit');
mockClient.mockFailure('not_found');

// Use in tests
const response = await mockClient.createPriceRule({ ... });
```

### Email Provider Mock (`mocks/email-provider.ts`)

Mock email provider for testing:

```typescript
import {
  createMockEmailProvider,
  mockEmailProviderSuccess,
  buildEmailSendRequest,
  assertEmailSent,
} from '../mocks';

// Create mock provider
const mockProvider = createMockEmailProvider();

// Send email
await mockProvider.send(buildEmailSendRequest({
  recipients: [{ email: 'test@example.com' }],
  content: { subject: 'Test' }
}));

// Assert email was sent
assertEmailSent(mockProvider, {
  subject: 'Test',
  toEmail: 'test@example.com',
});
```

## Best Practices

### 1. Use Existing Fixtures First

Before creating new test data, check if suitable fixtures exist:

```typescript
// Good: Use existing fixture
const opportunity = inventoryClearanceHighPriority;

// Less ideal: Create from scratch
const opportunity = {
  id: 'opp-1',
  type: 'inventory_clearance',
  // ... many fields
};
```

### 2. Use Factory Functions for Custom Data

When you need specific properties:

```typescript
const opportunity = createTestOpportunity({
  type: OpportunityType.WINBACK_CAMPAIGN,
  state: OpportunityState.approved,
});
```

### 3. Leverage Grouped Fixtures

Access related fixtures easily:

```typescript
// All events of a specific type
const allVelocityEvents = eventsByType[EventType.velocity_spike];

// All opportunities in a state
const newOpportunities = opportunitiesByState[OpportunityState.new];
```

### 4. Use Realistic Data

All fixtures contain realistic data that mirrors production scenarios:
- Proper timestamps and date relationships
- Valid Shopify IDs and formats
- Realistic monetary values
- Meaningful product names and descriptions

### 5. Test Edge Cases

Fixtures include edge cases:
- Empty segments
- Expired opportunities
- Failed executions
- Revoked connections
- Rate limit scenarios

## Testing Patterns

### Testing Webhook Handlers

```typescript
import { orderCreatePayload, generateWebhookHeaders, TEST_SHOPIFY_SECRET } from '../fixtures';

test('processes order webhook', async () => {
  const headers = generateWebhookHeaders('orders/create', orderCreatePayload, TEST_SHOPIFY_SECRET);
  const response = await POST('/api/webhooks', {
    headers,
    body: JSON.stringify(orderCreatePayload),
  });

  expect(response.status).toBe(200);
});
```

### Testing Opportunity Creation

```typescript
import { velocitySpikeEvent1, velocitySpikeEvent2 } from '../fixtures';

test('creates opportunity from velocity spike events', async () => {
  const opportunity = await createOpportunity({
    workspace_id: 'test',
    type: OpportunityType.HIGH_VELOCITY_PROTECTION,
    event_ids: [velocitySpikeEvent1.id, velocitySpikeEvent2.id],
  });

  expect(opportunity.priority_bucket).toBe(PriorityBucket.high);
});
```

### Testing Executions

```typescript
import { discountDraftApproved, mockShopifyApiSuccess } from '../fixtures';

test('executes discount draft', async () => {
  const mockClient = mockShopifyApiSuccess();

  const execution = await executeActionDraft(discountDraftApproved.id);

  expect(execution.status).toBe(ExecutionStatus.SUCCEEDED);
  expect(mockClient.getRequestCount()).toBe(1);
});
```

## Maintenance

When adding new fixtures:

1. Add to appropriate fixture file
2. Export from fixture file
3. Add to grouped collections (byType, byState, etc.)
4. Update this README
5. Add factory function if needed
6. Include in comprehensive test suite

## File Organization

```
tests/
├── fixtures/
│   ├── shopify-webhooks.ts    # Webhook payloads + HMAC
│   ├── opportunities.ts        # All opportunity scenarios
│   ├── events.ts              # All event types
│   ├── drafts.ts              # All draft types
│   ├── executions.ts          # Success/failure scenarios
│   ├── users.ts               # Auth + workspace data
│   ├── index.ts               # Central export + factories
│   └── README.md              # This file
└── mocks/
    ├── shopify-api.ts         # Shopify API mock
    ├── email-provider.ts      # Email provider mock
    └── index.ts               # Mock exports
```
