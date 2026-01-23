# Frontend Admin & Error Components - Implementation Summary

## Overview
All requested UI components for admin dashboard and error states have been successfully created for MerchOps. The implementation follows calm design principles with no panic-inducing messages.

## Created Components

### 1. Loading Components
**Location**: `/apps/web/components/ui/Loading.tsx`

Components:
- `LoadingSpinner` - Animated spinner with size variants (sm, md, lg)
- `Skeleton` - Skeleton loaders for text, circular, and rectangular shapes
- `SkeletonCard` - Pre-built skeleton for card layouts
- `LoadingList` - List of skeleton cards with configurable count
- `LoadingPage` - Full page loading state
- `LoadingInline` - Inline loading for buttons

Features:
- ARIA labels for accessibility
- Size variants
- Smooth animations
- Reusable patterns

### 2. Error Boundary Component
**Location**: `/apps/web/components/errors/ErrorBoundary.tsx`

Features:
- React error boundary with class component
- Catches and displays runtime errors
- Automatic Sentry reporting integration
- Custom fallback UI support
- Development mode error details
- Calm error messaging
- Recovery options (try again, reload)
- Error ID display for support

### 3. API Error Component
**Location**: `/apps/web/components/errors/ApiError.tsx`

Components:
- `ApiError` - Display API errors with actionable guidance
- `InlineError` - Small inline error for form fields

Features:
- User-friendly error messages based on error codes
- Actionable guidance for recovery
- Retry button (when retryable)
- Error code display in development
- Calm, non-alarming design
- Support for common error types:
  - UNAUTHORIZED
  - FORBIDDEN
  - NOT_FOUND
  - RATE_LIMIT
  - NETWORK_ERROR
  - 5xx server errors

### 4. Not Found Component
**Location**: `/apps/web/components/errors/NotFound.tsx`

Features:
- Reusable 404 component
- Navigation help with common destinations
- Customizable title and message
- Links to main sections
- Calm design with circular indicator
- Back button support

### 5. Global Error Page
**Location**: `/apps/web/app/error.tsx`

Features:
- Next.js error page for unhandled errors
- Automatic Sentry reporting
- Development mode stack traces
- Recovery options (try again, reload, go home)
- Error digest for support tracking
- Calm, reassuring design
- Clear messaging that data is safe

### 6. Global Not Found Page
**Location**: `/apps/web/app/not-found.tsx`

Features:
- Next.js 404 page
- Large, calm 404 indicator
- Navigation to common destinations
- Primary CTAs for queue and home
- Quick links to all main sections
- Consistent with brand design

### 7. Health Status Component
**Location**: `/apps/web/components/admin/HealthStatus.tsx`

Features:
- Overall system health display
- Individual service status (Database, Redis, Shopify)
- Status indicators (healthy, degraded, down)
- Real-time status badges with colors
- Latency metrics display
- Last checked timestamps
- Service messages for context
- Animated pulse for healthy services

### 8. Job Queue Summary Component
**Location**: `/apps/web/components/admin/JobQueueSummary.tsx`

Features:
- Overall queue statistics
- Individual queue details
- Status badges (Active, Idle, Paused, Issues)
- Metrics: waiting, active, completed, failed
- Processing rate display (jobs/min or jobs/hr)
- Critical issue alerts
- High failure rate warnings
- Paused queue notices
- Real-time updates

### 9. Recent Errors Component
**Location**: `/apps/web/components/admin/RecentErrors.tsx`

Features:
- List of recent system errors
- Expandable error details
- Stack trace display (on demand)
- Error level badges (error, warning)
- Error codes display
- Context information (workspace, user, path)
- Relative timestamps
- Empty state for no errors
- Configurable max display count
- Link to full logs

### 10. Admin Dashboard Page
**Location**: `/apps/web/app/(dashboard)/admin/page.tsx`

Features:
- Complete admin overview
- Health status display
- Job queue summary
- Recent errors list
- Auto-refresh every 30 seconds
- Error handling with retry
- Loading states
- Organized layout
- Clear section headers

## Design Principles Applied

### 1. Calm Design
- No panic-inducing messages
- Reassuring language ("Your data is safe")
- Clear, simple explanations
- Appropriate use of color (not alarming red everywhere)

### 2. Accessibility
- ARIA labels on loading spinners
- Semantic HTML structure
- Proper heading hierarchy
- Keyboard navigation support
- Screen reader friendly

### 3. User Experience
- Clear recovery actions
- Helpful navigation guidance
- Contextual information
- Progressive disclosure (expandable details)
- Loading states prevent confusion
- Error states show actionable next steps

### 4. Development Experience
- Reusable components
- TypeScript interfaces for type safety
- Proper prop validation
- Development mode error details
- Clean component structure

## Component Patterns

### Error Handling Pattern
```tsx
// Global error boundary wrapping app
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>

// API error display
<ApiError 
  error={error} 
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>

// Inline form errors
<InlineError message="Invalid email address" />
```

### Loading Pattern
```tsx
// Page loading
{loading && <LoadingPage />}

// List loading
{loading && <LoadingList count={5} />}

// Button loading
<Button disabled={loading}>
  {loading ? <LoadingInline /> : 'Submit'}
</Button>

// Skeleton components
<Skeleton className="h-6 w-3/4" />
<SkeletonCard />
```

### Admin Pattern
```tsx
// Health monitoring
<HealthStatus health={systemHealth} />

// Queue monitoring
<JobQueueSummary queues={queueStats} />

// Error tracking
<RecentErrors 
  errors={recentErrors}
  maxDisplay={10}
  onViewFullLogs={handleViewLogs}
/>
```

## Integration Points

### Sentry Integration
Both ErrorBoundary and global error page include Sentry reporting:
```tsx
if (typeof window !== 'undefined' && (window as any).Sentry) {
  (window as any).Sentry.captureException(error);
}
```

### API Endpoints (To Be Implemented)
Admin page expects these API endpoints:
- `GET /api/admin/health` - System health status
- `GET /api/admin/queues` - Queue statistics
- `GET /api/admin/errors` - Recent errors

### Navigation Structure
Error pages provide links to:
- `/queue` - Opportunities queue
- `/history` - Execution history
- `/settings` - Settings
- `/admin` - Admin dashboard
- `/` - Home page

## Styling Approach

### Tailwind Classes Used
- `transition-calm` - Smooth transitions
- `text-foreground` / `text-muted-foreground` - Text colors
- `bg-card` / `bg-muted` - Background colors
- `border-border` - Border colors
- `rounded-lg` / `rounded-md` - Border radius
- Status colors: `text-success`, `text-error`, `text-warning`

### Consistent Spacing
- `space-y-4` / `space-y-6` - Vertical spacing
- `gap-2` / `gap-3` / `gap-4` - Flexbox gaps
- `p-4` / `p-6` - Padding
- `mb-2` / `mt-3` - Margins

## File Structure
```
apps/web/
├── app/
│   ├── error.tsx (Global error page)
│   ├── not-found.tsx (Global 404 page)
│   └── (dashboard)/
│       └── admin/
│           └── page.tsx (Admin dashboard)
├── components/
│   ├── ui/
│   │   └── Loading.tsx (All loading components)
│   ├── errors/
│   │   ├── ErrorBoundary.tsx
│   │   ├── ApiError.tsx
│   │   └── NotFound.tsx
│   └── admin/
│       ├── HealthStatus.tsx
│       ├── JobQueueSummary.tsx
│       └── RecentErrors.tsx
```

## Next Steps

### Backend Implementation Required
1. Create admin API endpoints:
   - `/api/admin/health` - Health check implementation
   - `/api/admin/queues` - BullMQ queue stats
   - `/api/admin/errors` - Error log aggregation

2. Integrate Sentry SDK in main app

3. Implement health check services:
   - Database connection check
   - Redis connection check
   - Shopify API connectivity check

### Testing Recommendations
1. Unit tests for each component
2. Test error boundary catches errors correctly
3. Test loading states render properly
4. Test admin dashboard with mock data
5. Accessibility testing with screen readers
6. Visual regression tests

### Usage Examples

#### Wrap App with Error Boundary
```tsx
// app/layout.tsx
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
```

#### Handle API Errors
```tsx
'use client';
import { ApiError } from '@/components/errors/ApiError';

export function MyComponent() {
  const [error, setError] = useState(null);
  
  const handleRetry = async () => {
    // Retry logic
  };
  
  if (error) {
    return <ApiError error={error} onRetry={handleRetry} />;
  }
  
  // Normal component render
}
```

#### Show Loading States
```tsx
import { LoadingPage, LoadingList } from '@/components/ui/Loading';

export function MyPage() {
  const [loading, setLoading] = useState(true);
  
  if (loading) {
    return <LoadingPage />;
  }
  
  return <div>Content</div>;
}
```

## Compliance with Requirements

### CLAUDE.md Alignment
✅ Calm over clever - All error messages are calm and reassuring
✅ Control over automation - Clear recovery actions provided
✅ Explainability over opacity - Errors explain what happened
✅ Trust compounds faster than features - Transparent error handling

### Beta Readiness Criteria
✅ No panic-inducing messages
✅ Clear error states with recovery options
✅ Loading states prevent confusion
✅ Admin observability for debugging
✅ Error tracking and logging ready for Sentry

### Accessibility
✅ ARIA labels on interactive elements
✅ Semantic HTML structure
✅ Keyboard navigation support
✅ Screen reader friendly

## Summary
All 10 requested components have been successfully implemented with:
- Calm, user-friendly design
- TypeScript type safety
- Reusable component patterns
- Accessibility compliance
- Development-friendly error details
- Production-ready error handling
- Admin observability tools
- Comprehensive loading states

The implementation is ready for integration with backend services and follows all MerchOps design principles.
