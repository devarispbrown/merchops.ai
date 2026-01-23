# Server Actions Implementation Summary

## Overview

Complete implementation of Next.js Server Actions for MerchOps, following the requirements from CLAUDE.md. All actions include:

- ✅ "use server" directive
- ✅ Zod input validation
- ✅ Authentication checks
- ✅ Workspace authorization
- ✅ Correlation ID logging
- ✅ Typed responses
- ✅ Error handling
- ✅ Audit logging

## Implementation Statistics

- **Total Files Created**: 7
- **Total Lines of Code**: 1,944
- **Action Modules**: 5
- **Helper Modules**: 2

## File Structure

```
apps/web/
├── app/actions/
│   ├── auth.ts              (205 lines)  - Authentication actions
│   ├── shopify.ts           (262 lines)  - Shopify connection management
│   ├── opportunities.ts     (223 lines)  - Opportunity lifecycle
│   ├── drafts.ts            (365 lines)  - Action draft management
│   ├── admin.ts             (267 lines)  - Admin operations
│   ├── README.md                         - Comprehensive documentation
│   └── IMPLEMENTATION.md                 - This file
└── lib/actions/
    ├── errors.ts            (315 lines)  - Error handling system
    └── validation.ts        (307 lines)  - Input validation helpers
```

## Modules Implemented

### 1. Error Handling (`lib/actions/errors.ts`)

**Purpose**: Centralized error management with user-friendly messages

**Key Features**:
- Typed error codes organized by category (1xxx-6xxx)
- ActionError class with logging integration
- Factory functions for common errors
- Consistent response format: `{ success: boolean, data/error }`
- Automatic error sanitization and logging

**Error Categories**:
```typescript
1xxx - Authentication (UNAUTHENTICATED, UNAUTHORIZED)
2xxx - Validation (VALIDATION_ERROR, INVALID_INPUT)
3xxx - Resources (NOT_FOUND, ALREADY_EXISTS)
4xxx - Business Logic (INVALID_STATE, OPERATION_NOT_ALLOWED)
5xxx - External Services (SHOPIFY_ERROR, SHOPIFY_RATE_LIMIT)
6xxx - System (DATABASE_ERROR, INTERNAL_ERROR)
```

**Usage**:
```typescript
throw ActionErrors.unauthorized('Access denied');
return actionSuccess({ id: '123' });
return handleUnknownError(error);
```

### 2. Validation (`lib/actions/validation.ts`)

**Purpose**: Zod schema integration and input validation

**Key Features**:
- Type-safe validation with Zod
- FormData parsing and conversion
- Sensitive field sanitization
- Pre-built common schemas (email, password, UUID, shopDomain)
- Validation error formatting

**Common Schemas**:
```typescript
formDataSchemas.email       // Email validation
formDataSchemas.password    // Password rules (8+ chars)
formDataSchemas.uuid        // UUID format
formDataSchemas.shopDomain  // Shopify domain validation
```

**Usage**:
```typescript
const data = validateInput(mySchema, input);
const data = validateFormData(mySchema, formData);
const result = safeValidate(mySchema, input);
```

### 3. Authentication Actions (`app/actions/auth.ts`)

**Purpose**: User signup, signin, and signout

**Actions Implemented**:

#### `signUpAction(formData)`
- Validates email and password
- Checks for existing user
- Creates user and workspace in transaction
- Hashes password with bcrypt (12 rounds)
- Returns user ID, email, and workspace ID

**Validation**:
```typescript
{
  email: string (valid email)
  password: string (min 8 chars)
  confirmPassword: string (must match)
}
```

#### `signInAction(formData)`
- Validates credentials
- Finds user by email
- Verifies password with bcrypt
- Returns user ID and email for session creation

**Validation**:
```typescript
{
  email: string (valid email)
  password: string (required)
}
```

#### `signOutAction()`
- Logs signout event
- Returns success response

### 4. Shopify Actions (`app/actions/shopify.ts`)

**Purpose**: Shopify OAuth and data synchronization

**Actions Implemented**:

#### `initiateShopifyConnection(shop)`
- Validates Shopify domain format
- Checks for existing connections
- Generates OAuth authorization URL with CSRF state
- Returns auth URL for redirect

**Validation**:
```typescript
{
  shop: string (*.myshopify.com format)
}
```

**Security**:
- CSRF state generation with correlation ID
- Shop domain validation
- Duplicate connection prevention

#### `disconnectShopify()`
- Finds active connection
- Marks connection as revoked
- Dismisses pending opportunities
- Revalidates settings pages

**Side Effects**:
- Updates connection status to 'revoked'
- Sets revoked_at timestamp
- Cancels all new/viewed opportunities

#### `refreshShopifyData()`
- Verifies active connection exists
- Enqueues full sync job
- Returns job ID for tracking

**Queue Integration**:
```typescript
enqueueJob('shopify-sync', {
  workspaceId,
  connectionId,
  syncType: 'full'
})
```

### 5. Opportunity Actions (`app/actions/opportunities.ts`)

**Purpose**: Opportunity state management

**Actions Implemented**:

#### `dismissOpportunity(id, reason?)`
- Validates opportunity access
- Checks state (cannot dismiss executed/resolved)
- Updates state to 'dismissed'
- Logs dismissal reason for audit

**State Validation**:
- ✅ Can dismiss: new, viewed, approved
- ❌ Cannot dismiss: executed, resolved

#### `markOpportunityViewed(id)`
- Updates state from 'new' to 'viewed'
- Idempotent (safe to call multiple times)
- Used for tracking user engagement

**Optimization**:
- No-op if already viewed
- Lightweight operation for high frequency

### 6. Draft Actions (`app/actions/drafts.ts`)

**Purpose**: Action draft lifecycle management

**Actions Implemented**:

#### `createDraftAction(opportunityId)`
- Validates opportunity access and state
- Checks for existing draft (prevents duplicates)
- Delegates to server-side draft creation logic
- Uses AI to generate initial draft content
- Returns draft ID and execution type

**Integration**:
```typescript
import { createActionDraft } from '@/server/actions/drafts/create';
```

#### `updateDraftAction(id, data)`
- Validates draft access
- Verifies editable state (draft or edited)
- Delegates to server-side edit logic with field validation
- Updates state to 'edited'

**Field Validation**:
- Only editable fields can be modified
- Schema validation per execution type
- Payload integrity maintained

#### `approveDraftAction(id)`
- Validates draft access and state
- Performs final payload validation
- Creates immutable execution record
- Enqueues execution job with idempotency key
- Returns draft ID, execution ID, and job ID

**Critical Path**:
```typescript
1. Validate draft → 2. Create execution → 3. Enqueue job → 4. Revalidate pages
```

### 7. Admin Actions (`app/actions/admin.ts`)

**Purpose**: Administrative operations and diagnostics

**Actions Implemented**:

#### `replayEvents(options)`
- Filters events by date range and types
- Counts matching events
- Enqueues replay job
- Returns job ID and event count

**Options**:
```typescript
{
  workspaceId?: string    // Defaults to current
  startDate?: string      // ISO datetime
  endDate?: string        // ISO datetime
  eventTypes?: string[]   // Event type filters
}
```

**Workspace Isolation**:
- MVP: Users can only replay their own workspace
- Production: Add admin role check

#### `retryFailedJob(jobId)`
- Searches across all queues for job
- Validates workspace ownership
- Checks job is in failed state
- Retries job execution

**Queue Search**:
```typescript
const queueNames = [
  'shopify-sync',
  'opportunity-generation',
  'action-execution',
  'outcome-resolution'
];
```

## Common Patterns

### 1. Action Structure

All actions follow this consistent pattern:

```typescript
'use server';

export async function myAction(input: InputType): Promise<ActionResponse<ResultType>> {
  return runWithCorrelationAsync(
    { correlationId: generateCorrelationId() },
    async () => {
      try {
        // 1. Get workspace ID (authentication)
        const workspaceId = await getWorkspaceId();

        // 2. Validate input
        const data = validateInput(schema, input);

        // 3. Log action start
        logger.info({ workspaceId, ...data }, 'Action started');

        // 4. Verify resource access
        const resource = await prisma.resource.findUnique({ where: { id: data.id } });
        if (resource.workspace_id !== workspaceId) {
          throw ActionErrors.unauthorized();
        }

        // 5. Perform business logic
        const result = await performOperation(data);

        // 6. Log success
        logger.info({ workspaceId, result }, 'Action completed');

        // 7. Revalidate pages
        revalidatePath('/relevant-path');

        // 8. Return success
        return actionSuccess(result);
      } catch (error) {
        return handleUnknownError(error);
      }
    }
  );
}
```

### 2. Workspace Isolation

Every action verifies workspace access:

```typescript
// Get workspace from session
const workspaceId = await getWorkspaceId();

// Verify resource belongs to workspace
if (resource.workspace_id !== workspaceId) {
  throw ActionErrors.unauthorized('Access denied');
}
```

### 3. Correlation Tracking

All actions run within correlation context:

```typescript
import { runWithCorrelationAsync, generateCorrelationId } from '@/lib/correlation';

return runWithCorrelationAsync(
  { correlationId: generateCorrelationId() },
  async () => {
    // All logs here automatically include correlation ID
    logger.info('Processing action');
  }
);
```

### 4. Error Handling

Consistent error handling across all actions:

```typescript
try {
  // Action logic
  return actionSuccess(result);
} catch (error) {
  // Handles ActionError and unknown errors
  return handleUnknownError(error);
}
```

## Security Features

### Input Validation
- ✅ Zod schema validation on all inputs
- ✅ FormData parsing with type coercion
- ✅ Sensitive field sanitization in logs

### Authentication
- ✅ Session validation via getWorkspaceId()
- ✅ Throws on missing/invalid session
- ✅ Automatic workspace scoping

### Authorization
- ✅ Workspace ownership verification
- ✅ Resource access checks
- ✅ State transition validation

### Audit Logging
- ✅ Correlation ID on every action
- ✅ Start/end logging with timing
- ✅ Error logging with context
- ✅ User/workspace metadata

### Data Protection
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ Token encryption at rest
- ✅ No secrets in logs
- ✅ SQL injection prevention (Prisma)

## Integration Points

### Database (Prisma)
```typescript
import { prisma } from '@/server/db/client';

// All queries automatically scoped to workspace
const resource = await prisma.resource.findUnique({
  where: { id, workspace_id: workspaceId }
});
```

### Logging (Pino)
```typescript
import { logger } from '@/server/observability/logger';

// Structured logging with correlation
logger.info({ workspaceId, action: 'create' }, 'Action executed');
logger.error({ error }, 'Action failed');
```

### Job Queue (BullMQ)
```typescript
import { enqueueJob } from '@/server/jobs/queues';

// Enqueue background job with correlation
const job = await enqueueJob('shopify-sync', {
  workspaceId,
  syncType: 'full'
});
```

### Cache Invalidation
```typescript
import { revalidatePath } from 'next/cache';

// Invalidate specific routes
revalidatePath('/queue');
revalidatePath(`/drafts/${draftId}`);
```

## Testing Strategy

### Unit Tests

Test each action in isolation:

```typescript
describe('dismissOpportunity', () => {
  it('dismisses opportunity with reason', async () => {
    const result = await dismissOpportunity('opp-id', 'Not relevant');
    expect(result.success).toBe(true);
  });

  it('prevents dismissing executed opportunity', async () => {
    const result = await dismissOpportunity('executed-opp-id');
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_STATE');
  });
});
```

### Integration Tests

Test with database:

```typescript
describe('signUpAction', () => {
  it('creates user and workspace', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'securepass123');

    const result = await signUpAction(formData);

    expect(result.success).toBe(true);

    // Verify in database
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });
    expect(user).toBeDefined();
  });
});
```

### E2E Tests

Test full user flows:

```typescript
test('user can dismiss opportunity', async ({ page }) => {
  await page.goto('/queue');
  await page.click('[data-testid="dismiss-button"]');
  await page.fill('[data-testid="reason-input"]', 'Not relevant');
  await page.click('[data-testid="confirm-button"]');

  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Performance Considerations

### Action Latency
- User-facing actions: < 2s target
- Long-running operations: Background jobs
- Database queries: Indexed by workspace_id

### Optimization Techniques
- Lazy import of heavy modules
- Transaction batching where appropriate
- Selective path revalidation
- Correlation context efficiency

## Future Enhancements

### Planned Improvements
1. **Rate Limiting**: Per-user/workspace limits
2. **Caching**: Read operation caching
3. **Optimistic UI**: Client-side updates with rollback
4. **Batch Operations**: Multi-resource actions
5. **Real-time Updates**: WebSocket notifications
6. **Advanced Authorization**: Role-based access control
7. **Audit Trail UI**: Action history viewer
8. **Performance Metrics**: Action timing dashboard

### Scalability Considerations
- Redis session storage for OAuth state
- Distributed correlation context
- Queue priority management
- Database read replicas
- Action result caching

## Compliance Checklist

Based on CLAUDE.md requirements:

- ✅ "use server" directive on all actions
- ✅ Input validation with Zod
- ✅ Authentication check (getWorkspaceId)
- ✅ Workspace authorization verification
- ✅ Correlation ID logging
- ✅ Typed response format
- ✅ Error handling with user messages
- ✅ Audit logging for state changes
- ✅ Idempotency considerations
- ✅ Transaction usage where needed
- ✅ Path revalidation after mutations
- ✅ Security best practices
- ✅ Comprehensive documentation

## Maintenance

### Adding New Actions

1. Create action file in `app/actions/`
2. Define input schema with Zod
3. Implement action following standard pattern
4. Add tests (unit + integration)
5. Update README with usage examples
6. Document in IMPLEMENTATION.md

### Modifying Existing Actions

1. Review impact on dependent code
2. Update validation schemas if needed
3. Maintain backward compatibility
4. Update tests
5. Update documentation

### Debugging

Use correlation IDs to trace actions:

```bash
# Search logs for specific action
grep "correlationId:abc-123" logs.json

# View action flow
correlationId -> action -> db query -> job enqueued -> execution
```

## Support

For questions or issues:
1. Check README.md for usage examples
2. Review error codes in errors.ts
3. Check logs with correlation ID
4. Refer to CLAUDE.md for requirements

---

**Implementation Status**: ✅ Complete
**Date**: 2026-01-23
**Lines of Code**: 1,944
**Test Coverage**: Ready for implementation
**Documentation**: Complete
