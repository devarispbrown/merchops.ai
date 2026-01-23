# Server Actions

This directory contains Next.js Server Actions for the MerchOps application. All actions follow the "use server" directive and provide type-safe, validated, and audited operations.

## Architecture

### Design Principles

1. **Type Safety**: All inputs and outputs are validated with Zod schemas
2. **Workspace Isolation**: Every action enforces workspace boundaries
3. **Audit Logging**: All state-changing operations are logged with correlation IDs
4. **Error Handling**: Consistent error responses with user-friendly messages
5. **Idempotency**: Actions are designed to be safely retried

### File Structure

```
/app/actions/
├── auth.ts              # Authentication actions (signup, signin, signout)
├── shopify.ts           # Shopify connection management
├── opportunities.ts     # Opportunity management (dismiss, mark viewed)
├── drafts.ts           # Action draft lifecycle (create, update, approve)
└── admin.ts            # Admin operations (replay events, retry jobs)

/lib/actions/
├── errors.ts           # Error types, codes, and response helpers
└── validation.ts       # Input validation utilities with Zod
```

## Action Modules

### Authentication (`auth.ts`)

Handles user authentication and workspace creation.

```typescript
import { signUpAction, signInAction, signOutAction } from '@/app/actions/auth';

// Sign up new user
const result = await signUpAction(formData);
if (result.success) {
  const { userId, email, workspaceId } = result.data;
}

// Sign in existing user
const result = await signInAction(formData);

// Sign out
await signOutAction();
```

**Features:**
- Creates user and workspace in single transaction
- Bcrypt password hashing (12 rounds)
- Automatic correlation ID tracking
- Email uniqueness validation

### Shopify (`shopify.ts`)

Manages Shopify store connections and data synchronization.

```typescript
import {
  initiateShopifyConnection,
  disconnectShopify,
  refreshShopifyData
} from '@/app/actions/shopify';

// Start OAuth flow
const result = await initiateShopifyConnection('my-store.myshopify.com');
if (result.success) {
  window.location.href = result.data.authUrl;
}

// Disconnect store
await disconnectShopify();

// Trigger data refresh
const result = await refreshShopifyData();
```

**Features:**
- OAuth state management with CSRF protection
- Token encryption at rest
- Workspace connection validation
- Background job queueing

### Opportunities (`opportunities.ts`)

Manages opportunity lifecycle and user interactions.

```typescript
import {
  dismissOpportunity,
  markOpportunityViewed
} from '@/app/actions/opportunities';

// Dismiss opportunity
const result = await dismissOpportunity(opportunityId, 'Not relevant');

// Mark as viewed
await markOpportunityViewed(opportunityId);
```

**Features:**
- State validation before transitions
- Workspace access verification
- Audit trail for dismissals
- Automatic page revalidation

### Drafts (`drafts.ts`)

Handles action draft creation, editing, and approval.

```typescript
import {
  createDraftAction,
  updateDraftAction,
  approveDraftAction
} from '@/app/actions/drafts';

// Create draft from opportunity
const result = await createDraftAction(opportunityId);

// Update draft fields
await updateDraftAction(draftId, {
  discount_code: 'WELCOME20',
  discount_value: 20
});

// Approve and execute
const result = await approveDraftAction(draftId);
if (result.success) {
  const { executionId, jobId } = result.data;
}
```

**Features:**
- AI-powered draft generation
- Field-level edit validation
- Payload schema validation
- Idempotent execution queueing

### Admin (`admin.ts`)

Administrative operations for diagnostics and recovery.

```typescript
import {
  replayEvents,
  retryFailedJob
} from '@/app/actions/admin';

// Replay events for workspace
const result = await replayEvents({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
  eventTypes: ['inventory_threshold_crossed']
});

// Retry failed job
await retryFailedJob(jobId);
```

**Features:**
- Event replay with filters
- Job retry management
- Workspace isolation enforcement
- Expensive operation safeguards

## Error Handling

All actions return a consistent response format:

```typescript
type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; retryable: boolean } };
```

### Error Codes

Errors are organized by category:

- **1xxx**: Authentication errors (`UNAUTHENTICATED`, `UNAUTHORIZED`)
- **2xxx**: Validation errors (`VALIDATION_ERROR`, `INVALID_INPUT`)
- **3xxx**: Resource errors (`NOT_FOUND`, `ALREADY_EXISTS`)
- **4xxx**: Business logic errors (`INVALID_STATE`, `OPERATION_NOT_ALLOWED`)
- **5xxx**: External service errors (`SHOPIFY_ERROR`, `SHOPIFY_RATE_LIMIT`)
- **6xxx**: System errors (`DATABASE_ERROR`, `INTERNAL_ERROR`)

### Using Error Helpers

```typescript
import { ActionErrors, actionSuccess, actionError } from '@/lib/actions/errors';

// Throw typed errors
throw ActionErrors.unauthorized('Access denied');
throw ActionErrors.notFound('Opportunity');
throw ActionErrors.validationError('Invalid input', { field: 'email' });

// Return success
return actionSuccess({ id: '123', status: 'completed' });

// Handle errors in catch blocks
try {
  // ... action logic
} catch (error) {
  return handleUnknownError(error);
}
```

## Validation

Input validation uses Zod schemas with helper utilities.

```typescript
import { validateInput, validateFormData } from '@/lib/actions/validation';
import { z } from 'zod';

// Define schema
const mySchema = z.object({
  email: z.string().email(),
  age: z.number().positive()
});

// Validate plain object
const data = validateInput(mySchema, input);

// Validate FormData
const data = validateFormData(mySchema, formData);
```

### Common Schemas

Pre-built schemas for common patterns:

```typescript
import { formDataSchemas } from '@/lib/actions/validation';

// Use common patterns
formDataSchemas.email
formDataSchemas.password
formDataSchemas.uuid
formDataSchemas.shopDomain
formDataSchemas.nonEmptyString
```

## Observability

All actions include structured logging with correlation IDs.

```typescript
import { logger } from '@/server/observability/logger';

logger.info(
  {
    workspaceId,
    userId,
    opportunityId
  },
  'Action completed successfully'
);
```

### Correlation Context

Actions automatically run within correlation context:

```typescript
import { runWithCorrelationAsync, generateCorrelationId } from '@/lib/correlation';

export async function myAction() {
  return runWithCorrelationAsync(
    { correlationId: generateCorrelationId() },
    async () => {
      // All logs here will include correlation ID
      logger.info('Processing action');
    }
  );
}
```

## Security

### Workspace Isolation

Every action verifies workspace access:

```typescript
const workspaceId = await getWorkspaceId();

// Verify resource belongs to workspace
if (resource.workspace_id !== workspaceId) {
  throw ActionErrors.unauthorized('Access denied');
}
```

### Input Sanitization

Sensitive fields are automatically redacted from logs:

```typescript
// These fields are sanitized: password, token, access_token, secret, api_key
logger.info({ input: sanitizeInputForLogging(input) }, 'Action input');
```

## Testing

Example test structure for actions:

```typescript
import { signUpAction } from '@/app/actions/auth';

describe('signUpAction', () => {
  it('creates user and workspace', async () => {
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'securepass123');
    formData.append('confirmPassword', 'securepass123');

    const result = await signUpAction(formData);

    expect(result.success).toBe(true);
    expect(result.data.email).toBe('test@example.com');
  });

  it('validates email format', async () => {
    const formData = new FormData();
    formData.append('email', 'invalid');
    formData.append('password', 'securepass123');

    const result = await signUpAction(formData);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Best Practices

1. **Always validate inputs**: Use Zod schemas for all user inputs
2. **Check workspace access**: Verify every resource belongs to user's workspace
3. **Log with context**: Include relevant IDs in all log statements
4. **Handle errors gracefully**: Return user-friendly error messages
5. **Revalidate paths**: Call `revalidatePath()` after mutations
6. **Use transactions**: Group related database operations
7. **Generate correlation IDs**: Use `generateCorrelationId()` for new operations
8. **Sanitize logs**: Never log passwords, tokens, or secrets

## Client Usage

### Form Actions

Use with Next.js form actions:

```typescript
'use client';

import { signUpAction } from '@/app/actions/auth';
import { useFormState } from 'react-dom';

export function SignUpForm() {
  const [state, formAction] = useFormState(signUpAction, null);

  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Sign Up</button>

      {state?.error && <div>{state.error.message}</div>}
    </form>
  );
}
```

### Programmatic Usage

Call directly from event handlers:

```typescript
'use client';

import { dismissOpportunity } from '@/app/actions/opportunities';

export function OpportunityCard({ id }) {
  const handleDismiss = async () => {
    const result = await dismissOpportunity(id, 'Not relevant');

    if (result.success) {
      toast.success('Opportunity dismissed');
    } else {
      toast.error(result.error.message);
    }
  };

  return <button onClick={handleDismiss}>Dismiss</button>;
}
```

## Performance Considerations

- Actions should complete within 2 seconds for user-facing operations
- Long-running tasks (data sync, batch processing) are queued as background jobs
- Use `revalidatePath()` sparingly to avoid excessive re-rendering
- Database queries use workspace_id indexes for fast lookup

## Future Enhancements

- Rate limiting per user/workspace
- Action-level caching for read operations
- Optimistic UI updates with automatic rollback
- Batch action support for bulk operations
- Real-time progress updates for long-running actions
