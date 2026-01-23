# MerchOps API Client Layer

Type-safe API client for the MerchOps frontend application. Provides a consistent interface for all backend API calls with built-in error handling, correlation ID injection, and request/response processing.

## Architecture

```
lib/api/
├── client.ts              # Base fetch wrapper with error handling
├── types.ts               # Shared TypeScript types
├── opportunities.ts       # Opportunities API endpoints
├── drafts.ts             # Action drafts API endpoints
├── executions.ts         # Executions API endpoints
├── outcomes.ts           # Outcomes API endpoints
├── shopify.ts            # Shopify connection API endpoints
├── confidence.ts         # Confidence scoring API endpoints
└── index.ts              # Module exports
```

## Core Features

### 1. Base Client (`client.ts`)

The base client provides:

- **Automatic JSON parsing** with error handling
- **Correlation ID injection** for distributed tracing
- **Timeout handling** with configurable timeouts
- **Error taxonomy** with structured error codes
- **HTTP method helpers** (GET, POST, PUT, PATCH, DELETE)
- **Query string builder** with automatic filtering

```typescript
import { get, post, patch, del, buildQueryString } from '@/lib/api/client';

// Simple GET request
const data = await get('/opportunities');

// POST with body
const newDraft = await post('/drafts', { opportunity_id: '123' });

// Query string building
const queryString = buildQueryString({ page: 1, limit: 20 });
```

### 2. Error Handling

All API errors are wrapped in `ApiClientError` with consistent structure:

```typescript
interface ApiError {
  code: string;              // Error code (e.g., 'TIMEOUT', 'NETWORK_ERROR')
  message: string;           // Human-readable message
  statusCode: number;        // HTTP status code
  details?: Record<string, any>;  // Additional error context
}
```

Common error codes:
- `TIMEOUT` - Request timeout
- `NETWORK_ERROR` - Network connectivity issues
- `PARSE_ERROR` - JSON parsing failed
- `UNKNOWN_ERROR` - Unhandled error

### 3. Correlation IDs

Every request automatically includes a correlation ID in the `X-Correlation-ID` header for end-to-end tracing across:
- Frontend requests
- Backend API handlers
- Background jobs
- Database queries
- External service calls

This enables reconstructing the full flow of any user action for debugging.

### 4. Type Safety

All API functions are fully typed with TypeScript:

```typescript
// Types are imported from shared types
import type {
  OpportunityListParams,
  OpportunityResponse,
  PaginatedResponse
} from '@/lib/api/types';

// Function signatures enforce type safety
async function listOpportunities(
  params?: OpportunityListParams
): Promise<PaginatedResponse<OpportunityResponse>>
```

## API Modules

### Opportunities (`opportunities.ts`)

Manage opportunities with filtering, pagination, and state transitions.

```typescript
import { listOpportunities, getOpportunity, dismissOpportunity, viewOpportunity } from '@/lib/api';

// List with filters
const opportunities = await listOpportunities({
  filters: {
    state: ['new', 'viewed'],
    priority_bucket: ['high', 'medium']
  },
  page: 1,
  limit: 20
});

// Get single opportunity
const opportunity = await getOpportunity('opp_123');

// Dismiss opportunity
await dismissOpportunity('opp_123');

// Mark as viewed
await viewOpportunity('opp_123');
```

### Drafts (`drafts.ts`)

Create, update, and approve action drafts.

```typescript
import { listDrafts, getDraft, createDraft, updateDraft, approveDraft } from '@/lib/api';

// Create draft from opportunity
const draft = await createDraft({ opportunity_id: 'opp_123' });

// Update editable fields
const updated = await updateDraft('draft_123', {
  payload: { title: 'Updated title', value: 15 }
});

// Approve for execution
const approved = await approveDraft('draft_123', { confirmation: true });
```

### Executions (`executions.ts`)

Track execution history and status.

```typescript
import { listExecutions, getExecution } from '@/lib/api';

// List with filters
const executions = await listExecutions({
  filters: { status: ['succeeded', 'failed'] },
  sort_by: 'started_at',
  sort_order: 'desc'
});

// Get single execution
const execution = await getExecution('exec_123');
```

### Outcomes (`outcomes.ts`)

Access learning loop outcomes.

```typescript
import { listOutcomes, getOutcome } from '@/lib/api';

// Get outcome for execution
const outcome = await getOutcome('exec_123');
```

### Shopify (`shopify.ts`)

Manage Shopify store connection.

```typescript
import { getConnectionStatus, initiateConnection, disconnect } from '@/lib/api';

// Check connection status
const status = await getConnectionStatus();

// Start OAuth flow
const { authorization_url } = await initiateConnection({ shop: 'mystore.myshopify.com' });

// Disconnect store
await disconnect();
```

### Confidence (`confidence.ts`)

Access confidence scoring and learning insights.

```typescript
import { getConfidenceScores } from '@/lib/api';

// Get all confidence scores
const scores = await getConfidenceScores();
```

## Usage with React Query

The API client is designed to work seamlessly with TanStack Query hooks. See `lib/hooks/` for pre-built hooks.

```typescript
import { useQuery } from '@tanstack/react-query';
import { listOpportunities } from '@/lib/api';

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunities', { page: 1 }],
    queryFn: () => listOpportunities({ page: 1 })
  });
}
```

## Configuration

### API Base URL

Set via environment variable:

```bash
NEXT_PUBLIC_API_URL=/api  # Default
```

### Timeouts

Default timeout is 30 seconds. Override per request:

```typescript
const data = await get('/opportunities', { timeout: 60000 }); // 60 seconds
```

## Best Practices

1. **Always use the API client** instead of raw `fetch()` calls
2. **Use TypeScript types** from `types.ts` for type safety
3. **Handle errors gracefully** with try/catch blocks
4. **Use correlation IDs** by not setting `skipCorrelation: true`
5. **Leverage React Query hooks** instead of calling API methods directly

## Error Handling Example

```typescript
import { ApiClientError } from '@/lib/api/types';
import { getOpportunity } from '@/lib/api';

try {
  const opportunity = await getOpportunity('opp_123');
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error('API Error:', error.code, error.message);
    console.error('Status:', error.statusCode);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Testing

For testing, you can mock the API client functions:

```typescript
import * as api from '@/lib/api';

jest.spyOn(api, 'listOpportunities').mockResolvedValue({
  data: [],
  pagination: { page: 1, limit: 20, total: 0, hasMore: false }
});
```

## Integration with Backend

The API client expects backend endpoints to follow these conventions:

1. **Success responses**: JSON body with appropriate status code (200, 201, etc.)
2. **Error responses**: JSON body with `{ code, message, details? }` structure
3. **Correlation ID**: Backend should read and propagate `X-Correlation-ID` header
4. **Idempotency**: Backend should handle duplicate requests safely

## Related Documentation

- [Hooks Documentation](../hooks/README.md) - React Query hooks built on this client
- [QueryProvider](../../components/providers/QueryProvider.tsx) - TanStack Query configuration
- [Correlation IDs](../correlation.ts) - Distributed tracing implementation
