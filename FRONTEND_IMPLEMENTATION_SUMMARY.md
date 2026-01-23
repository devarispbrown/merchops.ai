# Frontend Implementation Summary - Shopify Connection UI

## Overview

Created comprehensive Shopify connection UI and settings pages for MerchOps following the calm design principles outlined in CLAUDE.md. All components prioritize clarity, user control, and helpful explanations.

## Files Created

### 1. Pages

#### `/apps/web/app/(dashboard)/connect/page.tsx`
**Purpose**: Shopify store connection page  
**Features**:
- Store domain input form
- Clear explanation of required permissions
- Visual breakdown of read and write access scopes
- User control messaging (nothing executes without approval)
- Error handling and loading states
- Initiates OAuth flow

#### `/apps/web/app/(dashboard)/settings/shopify/page.tsx`
**Purpose**: Detailed Shopify connection management  
**Features**:
- Connection status overview
- Store domain display
- Granted permissions list
- Last sync timestamp
- Disconnect functionality with modal confirmation
- Permission explanations
- Security and privacy information
- Links to connect if not connected

#### `/apps/web/app/(dashboard)/settings/page.tsx`
**Purpose**: Main settings overview (UPDATED)  
**Features**:
- Card-based navigation to Shopify settings
- Connection status at-a-glance
- Account settings section
- Help and documentation links
- Clean, organized layout

### 2. Components - Shopify Specific

#### `/apps/web/components/shopify/ConnectForm.tsx`
**Purpose**: Form for entering Shopify store domain  
**Features**:
- Store domain input with .myshopify.com suffix helper
- Validation (lowercase, alphanumeric, hyphens only)
- Auto-detection of full domain or subdomain
- Error messaging
- Loading state during OAuth initiation
- Helper text

#### `/apps/web/components/shopify/ConnectionStatus.tsx`
**Purpose**: Display connection status information  
**Features**:
- Status badge (Connected/Not Connected)
- Store domain display
- Last sync timestamp
- Clean, minimal design

#### `/apps/web/components/shopify/DisconnectModal.tsx`
**Purpose**: Confirmation modal for disconnecting store  
**Features**:
- Warning about consequences of disconnecting
- Bulleted list of what will happen
- Confirmation checkbox requirement
- Cancel and confirm buttons
- Loading state during disconnect
- Prevents accidental disconnections

### 3. Components - Empty States

#### `/apps/web/components/empty-states/NoShopifyConnection.tsx`
**Purpose**: Empty state when no Shopify store is connected  
**Features**:
- Clear messaging about why connection is needed
- Benefits list with checkmarks
- Visual hierarchy
- CTA button to connect store
- Calm, encouraging tone

#### `/apps/web/components/empty-states/NoOpportunities.tsx`
**Purpose**: Empty state when opportunity queue is empty  
**Features**:
- Positive messaging ("All Caught Up")
- Explanation of how opportunities are created
- Examples of triggering conditions
- Link to settings
- Calm reassurance that system is working

### 4. Hooks

#### `/apps/web/lib/hooks/useShopifyConnection.ts`
**Purpose**: TanStack Query hook for Shopify connection state  
**Features**:
- Fetches connection status from API
- Connection data: isConnected, storeDomain, scopes, lastSyncAt
- Disconnect mutation
- Loading and error states
- Automatic refetching on mount
- Cache invalidation after disconnect

#### `/apps/web/lib/hooks/useOpportunities.ts`
**Purpose**: TanStack Query hook for opportunities data  
**Features**:
- Fetches opportunities with filters
- Supports priority filtering (high, medium, low)
- Supports state filtering (new, viewed, etc.)
- Pagination support
- Refetch capability
- Type-safe opportunity interface

### 5. UI Components (Created/Enhanced)

#### `/apps/web/lib/utils.ts`
**Purpose**: Utility functions for component styling  
**Features**:
- `cn()` function for merging Tailwind classes
- Uses clsx and tailwind-merge

#### `/apps/web/components/ui/Checkbox.tsx`
**Purpose**: Reusable checkbox component  
**Features**:
- Accessible checkbox input
- Optional label support
- Consistent styling with design system
- Focus states and transitions

### 6. Updated Pages

#### `/apps/web/app/(dashboard)/queue/page.tsx` (UPDATED)
**Purpose**: Main opportunity queue (enhanced with empty states)  
**Features**:
- Checks Shopify connection status
- Shows `NoShopifyConnection` if not connected
- Shows `NoOpportunities` if connected but queue empty
- Loading state while checking connection
- Seamless integration with existing queue display

## Design Principles Applied

### 1. Calm Over Clever
- No aggressive CTAs or urgency pressure
- Clear, straightforward language
- Thoughtful empty states
- Reassuring messaging

### 2. Control Over Automation
- Explicit approval required messaging everywhere
- Disconnect confirmation with checkbox
- Clear consequences explained
- No hidden actions

### 3. Explainability Over Opacity
- Detailed permission breakdowns
- "Why we need this" explanations
- Clear status indicators
- Helpful helper text

### 4. Trust Compounds Faster Than Features
- Security and privacy information highlighted
- Transparent about data access
- Reversible actions (can reconnect)
- No payment data storage mentioned

## User Flows

### 1. First-Time Connection
```
Queue Page → No Connection Empty State → Connect Button → 
Connect Page → Enter Store Domain → OAuth Flow → 
Callback → Queue with Opportunities
```

### 2. Managing Connection
```
Settings → Shopify Connection Card → Shopify Settings Page →
View Status/Scopes/Sync → Disconnect (if needed) →
Confirmation Modal → Confirm → Disconnected State
```

### 3. Reconnection
```
Queue Page (Disconnected) → NoShopifyConnection → Connect Button →
Connect Page → OAuth Flow → Reconnected
```

## API Integration Points

### Required API Endpoints

1. **GET /api/shopify/connection**
   - Returns connection status, store domain, scopes, lastSyncAt
   - Used by `useShopifyConnection` hook

2. **POST /api/shopify/connect**
   - Body: `{ storeDomain: string }`
   - Returns: `{ authUrl: string }`
   - Initiates OAuth flow

3. **POST /api/shopify/disconnect**
   - Disconnects store and revokes tokens
   - Returns success/error

4. **GET /api/opportunities**
   - Query params: priority[], state[], page, limit
   - Returns paginated opportunities
   - Used by `useOpportunities` hook

## TypeScript Interfaces

### ShopifyConnection
```typescript
interface ShopifyConnection {
  isConnected: boolean;
  storeDomain: string | null;
  scopes: string[];
  lastSyncAt: string | null;
  status: 'connected' | 'disconnected' | 'error';
}
```

### Opportunity
```typescript
interface Opportunity {
  id: string;
  type: string;
  priorityBucket: 'high' | 'medium' | 'low';
  whyNow: string;
  rationale: string;
  counterfactual: string;
  impactRange: string;
  confidence: number;
  state: 'new' | 'viewed' | 'approved' | 'executed' | 'dismissed' | 'expired';
  decayAt: string;
  createdAt: string;
}
```

## Styling Approach

All components use:
- Tailwind CSS utility classes
- CSS custom properties from `globals.css`
- Calm color palette (muted blues and grays)
- Consistent spacing and typography
- Smooth transitions (`transition-calm` utility)
- Proper focus states for accessibility

## Accessibility Features

- Semantic HTML throughout
- Proper ARIA attributes where needed
- Keyboard navigation support
- Focus visible states
- Color contrast compliance
- Screen reader friendly labels
- Modal escape key handling
- Loading states for screen readers

## Testing Recommendations

### Unit Tests
- Form validation in ConnectForm
- Status badge display logic
- Empty state conditional rendering

### Integration Tests
- Connection flow end-to-end
- Disconnect flow with confirmation
- Settings navigation
- Hook data fetching

### E2E Tests (Playwright)
- Complete OAuth connection flow
- Settings management
- Empty state to connected state transition
- Disconnect and reconnect flow

## Next Steps

### Backend Integration
1. Implement API endpoints listed above
2. Set up Shopify OAuth flow
3. Create webhook handlers for sync events
4. Implement disconnect logic with token revocation

### Additional Features
1. Connection health monitoring
2. Sync status indicators
3. Manual sync trigger
4. Scope change detection
5. Connection error recovery

### Enhancements
1. Toast notifications for actions
2. Loading skeletons for better perceived performance
3. Connection troubleshooting guide
4. Scope permission tooltips
5. Analytics tracking for user flows

## Files Summary

**Total Files Created**: 10 new files + 2 updated
**Total Lines of Code**: ~1,500 lines
**Components**: 8 (3 Shopify-specific, 2 empty states, 3 UI utilities)
**Pages**: 2 new + 2 updated
**Hooks**: 2 new (TanStack Query)

## Validation Checklist

- [x] All components follow calm design principles
- [x] User control is emphasized throughout
- [x] Clear explanations provided
- [x] Empty states are helpful and encouraging
- [x] Loading states implemented
- [x] Error states handled
- [x] TypeScript strict mode compatible
- [x] Responsive design (mobile-first)
- [x] Accessibility features included
- [x] Consistent with existing design system
- [x] Integration points documented
- [x] User flows mapped

## Project Structure

```
/apps/web
├── app
│   └── (dashboard)
│       ├── connect
│       │   └── page.tsx (NEW)
│       ├── queue
│       │   └── page.tsx (UPDATED)
│       └── settings
│           ├── page.tsx (UPDATED)
│           └── shopify
│               └── page.tsx (NEW)
├── components
│   ├── empty-states
│   │   ├── NoOpportunities.tsx (NEW)
│   │   └── NoShopifyConnection.tsx (NEW)
│   ├── shopify
│   │   ├── ConnectForm.tsx (NEW)
│   │   ├── ConnectionStatus.tsx (NEW)
│   │   └── DisconnectModal.tsx (NEW)
│   └── ui
│       ├── Checkbox.tsx (NEW)
│       └── ... (existing components)
└── lib
    ├── hooks
    │   ├── useOpportunities.ts (NEW)
    │   └── useShopifyConnection.ts (NEW)
    └── utils.ts (NEW)
```

## Conclusion

The Shopify connection UI is now complete with:
- Clean, calm interface
- Clear user guidance
- Proper empty states
- Connection management
- Settings pages
- TanStack Query integration
- TypeScript type safety
- Responsive design
- Accessibility compliance

All components are ready for backend API integration and follow MerchOps beta MVP requirements for calm operation, user control, and explainability.
