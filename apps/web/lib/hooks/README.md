# MerchOps React Query Hooks

Type-safe React Query hooks for seamless data fetching, caching, and state management in the MerchOps frontend.

## Architecture

```
lib/hooks/
├── useOpportunities.ts       # Opportunities query & mutation hooks
├── useDrafts.ts             # Drafts query & mutation hooks
├── useExecutions.ts         # Executions query hooks
├── useOutcomes.ts           # Outcomes query hooks
├── useShopifyConnection.ts  # Shopify connection hooks
├── useConfidence.ts         # Confidence scoring hooks
└── index.ts                 # Module exports
```

## Core Concepts

### Query Keys

Each hook module exports standardized query keys for cache management:

```typescript
// Hierarchical key structure
opportunityKeys = {
  all: ['opportunities'],
  lists: () => ['opportunities', 'list'],
  list: (params) => ['opportunities', 'list', params],
  details: () => ['opportunities', 'detail'],
  detail: (id) => ['opportunities', 'detail', id]
}
```

Benefits:
- **Consistent cache invalidation** across related queries
- **Predictable cache keys** for debugging
- **Type-safe key generation** with TypeScript

### Optimistic Updates

Mutation hooks implement optimistic updates where safe:

1. **Cancel outgoing refetches** to prevent race conditions
2. **Snapshot previous state** for rollback
3. **Optimistically update cache** with expected result
4. **Rollback on error** using snapshot
5. **Update with server response** on success

## Hooks Reference

### Opportunities

#### `useOpportunitiesList(params?, options?)`

Fetch paginated list of opportunities with optional filters.

```typescript
import { useOpportunitiesList } from '@/lib/hooks';

function OpportunitiesPage() {
  const { data, isLoading, error } = useOpportunitiesList({
    filters: {
      state: ['new', 'viewed'],
      priority_bucket: ['high']
    },
    page: 1,
    limit: 20
  });

  if (isLoading) return <Loading />;
  if (error) return <Error />;

  return (
    <div>
      {data.data.map(opp => (
        <OpportunityCard key={opp.id} opportunity={opp} />
      ))}
    </div>
  );
}
```

**Parameters:**
- `params` - Filters, pagination, and sorting options
- `options` - Additional React Query options

**Returns:** `UseQueryResult<PaginatedResponse<OpportunityResponse>>`

#### `useOpportunity(id, options?)`

Fetch single opportunity with full details.

```typescript
const { data: opportunity } = useOpportunity('opp_123');
```

#### `useDismissOpportunity()`

Dismiss an opportunity (optimistic update).

```typescript
const dismissMutation = useDismissOpportunity();

const handleDismiss = (id: string) => {
  dismissMutation.mutate(id, {
    onSuccess: () => toast.success('Opportunity dismissed'),
    onError: () => toast.error('Failed to dismiss')
  });
};
```

#### `useViewOpportunity()`

Mark opportunity as viewed (optimistic update).

```typescript
const viewMutation = useViewOpportunity();

useEffect(() => {
  viewMutation.mutate(opportunityId);
}, [opportunityId]);
```

### Drafts

#### `useDraftsList(params?, options?)`

Fetch paginated list of action drafts.

```typescript
const { data: drafts } = useDraftsList({
  filters: { state: ['draft', 'edited'] }
});
```

#### `useDraft(id, options?)`

Fetch single draft with full details.

```typescript
const { data: draft } = useDraft('draft_123');
```

#### `useCreateDraft()`

Create new draft from opportunity.

```typescript
const createMutation = useCreateDraft();

const handleCreateDraft = () => {
  createMutation.mutate(
    { opportunity_id: 'opp_123' },
    {
      onSuccess: (newDraft) => {
        router.push(`/drafts/${newDraft.id}`);
      }
    }
  );
};
```

#### `useUpdateDraft()`

Update draft editable fields (optimistic update).

```typescript
const updateMutation = useUpdateDraft();

const handleSave = (updates: Partial<DraftPayload>) => {
  updateMutation.mutate({
    id: draftId,
    data: { payload: updates }
  });
};
```

**Features:**
- Optimistic UI updates for instant feedback
- Automatic rollback on error
- Cache invalidation on success

#### `useApproveDraft()`

Approve draft for execution.

```typescript
const approveMutation = useApproveDraft();

const handleApprove = () => {
  approveMutation.mutate(
    { id: draftId, data: { confirmation: true } },
    {
      onSuccess: () => {
        toast.success('Draft approved for execution');
        router.push('/executions');
      }
    }
  );
};
```

### Executions

#### `useExecutionsList(params?, options?)`

Fetch paginated list of executions.

```typescript
const { data: executions } = useExecutionsList({
  filters: { status: ['succeeded', 'failed'] },
  sort_by: 'started_at',
  sort_order: 'desc'
});
```

**Auto-refetch:** Polls every 60 seconds to catch status changes.

#### `useExecution(id, options?)`

Fetch single execution with full details.

```typescript
const { data: execution } = useExecution('exec_123');
```

**Smart refetch:** Automatically refetches every 5 seconds for pending/running executions.

### Outcomes

#### `useOutcomesList(options?)`

Fetch all outcomes.

```typescript
const { data: outcomes } = useOutcomesList();
```

#### `useOutcome(executionId, options?)`

Fetch outcome for specific execution.

```typescript
const { data: outcome } = useOutcome('exec_123');
```

### Shopify Connection

#### `useShopifyConnection(options?)`

Fetch Shopify connection status.

```typescript
const { data: connection, isLoading } = useShopifyConnection();

if (!connection) {
  return <ConnectShopifyPrompt />;
}
```

**Auto-refetch:** Checks connection status on mount and every 30 seconds.

#### `useInitiateConnection()`

Start Shopify OAuth flow.

```typescript
const initiateMutation = useInitiateConnection();

const handleConnect = () => {
  initiateMutation.mutate(
    { shop: 'mystore.myshopify.com' }
    // Automatically redirects to Shopify OAuth on success
  );
};
```

#### `useDisconnect()`

Disconnect Shopify store.

```typescript
const disconnectMutation = useDisconnect();

const handleDisconnect = () => {
  if (confirm('Are you sure?')) {
    disconnectMutation.mutate();
  }
};
```

**Side effects:** Invalidates all related queries (opportunities, drafts, executions).

### Confidence

#### `useConfidenceScores(options?)`

Fetch confidence scores for all operator intents.

```typescript
const { data: confidence } = useConfidenceScores();

return (
  <div>
    Overall Confidence: {confidence.overall_confidence}%
    {confidence.scores.map(score => (
      <ConfidenceIndicator key={score.operator_intent} score={score} />
    ))}
  </div>
);
```

**Cache:** Stale time of 10 minutes (confidence changes slowly).

## Advanced Patterns

### Dependent Queries

Fetch data that depends on previous query results:

```typescript
const { data: opportunity } = useOpportunity(opportunityId);

const { data: drafts } = useDraftsList(
  { filters: { opportunity_id: opportunityId } },
  { enabled: !!opportunity } // Only fetch when opportunity loads
);
```

### Parallel Queries

Fetch multiple independent queries simultaneously:

```typescript
function Dashboard() {
  const opportunities = useOpportunitiesList({ filters: { state: ['new'] } });
  const drafts = useDraftsList({ filters: { state: ['draft'] } });
  const executions = useExecutionsList({ filters: { status: ['running'] } });

  // All queries run in parallel
}
```

### Infinite Queries

For pagination with "load more" pattern:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { listOpportunities } from '@/lib/api';

const {
  data,
  fetchNextPage,
  hasNextPage
} = useInfiniteQuery({
  queryKey: opportunityKeys.lists(),
  queryFn: ({ pageParam = 1 }) => listOpportunities({ page: pageParam }),
  getNextPageParam: (lastPage) =>
    lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined
});
```

### Manual Cache Updates

Update cache without refetching:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { opportunityKeys } from '@/lib/hooks';

const queryClient = useQueryClient();

// Update single item in cache
queryClient.setQueryData(
  opportunityKeys.detail('opp_123'),
  (old) => ({ ...old, state: 'viewed' })
);

// Invalidate and refetch
queryClient.invalidateQueries({
  queryKey: opportunityKeys.lists()
});
```

## Testing

### Mock Hooks in Tests

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOpportunitiesList } from '@/lib/hooks';
import * as api from '@/lib/api';

jest.spyOn(api, 'listOpportunities').mockResolvedValue({
  data: [{ id: 'opp_1', /* ... */ }],
  pagination: { page: 1, limit: 20, total: 1, hasMore: false }
});

test('useOpportunitiesList', async () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useOpportunitiesList(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data.data).toHaveLength(1);
});
```

## Performance Tips

1. **Use enabled option** to prevent unnecessary fetches
2. **Set appropriate staleTime** based on data volatility
3. **Leverage optimistic updates** for instant UI feedback
4. **Use suspense mode** for React 18+ concurrent features
5. **Implement pagination** instead of fetching all data

## Error Handling

All hooks return error information:

```typescript
const { data, error, isError } = useOpportunitiesList();

if (isError) {
  return <ErrorMessage error={error} />;
}
```

Global error handling in QueryClient:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        if (error instanceof ApiClientError) {
          toast.error(error.message);
        }
      }
    }
  }
});
```

## DevTools

In development, React Query DevTools are automatically available:

1. Open your app in browser
2. Look for floating React Query icon (bottom-left)
3. Click to open DevTools panel
4. Inspect queries, mutations, and cache state

## Related Documentation

- [API Client](../api/README.md) - Underlying API client
- [QueryProvider](../../components/providers/QueryProvider.tsx) - Query client configuration
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/react/overview) - Official documentation
