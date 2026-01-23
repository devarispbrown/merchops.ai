# MerchOps Web Application

## Overview

Next.js 14+ App Router application for the MerchOps operator console. This is the frontend for a calm, control-focused interface that helps Shopify merchants detect store signals, review prioritized opportunities, approve safe actions, and track outcomes.

**Core Principles:**
- Calm over clever
- Control over automation
- Explainability over opacity
- Trust compounds faster than features

The application serves as the primary interface for the MerchOps Beta MVP, enabling merchants to manage their store operations without constant dashboard babysitting while maintaining full control over any actions taken.

---

## Architecture

### App Router Structure

The application uses Next.js 14+ App Router with file-based routing. Routes are organized into logical groups using route groups (parentheses notation) to share layouts without affecting URL structure.

```
/app
  layout.tsx          # Root layout with providers
  page.tsx            # Home page (redirects based on auth)
  providers.tsx       # Client-side providers (TanStack Query, etc.)
  globals.css         # Global styles and design tokens

  /(auth)             # Route group for authentication
    layout.tsx        # Auth-specific layout (centered, minimal)
    /login
      page.tsx        # Login page
    /signup
      page.tsx        # Signup page

  /(dashboard)        # Route group for authenticated routes
    layout.tsx        # Dashboard layout (sidebar, header)
    page.tsx          # Dashboard home (redirects to /queue)
    /queue
      page.tsx        # Opportunity queue (main view)
    /history
      page.tsx        # Execution history
    /settings
      page.tsx        # Settings and Shopify connection

  /api                # API routes
    /auth
      /[...nextauth]
        route.ts      # NextAuth.js handler
      /signup
        route.ts      # User registration
    /outcomes
      route.ts        # Outcomes list endpoint
      /[executionId]
        route.ts      # Single outcome endpoint
```

### Server Components vs Client Components

The application follows Next.js best practices for component rendering:

**Server Components (Default):**
- Page components
- Layout components
- Data fetching components
- Static content

**Client Components (Explicit `'use client'`):**
- Interactive UI elements (buttons, modals, forms)
- Components using React hooks
- Components requiring browser APIs
- Components using TanStack Query

```tsx
// Server Component (default) - pages and layouts
// /app/(dashboard)/queue/page.tsx
export default async function QueuePage() {
  // Can fetch data directly
  const opportunities = await getOpportunities();
  return <OpportunityList opportunities={opportunities} />;
}

// Client Component - interactive elements
// /components/opportunities/ApprovalButton.tsx
'use client';
export function ApprovalButton({ opportunityId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  return <button onClick={() => setIsOpen(true)}>Review & Approve</button>;
}
```

### Data Fetching Patterns

**Server-Side Data Fetching:**
- Use `async` server components for initial page data
- Server actions for mutations
- Direct database access via Prisma in server context

**Client-Side Data Fetching:**
- TanStack Query for client-side data and cache management
- Optimistic updates where safe (dismiss, expand/collapse)
- Automatic refetching and deduplication

```tsx
// Server Action for mutations
'use server';
export async function approveAction(draftId: string) {
  const session = await getServerSession();
  if (!session) throw new Error('Unauthorized');

  return db.actionDraft.update({
    where: { id: draftId, workspace_id: session.workspace_id },
    data: { state: 'approved' },
  });
}

// TanStack Query for client-side
const { data, isLoading } = useQuery({
  queryKey: ['opportunities', workspaceId],
  queryFn: () => fetchOpportunities(workspaceId),
});
```

---

## Directory Structure

```
/app
  /(auth) - Authentication pages
    layout.tsx - Centered, minimal layout for auth flows
    /login - Login page with email/password or magic link
    /signup - User registration page
  /(dashboard) - Protected dashboard pages
    layout.tsx - Main layout with sidebar and header
    /queue - Opportunity queue (main view)
    /history - Execution history with outcomes
    /settings - Shopify connection and account settings
  /api - API routes
    /auth - NextAuth.js endpoints
    /outcomes - Outcome data endpoints
  /actions - Server actions (mutations)
/components
  /ui - Base UI components
    Button.tsx - Primary, secondary, danger, ghost variants
    Card.tsx - Content container with optional header
    Badge.tsx - Priority and status indicators
    Input.tsx - Form input with validation states
    Modal.tsx - Dialog component with focus management
  /layout - Layout components
    Sidebar.tsx - Navigation sidebar
    Header.tsx - Top header with user info
  /opportunities - Opportunity-related components
    OpportunityCard.tsx - Queue item card
    OpportunityDetail.tsx - Full opportunity view
    ApprovalButton.tsx - Review and approve action
    EventsList.tsx - Triggering events display
  /drafts - Draft-related components
    DraftEditor.tsx - Inline draft editing
    PayloadPreview.tsx - JSON payload preview
    ApprovalModal.tsx - Approval confirmation dialog
  /executions - Execution-related components
    ExecutionStatus.tsx - Status badge and details
  /learning - Learning loop components
    ConfidenceIndicator.tsx - Confidence score display
    OutcomeDisplay.tsx - Helped/neutral/hurt display
  /shopify - Shopify integration components
    ConnectForm.tsx - Shopify OAuth initiation
    ConnectionStatus.tsx - Connection state display
    DisconnectModal.tsx - Disconnect confirmation
  /empty-states - Empty state components
    (To be implemented for various empty states)
  /providers - Context providers
    AuthProvider.tsx - Authentication context
/lib
  /api - API client functions
    client.ts - Base fetch client
    types.ts - API response types
    opportunities.ts - Opportunity API calls
    drafts.ts - Draft API calls
    executions.ts - Execution API calls
    outcomes.ts - Outcome API calls
    confidence.ts - Confidence API calls
    shopify.ts - Shopify API calls
  /hooks - React hooks
    useOpportunities.ts - Opportunity data hook
    useExecutions.ts - Execution data hook
    useOutcomes.ts - Outcome data hook
    useShopifyConnection.ts - Shopify connection hook
  /utils - Utility functions
    formatters.ts - Date, number, currency formatters
  /actions - Client-side action utilities
    errors.ts - Error handling utilities
    validation.ts - Client-side validation
  utils.ts - General utilities (cn, etc.)
  correlation.ts - Correlation ID utilities
  auth-client.ts - Auth client utilities
/server
  /auth - Authentication logic
    config.ts - NextAuth configuration
    providers.ts - Auth providers setup
    session.ts - Session utilities
    workspace.ts - Workspace scoping
  /db - Database client
    client.ts - Prisma client singleton
    index.ts - Database exports
  /shopify - Shopify integration
    config.ts - Shopify app configuration
    client.ts - Shopify API client
    oauth.ts - OAuth flow handling
    webhooks.ts - Webhook processing
    /handlers - Webhook handlers
      orders.ts - Order webhook handler
      products.ts - Product webhook handler
      inventory.ts - Inventory webhook handler
  /events - Event system
    types.ts - Event type definitions
    create.ts - Event creation logic
    /compute - Event computation
      inventory.ts - Inventory event computation
      velocity.ts - Velocity spike computation
      customer.ts - Customer inactivity computation
  /opportunities - Opportunity engine
    types.ts - Opportunity type definitions
  /actions - Action/draft system
    types.ts - Action type definitions
    /drafts - Draft management
      create.ts - Draft creation
      edit.ts - Draft editing
      approve.ts - Draft approval
    /execute - Execution handlers
      discount.ts - Discount execution
      pause-product.ts - Product pause execution
      email.ts - Email execution
  /jobs - Background jobs
    config.ts - BullMQ configuration
    queues.ts - Queue definitions
  /learning - Learning loop
    types.ts - Learning type definitions
    confidence.ts - Confidence scoring
    queries.ts - Learning queries
    /outcomes - Outcome resolution
      compute.ts - Outcome computation
      /resolvers - Outcome resolvers
        discount.ts - Discount outcome resolver
        winback.ts - Winback outcome resolver
        pause.ts - Pause product outcome resolver
  /observability - Logging, metrics, tracing
    logger.ts - Structured logging (pino)
    metrics.ts - Basic metrics
    tracing.ts - Correlation tracing
    sentry.ts - Error tracking
    health.ts - Health check endpoints
  /ai - AI generation
    generate.ts - AI content generation
    fallbacks.ts - Fallback templates
/tests
  setup.ts - Test setup and utilities
  /unit - Unit tests
    /opportunities - Opportunity tests
      prioritization.test.ts - Priority scoring tests
    /events - Event tests
      dedupe.test.ts - Deduplication tests
  /e2e - End-to-end tests
    global-setup.ts - Playwright setup
    global-teardown.ts - Playwright teardown
    /helpers - E2E helpers
      auth.ts - Auth test helpers
      mocks.ts - Mock data helpers
```

---

## State Management

### Approach

- **TanStack Query for server state**: All API data (opportunities, executions, settings)
- **React state for local UI state**: Modals, forms, expanded cards, local filters
- **No global state store needed**: The combination of server state and local state covers all needs

### Why This Approach

1. **TanStack Query handles complexity**: Caching, deduplication, background refetching, optimistic updates
2. **Colocation over centralization**: State lives close to where it's used
3. **Server Components reduce client state**: Initial data fetched server-side
4. **Simplicity**: No Redux, Zustand, or other state libraries to maintain

### Data Flow

```
User Action
    |
    v
Component (Client)
    |
    +---> Optimistic UI Update (if safe)
    |
    v
TanStack Query Mutation / Server Action
    |
    v
API Route / Server Action
    |
    v
Database
    |
    v
TanStack Query Cache Invalidation
    |
    v
UI Update
```

### Example: Approving an Action

```tsx
// components/drafts/ApprovalModal.tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveDraft } from '@/lib/api/drafts';

export function ApprovalModal({ draftId, opportunityId }: Props) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => approveDraft(draftId),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Executing...' : 'Approve & Execute'}
    </button>
  );
}
```

---

## Approval Safety

The approval safety system is the core guarantee of MerchOps. **Nothing executes without explicit user approval.**

### Safety Layers

1. **No Silent Execution**
   - Every action requires explicit approval via the "Review & Approve" button
   - No auto-execution, background processing, or default approvals
   - No "one-click" shortcuts that bypass review

2. **Full Payload Preview**
   - Approval modal shows the complete execution payload
   - JSON preview of exactly what will be sent to Shopify/email provider
   - No hidden parameters or implicit defaults

3. **Confirmation Required**
   - "Approve & Execute" button is separate from preview
   - Button shows loading state during execution
   - Debouncing prevents accidental double-clicks

4. **Audit Trail**
   - Every approval creates an immutable execution record
   - Linked back to opportunity and triggering events
   - Visible in History page with outcome and evidence

### Dismiss Semantics

- **Dismiss is permanent**: Dismissed opportunities do not reappear
- **Unless inputs change**: Material change in underlying data can resurface similar opportunity
- **No undo (by design)**: This prevents "dismiss fatigue" gaming

### Approval Modal Implementation

```tsx
// components/drafts/ApprovalModal.tsx
export function ApprovalModal({ draft, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Modal isOpen onClose={onClose} title="Review & Approve">
      {/* Warning badge */}
      <Badge variant="warning">
        This action will execute immediately upon approval
      </Badge>

      {/* Payload preview */}
      <PayloadPreview payload={draft.payload} />

      {/* Confirmation checkbox */}
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I have reviewed the payload and understand this action is irreversible
      </label>

      {/* Action buttons */}
      <div>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          disabled={!confirmed}
          onClick={handleApprove}
        >
          Approve & Execute
        </Button>
      </div>
    </Modal>
  );
}
```

---

## Adding New Operator Intent

When adding a new operator intent (user-facing action type), follow these steps:

### 1. Add Type to OperatorIntent Enum

```typescript
// server/actions/types.ts
export enum OperatorIntent {
  REDUCE_INVENTORY_RISK = "reduce_inventory_risk",
  REENGAGE_DORMANT = "reengage_dormant_customers",
  PROTECT_MARGIN = "protect_margin",
  // Add new intent
  INCREASE_AOV = "increase_average_order_value",
}
```

### 2. Create Draft Generator

```typescript
// server/actions/drafts/create.ts
export async function createDraftForIntent(
  workspaceId: string,
  opportunityId: string,
  intent: OperatorIntent,
  context: DraftContext
): Promise<ActionDraft> {
  switch (intent) {
    case OperatorIntent.INCREASE_AOV:
      return createAovDraft(workspaceId, opportunityId, context);
    // ... other cases
  }
}
```

### 3. Create Executor

```typescript
// server/actions/execute/aov.ts
export async function executeAovAction(
  execution: Execution,
  shopifyClient: ShopifyClient
): Promise<ExecutionResult> {
  // Implementation
}
```

### 4. Create Outcome Resolver

```typescript
// server/learning/outcomes/resolvers/aov.ts
export async function resolveAovOutcome(
  execution: Execution,
  workspaceId: string
): Promise<OutcomeComputationResult> {
  // Measure AOV before/after
  // Determine helped/neutral/hurt
}
```

### 5. Add UI Components

```tsx
// components/opportunities/intents/AovOpportunityCard.tsx
export function AovOpportunityCard({ opportunity }: Props) {
  // Intent-specific display
}
```

### 6. Add Tests

```typescript
// tests/unit/actions/aov.test.ts
describe('AOV Intent', () => {
  it('should create valid draft', async () => {});
  it('should execute correctly', async () => {});
  it('should resolve outcome', async () => {});
});
```

---

## Adding New Execution Type

When adding a new execution type (mechanics of an action), follow these steps:

### 1. Add Type to ExecutionType Enum

```typescript
// server/actions/types.ts
export enum ExecutionType {
  DISCOUNT_DRAFT = "discount_draft",
  WINBACK_EMAIL = "winback_email_draft",
  PAUSE_PRODUCT = "pause_product",
  // Add new type
  BUNDLE_OFFER = "bundle_offer",
}
```

### 2. Define Payload Schema

```typescript
// server/actions/types.ts
export const BundleOfferPayloadSchema = z.object({
  bundle_name: z.string().min(1).max(255),
  product_ids: z.array(z.string()).min(2),
  discount_percentage: z.number().min(0).max(100),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
});

export type BundleOfferPayload = z.infer<typeof BundleOfferPayloadSchema>;
```

### 3. Create Executor

```typescript
// server/actions/execute/bundle.ts
import { ExecutionResult, ExecutionErrorCode } from '../types';

export async function executeBundleOffer(
  payload: BundleOfferPayload,
  shopifyClient: ShopifyClient,
  idempotencyKey: string
): Promise<ExecutionResult> {
  try {
    // Create Shopify discount or product bundle
    const result = await shopifyClient.createBundle(payload);

    return {
      status: 'succeeded',
      provider_response: result,
    };
  } catch (error) {
    return {
      status: 'failed',
      error_code: ExecutionErrorCode.SHOPIFY_API_ERROR,
      error_message: error.message,
    };
  }
}
```

### 4. Create Rollback Handler

```typescript
// server/actions/execute/bundle.ts
export async function rollbackBundleOffer(
  execution: Execution,
  shopifyClient: ShopifyClient
): Promise<void> {
  const bundleId = execution.provider_response?.bundle_id;
  if (bundleId) {
    await shopifyClient.deleteBundle(bundleId);
  }
}
```

### 5. Add Editable Fields Configuration

```typescript
// server/actions/types.ts
export const EDITABLE_FIELDS: Record<ExecutionType, EditableFieldConfig[]> = {
  // ... existing
  [ExecutionType.BUNDLE_OFFER]: [
    {
      path: "bundle_name",
      label: "Bundle Name",
      type: "text",
      required: true,
      validation: z.string().min(1).max(255),
    },
    {
      path: "discount_percentage",
      label: "Bundle Discount (%)",
      type: "number",
      required: true,
      validation: z.number().min(0).max(100),
    },
    // ... more fields
  ],
};
```

### 6. Add UI for Draft Editing

```tsx
// components/drafts/editors/BundleEditor.tsx
export function BundleEditor({ draft, onSave }: Props) {
  const editableFields = getEditableFields(ExecutionType.BUNDLE_OFFER);

  return (
    <DraftEditor
      draft={draft}
      fields={editableFields}
      onSave={onSave}
    />
  );
}
```

### 7. Add Tests

```typescript
// tests/unit/actions/bundle.test.ts
describe('Bundle Offer Execution', () => {
  it('should validate payload schema', () => {});
  it('should execute with idempotency', async () => {});
  it('should handle Shopify errors', async () => {});
  it('should rollback on failure', async () => {});
});
```

---

## Styling

### Tailwind CSS Configuration

The application uses Tailwind CSS with a custom, calm color palette designed to minimize visual stress.

### Calm Color Palette

```css
/* globals.css */
:root {
  /* Primary (muted blue) */
  --primary: 210 20% 45%;
  --primary-foreground: 0 0% 100%;

  /* Success (subtle green) */
  --success: 150 25% 45%;

  /* Warning (muted amber) */
  --warning: 35 30% 50%;

  /* Error (muted red) */
  --error: 355 30% 50%;

  /* Priority buckets */
  --priority-high: 355 30% 50%;
  --priority-medium: 35 30% 50%;
  --priority-low: 210 15% 55%;

  /* Neutrals */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --muted: 210 20% 96%;
  --muted-foreground: 215 16% 47%;
  --border: 214 32% 91%;
}
```

### Design Principles

1. **Minimal Chrome**: No unnecessary UI elements or decorative features
2. **Muted Colors**: Blues and grays as primary; subtle accents for status
3. **Clear Typography**: Inter font, generous line height, clear hierarchy
4. **Purposeful Spacing**: Breathing room between elements
5. **No Dark Patterns**: No urgency pressure, fake scarcity, or manipulation

### Component Examples

```tsx
// Calm button - no aggressive colors
<Button variant="primary" className="bg-primary/90 hover:bg-primary">
  Review & Approve
</Button>

// Muted priority badge
<Badge variant="high" className="bg-priority-high/10 text-priority-high">
  High Priority
</Badge>

// Spacious card layout
<Card className="p-6 space-y-4">
  <h3 className="text-lg font-medium text-foreground">Opportunity</h3>
  <p className="text-sm text-muted-foreground leading-relaxed">
    {description}
  </p>
</Card>
```

---

## Testing

### Test Stack

- **Vitest**: Unit and integration tests
- **Playwright**: End-to-end tests
- **Testing Library**: Component testing utilities

### Unit Tests (Vitest)

Location: `/tests/unit/`

Test coverage for:
- Opportunity prioritization and decay logic
- Event deduplication
- Payload validation (Zod schemas)
- State machine transitions
- Utility functions

```typescript
// tests/unit/opportunities/prioritization.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePriority } from '@/server/opportunities/prioritization';

describe('Opportunity Prioritization', () => {
  it('should assign high priority to urgent stockouts', () => {
    const score = calculatePriority({
      urgency: 0.9,
      consequence: 0.8,
      confidence: 0.7,
      novelty: 0.5,
    });
    expect(score.bucket).toBe('high');
  });
});
```

### E2E Tests (Playwright)

Location: `/tests/e2e/`

Critical flows tested:
1. Sign up -> connect Shopify (mock) -> dashboard shows queue
2. Opportunity detail shows why-now + counterfactual
3. Edit draft -> approve -> execution success shown
4. Execution failure surfaces actionable error
5. Dismiss opportunity -> does not return unless input changes

```typescript
// tests/e2e/approval-flow.spec.ts
import { test, expect } from '@playwright/test';

test('should show execution success after approval', async ({ page }) => {
  await page.goto('/queue');

  // Click first opportunity
  await page.click('[data-testid="opportunity-card"]');

  // Click review button
  await page.click('text=Review & Approve');

  // Verify payload preview is visible
  await expect(page.locator('[data-testid="payload-preview"]')).toBeVisible();

  // Confirm and approve
  await page.check('[data-testid="confirm-checkbox"]');
  await page.click('text=Approve & Execute');

  // Verify success state
  await expect(page.locator('text=Execution successful')).toBeVisible();
});
```

### Running Tests

```bash
# Unit tests
pnpm test

# Unit tests in watch mode
pnpm test:watch

# E2E tests
pnpm test:e2e

# E2E tests with UI
pnpm test:e2e:ui
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Development

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL (local or managed)
- Redis (local or Upstash)

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run database migrations
pnpm prisma:migrate

# Start dev server
pnpm dev
```

### Scripts

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript compiler
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
```

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Shopify
SHOPIFY_API_KEY=...
SHOPIFY_API_SECRET=...

# Redis
REDIS_URL=...

# Observability
SENTRY_DSN=...
```

---

## Contributing

All frontend changes must:

1. Pass TypeScript strict mode checks
2. Follow the calm design principles
3. Include unit tests for new components
4. Update E2E tests for new flows
5. Maintain accessibility standards (WCAG 2.1 AA)
6. Not violate approval safety guardrails

**Violating the calm or safety principles is considered a bug and will be rejected.**
