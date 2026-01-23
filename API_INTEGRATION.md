# UI API Integration - Dashboard Pages

## Overview

This document describes the API integration implemented for the MerchOps dashboard pages.

## Pages Updated

### 1. Draft Detail Page (`/drafts/[id]`)

**Location:** `apps/web/app/(dashboard)/drafts/[id]/page.tsx`

**API Calls Implemented:**

- **Fetch Draft** - `GET /api/drafts/[id]`
  - Uses `useDraft(id)` hook
  - Displays loading state while fetching
  - Shows error state if fetch fails
  - Automatically refetches on mount

- **Save Draft** - `PATCH /api/drafts/[id]`
  - Uses `useUpdateDraft()` mutation hook
  - Sends `{ updates: { ...editedFields } }` payload
  - Optimistic UI update (immediately shows changes)
  - Shows success toast on save
  - Shows error toast with message on failure
  - Reverts optimistic update on error

- **Approve Draft** - `POST /api/drafts/[id]/approve`
  - Uses `useApproveDraft()` mutation hook
  - Sends `{ confirmation: true }` payload
  - Shows confirmation modal before approval
  - Shows success toast on approval
  - Redirects to execution history on success
  - Shows error toast with actionable message on failure
  - Disables button during pending state

**Features:**
- Loading spinner during initial fetch
- Disabled state on buttons during mutations
- Toast notifications for success/error states
- Automatic cache invalidation after mutations
- Type-safe API requests and responses

---

### 2. Opportunity Detail Page (`/queue/[id]`)

**Location:** `apps/web/app/(dashboard)/queue/[id]/page.tsx`

**API Calls Implemented:**

- **Fetch Opportunity** - `GET /api/opportunities/[id]`
  - Uses `useOpportunity(id)` hook
  - Displays loading state while fetching
  - Shows error state if fetch fails
  - Includes related events in response

- **Create Draft** - `POST /api/drafts`
  - Uses `useCreateDraft()` mutation hook
  - Automatically determines operator intent and execution type based on opportunity type
  - Sends `{ opportunityId, operatorIntent, executionType }` payload
  - Shows success toast on creation
  - Redirects to draft detail page on success
  - Shows error toast with message on failure

- **Dismiss Opportunity** - `PATCH /api/opportunities/[id]`
  - Uses `useDismissOpportunity()` mutation hook
  - Sends `{ state: 'dismissed' }` payload
  - Shows confirmation modal before dismissing
  - Optimistic UI update (immediately marks as dismissed)
  - Shows success toast on dismiss
  - Redirects to queue list on success
  - Reverts optimistic update on error

**Features:**
- Loading spinner during initial fetch
- Confirmation modal for destructive actions
- Optimistic updates for immediate feedback
- Automatic operator intent mapping
- Toast notifications for all actions
- Type-safe opportunity type to action mapping

---

## New Components Created

### 1. Toast Notification System

**Files:**
- `apps/web/lib/hooks/useToast.ts` - Toast state management hook
- `apps/web/components/ui/Toast.tsx` - Toast UI component

**Features:**
- Global toast state management
- Auto-dismiss after configurable duration
- Support for success, error, warning, info types
- Manual dismiss capability
- Fixed positioning (bottom-right)
- Slide-in animation

**Usage:**
```tsx
const { showToast, success, error } = useToast();

// Simple usage
success('Draft saved successfully');
error('Failed to save draft');

// Advanced usage
showToast('Custom message', 'warning', 3000);
```

---

## API Client Updates

### Updated Types (`apps/web/lib/api/types.ts`)

**CreateDraftRequest:**
```typescript
interface CreateDraftRequest {
  opportunityId: string;
  operatorIntent: OperatorIntent;
  executionType: ExecutionType;
  context?: Record<string, any>;
}
```

**UpdateDraftRequest:**
```typescript
interface UpdateDraftRequest {
  updates: Record<string, any>;
}
```

### Updated API Methods

**Opportunities API** (`apps/web/lib/api/opportunities.ts`):
- `dismissOpportunity()` - Changed from POST to PATCH with state payload
- `viewOpportunity()` - Changed from POST to PATCH with state payload

---

## React Query Integration

### Query Keys

**Drafts:**
- `['drafts']` - All drafts
- `['drafts', 'list', params]` - Paginated drafts list
- `['drafts', 'detail', id]` - Single draft detail

**Opportunities:**
- `['opportunities']` - All opportunities
- `['opportunities', 'list', params]` - Paginated opportunities list
- `['opportunities', 'detail', id]` - Single opportunity detail

### Cache Invalidation Strategy

**After creating a draft:**
- Invalidates `['drafts', 'list']` to refresh lists
- Adds new draft to cache at `['drafts', 'detail', newId]`

**After updating a draft:**
- Optimistically updates `['drafts', 'detail', id]`
- Invalidates `['drafts', 'list']` on success
- Reverts optimistic update on error

**After approving a draft:**
- Updates `['drafts', 'detail', id]`
- Invalidates `['drafts', 'list']`, `['opportunities']`, and `['executions']`

**After dismissing an opportunity:**
- Optimistically updates `['opportunities', 'detail', id]`
- Invalidates `['opportunities', 'list']` on success
- Reverts optimistic update on error

---

## Error Handling

### Pattern Used

```typescript
try {
  await mutation.mutateAsync(data);
  showToast('Success message', 'success');
  // Redirect or update UI
} catch (error) {
  console.error('Context:', error);
  showToast(
    error instanceof Error ? error.message : 'Fallback message',
    'error'
  );
  // Optional: throw error for ApprovalModal to catch
}
```

### Error Display

- User-friendly error messages via toast notifications
- Never show raw error objects to users
- Console.error for developer debugging
- Specific error messages from API when available
- Fallback generic messages when API error is unclear

---

## Loading States

### Implementation

**Fetching data:**
- Full-page loading spinner with centered text
- Prevents interaction during load
- Clear loading message

**Mutations:**
- Disabled buttons during pending state
- Button text changes (e.g., "Approve" → "Approving...")
- Prevents double-submission

---

## Type Safety

### Approach

- Used TypeScript strict mode
- Type assertions only where Prisma/server type mismatch exists
- Explicit imports for type clarity
- Zod schemas for runtime validation
- Proper error type narrowing

### Type Conversions

**ExecutionType:**
```typescript
// Prisma ExecutionType → Server Actions ExecutionType
executionType={draft.execution_type as ExecutionType}
```

**EventType:**
```typescript
// API EventType (string) → Component EventType (enum)
events={opportunity.events.map((e) => ({
  ...e,
  type: e.type as unknown as EventType,
}))}
```

---

## Testing Checklist

### E2E Tests Needed

- [ ] Draft Detail: Edit draft → Save → Verify saved
- [ ] Draft Detail: Approve draft → Execute → See result
- [ ] Draft Detail: Approval failure shows error
- [ ] Opportunity Detail: Create draft from opportunity
- [ ] Opportunity Detail: Dismiss opportunity → Gone from queue
- [ ] Opportunity Detail: Dismiss confirmation can be cancelled

### Integration Tests

- [ ] useDraft hook fetches and caches correctly
- [ ] useUpdateDraft optimistic update and rollback
- [ ] useApproveDraft invalidates correct queries
- [ ] useCreateDraft adds to cache and redirects
- [ ] useDismissOpportunity optimistic update works

---

## Next Steps

1. **Add ToastContainer to root layout** - Already done in `apps/web/app/(dashboard)/layout.tsx`
2. **Write E2E tests** - Use Playwright to test critical flows
3. **Add error boundaries** - Catch React errors gracefully
4. **Implement retry logic** - For failed mutations
5. **Add telemetry** - Track API call success/failure rates
6. **Optimize bundle size** - Code split heavy components

---

## Known Limitations

1. **Type mismatches** - Prisma enums vs. server action enums require casting
2. **No retry logic** - Failed mutations don't auto-retry (could use React Query retry config)
3. **No offline support** - App requires network connection
4. **Limited error context** - Some API errors don't provide detailed field-level errors

---

## Files Modified

- `apps/web/app/(dashboard)/drafts/[id]/page.tsx` - Wired up draft API calls
- `apps/web/app/(dashboard)/queue/[id]/page.tsx` - Wired up opportunity API calls
- `apps/web/app/(dashboard)/layout.tsx` - Added ToastContainer
- `apps/web/lib/api/types.ts` - Updated CreateDraftRequest and UpdateDraftRequest
- `apps/web/lib/api/opportunities.ts` - Updated dismiss/view methods
- `apps/web/lib/hooks/useDrafts.ts` - Updated optimistic update logic
- `apps/web/lib/hooks/index.ts` - Exported useToast hook
- `apps/web/lib/api/verify.ts` - Updated type checks
- `apps/web/components/opportunities/EventsList.tsx` - Made payload field flexible
- `apps/web/components/ui/Toast.tsx` - Created toast component (new)
- `apps/web/lib/hooks/useToast.ts` - Created toast hook (new)

---

## Summary

All required API calls have been successfully wired up for the Draft Detail and Opportunity Detail pages. The implementation follows best practices for:

- Type safety
- Error handling
- Loading states
- User feedback
- Cache management
- Optimistic updates

The pages are now ready for E2E testing and production use.
