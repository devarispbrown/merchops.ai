# MerchOps Frontend Component Reference

## Quick Reference Guide

### 🎯 Loading States

```tsx
import {
  LoadingSpinner,
  Skeleton,
  SkeletonCard,
  LoadingList,
  LoadingPage,
  LoadingInline
} from '@/components/ui/Loading';

// Usage examples
<LoadingPage />                    // Full page loading
<LoadingList count={3} />          // List skeleton (3 cards)
<LoadingSpinner size="lg" />       // Spinner (sm, md, lg)
<Skeleton className="h-6 w-3/4" /> // Custom skeleton
<SkeletonCard />                   // Pre-built card skeleton
<LoadingInline />                  // For buttons
```

### ⚠️ Error Handling

```tsx
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { ApiError, InlineError } from '@/components/errors/ApiError';
import { NotFound } from '@/components/errors/NotFound';

// Error boundary wrapper
<ErrorBoundary>
  <App />
</ErrorBoundary>

// API error display
<ApiError 
  error={{
    message: 'Failed to load',
    code: 'NETWORK_ERROR',
    statusCode: 500,
    retryable: true
  }}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>

// Inline form error
<InlineError message="Invalid email" />

// 404 component
<NotFound 
  title="Resource not found"
  message="Custom message"
  showHomeLink={true}
  showBackLink={true}
/>
```

### 🛠️ Admin Components

```tsx
import { HealthStatus } from '@/components/admin/HealthStatus';
import { JobQueueSummary } from '@/components/admin/JobQueueSummary';
import { RecentErrors } from '@/components/admin/RecentErrors';

// Health monitoring
<HealthStatus health={{
  overall: 'healthy',
  database: {
    status: 'healthy',
    latency: 15,
    lastChecked: new Date(),
    message: 'All systems operational'
  },
  redis: {
    status: 'healthy',
    latency: 8,
    lastChecked: new Date()
  }
}} />

// Queue monitoring
<JobQueueSummary queues={[
  {
    name: 'event-processing',
    waiting: 5,
    active: 2,
    completed: 150,
    failed: 1,
    paused: false,
    processingRate: 10.5
  }
]} />

// Error tracking
<RecentErrors 
  errors={[
    {
      id: '1',
      timestamp: new Date(),
      level: 'error',
      message: 'Database connection failed',
      code: 'DB_CONN_ERROR',
      context: {
        workspaceId: 'ws_123',
        path: '/api/opportunities'
      },
      stack: 'Error: ...'
    }
  ]}
  maxDisplay={10}
  onViewFullLogs={() => console.log('View logs')}
/>
```

## Component Inventory

### UI Components (`/components/ui/`)
- ✅ `Badge.tsx` - Status badges with variants
- ✅ `Button.tsx` - Primary/secondary/danger/ghost buttons
- ✅ `Card.tsx` - Container cards
- ✅ `Checkbox.tsx` - Form checkboxes
- ✅ `Input.tsx` - Form inputs
- ✅ `Loading.tsx` - **NEW** All loading states
- ✅ `Modal.tsx` - Dialog modals

### Error Components (`/components/errors/`)
- ✅ `ErrorBoundary.tsx` - **NEW** React error boundary
- ✅ `ApiError.tsx` - **NEW** API error display
- ✅ `NotFound.tsx` - **NEW** 404 component

### Admin Components (`/components/admin/`)
- ✅ `HealthStatus.tsx` - **NEW** System health monitor
- ✅ `JobQueueSummary.tsx` - **NEW** Queue statistics
- ✅ `RecentErrors.tsx` - **NEW** Error log display

### Opportunity Components (`/components/opportunities/`)
- ✅ `OpportunityCard.tsx` - Opportunity list item
- ✅ `OpportunityDetail.tsx` - Opportunity detail view
- ✅ `ApprovalButton.tsx` - Approval action button
- ✅ `EventsList.tsx` - Related events display

### Draft Components (`/components/drafts/`)
- ✅ `DraftEditor.tsx` - Edit draft fields
- ✅ `PayloadPreview.tsx` - Preview execution payload
- ✅ `ApprovalModal.tsx` - Approval confirmation

### Execution Components (`/components/executions/`)
- ✅ `ExecutionStatus.tsx` - Status display
- ✅ `ExecutionList.tsx` - Execution history list
- ✅ `ExecutionDetail.tsx` - Execution detail view
- ✅ `ExecutionFilters.tsx` - Filter controls

### Learning Components (`/components/learning/`)
- ✅ `ConfidenceIndicator.tsx` - Confidence display
- ✅ `OutcomeDisplay.tsx` - Outcome visualization

### History Components (`/components/history/`)
- ✅ `OutcomeCard.tsx` - Outcome card display
- ✅ `TrackRecord.tsx` - Performance track record

### Shopify Components (`/components/shopify/`)
- ✅ `ConnectForm.tsx` - OAuth connection flow
- ✅ `ConnectionStatus.tsx` - Connection status display
- ✅ `DisconnectModal.tsx` - Disconnect confirmation

### Layout Components (`/components/layout/`)
- ✅ `Header.tsx` - App header
- ✅ `Sidebar.tsx` - Navigation sidebar

### Provider Components (`/components/providers/`)
- ✅ `AuthProvider.tsx` - Auth context provider
- ✅ `QueryProvider.tsx` - React Query provider

### Empty State Components (`/components/empty-states/`)
- ✅ `NoOpportunities.tsx` - Empty opportunities state
- ✅ `NoShopifyConnection.tsx` - No connection state

## Pages Structure

### Root Pages
- ✅ `/app/page.tsx` - Landing page
- ✅ `/app/error.tsx` - **NEW** Global error page
- ✅ `/app/not-found.tsx` - **NEW** Global 404 page
- ✅ `/app/layout.tsx` - Root layout
- ✅ `/app/providers.tsx` - Client providers

### Auth Pages (`/app/(auth)/`)
- ✅ `/login/page.tsx` - Login page
- ✅ `/signup/page.tsx` - Signup page

### Dashboard Pages (`/app/(dashboard)/`)
- ✅ `/page.tsx` - Dashboard home (redirects to queue)
- ✅ `/queue/page.tsx` - Opportunities queue
- ✅ `/queue/[id]/page.tsx` - Opportunity detail
- ✅ `/history/page.tsx` - Execution history
- ✅ `/history/[id]/page.tsx` - Execution detail
- ✅ `/drafts/[id]/page.tsx` - Draft editor
- ✅ `/settings/page.tsx` - Settings
- ✅ `/settings/shopify/page.tsx` - Shopify settings
- ✅ `/connect/page.tsx` - Initial Shopify connection
- ✅ `/admin/page.tsx` - **NEW** Admin dashboard

## API Routes

### Admin Endpoints (`/app/api/admin/`)
- ✅ `/health/route.ts` - Health check endpoint
- ✅ `/jobs/route.ts` - Job queue statistics
- ✅ `/events/route.ts` - System events log

### Auth Endpoints (`/app/api/auth/`)
- ✅ `/[...nextauth]/route.ts` - NextAuth handler
- ✅ `/signup/route.ts` - User registration

### Resource Endpoints
- ✅ `/opportunities/route.ts` - List opportunities
- ✅ `/opportunities/[id]/route.ts` - Single opportunity
- ✅ `/drafts/route.ts` - List drafts
- ✅ `/drafts/[id]/route.ts` - Single draft
- ✅ `/executions/route.ts` - List executions
- ✅ `/executions/[id]/route.ts` - Single execution
- ✅ `/outcomes/[executionId]/route.ts` - Execution outcome
- ✅ `/confidence/route.ts` - Confidence scores

### Shopify Endpoints (`/app/api/shopify/`)
- ✅ `/auth/route.ts` - OAuth initiation
- ✅ `/callback/route.ts` - OAuth callback
- ✅ `/revoke/route.ts` - Revoke connection
- ✅ `/webhooks/route.ts` - Webhook receiver

## Error Code Reference

### Common Error Codes
- `UNAUTHORIZED` - Session expired, sign in required
- `FORBIDDEN` - Permission denied
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT` - Too many requests
- `NETWORK_ERROR` - Connection issue
- `5xx` - Server error

### Error Response Format
```typescript
{
  message: string;
  code?: string;
  statusCode?: number;
  retryable?: boolean;
}
```

## Health Status Reference

### Status Types
- `healthy` - Operating normally
- `degraded` - Partial functionality
- `down` - Service unavailable

### Health Check Response
```typescript
{
  overall: 'healthy' | 'degraded' | 'down';
  database: {
    status: 'healthy' | 'degraded' | 'down';
    latency?: number;
    message?: string;
    lastChecked: Date;
  };
  redis: { /* same structure */ };
  shopify?: { /* same structure */ };
}
```

## Queue Statistics Reference

### Queue Stats Format
```typescript
{
  name: string;
  waiting: number;      // Jobs in queue
  active: number;       // Currently processing
  completed: number;    // Successfully completed
  failed: number;       // Failed jobs
  paused: boolean;      // Queue paused
  processingRate?: number; // Jobs per minute
}
```

## Styling Reference

### Color Classes
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `text-success` - Success state (green)
- `text-error` - Error state (red)
- `text-warning` - Warning state (yellow)
- `text-primary` - Primary brand color

### Background Classes
- `bg-background` - Page background
- `bg-card` - Card background
- `bg-muted` - Muted background
- `bg-success` / `bg-error` / `bg-warning` - Status backgrounds

### Border Classes
- `border-border` - Default border
- `border-success` / `border-error` / `border-warning` - Status borders

### Layout Classes
- `space-y-4` / `space-y-6` - Vertical spacing
- `gap-2` / `gap-3` / `gap-4` - Flexbox gaps
- `p-4` / `p-6` - Padding
- `rounded-lg` / `rounded-md` - Border radius
- `transition-calm` - Smooth transitions

## TypeScript Interfaces

### Common Props
```typescript
// Loading components
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

// Badge variants
type BadgeVariant = 
  | 'high' | 'medium' | 'low'
  | 'success' | 'error' | 'warning'
  | 'secondary';

// Button variants
type ButtonVariant = 
  | 'primary' | 'secondary'
  | 'danger' | 'ghost';

// Priority levels
type PriorityBucket = 'high' | 'medium' | 'low';

// Status types
type Status = 'success' | 'pending' | 'failed';
type Outcome = 'helped' | 'neutral' | 'hurt';
```

## Integration Checklist

### To Use Loading Components
1. Import from `@/components/ui/Loading`
2. Add conditional rendering based on loading state
3. Use appropriate variant (page, list, spinner)
4. Ensure ARIA labels for accessibility

### To Use Error Components
1. Wrap app with ErrorBoundary in layout
2. Import ApiError for API error states
3. Handle retryable errors with onRetry
4. Use InlineError for form validation

### To Use Admin Components
1. Create API endpoints for data
2. Fetch data with proper error handling
3. Add auto-refresh with useEffect
4. Display components with parsed data

## Testing Approach

### Unit Tests
```typescript
// Test loading components render
it('renders LoadingSpinner', () => {
  render(<LoadingSpinner size="md" />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

// Test error boundary catches errors
it('catches errors and displays fallback', () => {
  const ThrowError = () => { throw new Error('Test'); };
  render(<ErrorBoundary><ThrowError /></ErrorBoundary>);
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

### Integration Tests
```typescript
// Test admin dashboard loads data
it('fetches and displays health status', async () => {
  render(<AdminPage />);
  await waitFor(() => {
    expect(screen.getByText(/system health/i)).toBeInTheDocument();
  });
});
```

## Performance Optimization

### Loading States
- Use skeleton loaders to prevent layout shift
- Show immediate feedback with spinners
- Lazy load heavy components
- Prefetch critical data

### Error Handling
- Catch errors at boundary level
- Report to Sentry asynchronously
- Provide clear recovery actions
- Log errors for debugging

### Admin Dashboard
- Auto-refresh at reasonable intervals (30s)
- Cache health check results
- Debounce rapid refreshes
- Use optimistic updates

## Accessibility Features

### ARIA Labels
- Loading spinners have `role="status"`
- Error messages have appropriate roles
- Interactive elements have clear labels
- Focus management in modals

### Keyboard Navigation
- All interactive elements focusable
- Escape key closes modals
- Tab order logical
- Enter key activates buttons

### Screen Readers
- Semantic HTML structure
- Alternative text for icons
- Status announcements
- Clear hierarchy

## Summary

✅ **10 new components** created (Loading, Error Boundary, API Error, NotFound, Health Status, Job Queue Summary, Recent Errors, global error/404 pages, admin page)

✅ **37 total components** in the system

✅ **Calm design** - No panic-inducing messages

✅ **Accessible** - ARIA labels, semantic HTML

✅ **Type-safe** - Full TypeScript support

✅ **Reusable** - Consistent patterns throughout

✅ **Production-ready** - Error handling, loading states, monitoring
