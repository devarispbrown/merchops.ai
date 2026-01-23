# MerchOps Action System

**Draft, Approval, and Execution Engine for MerchOps Beta MVP**

This system implements the core action lifecycle: draft creation → editing → approval → execution → rollback (where possible).

## Architecture Overview

The action system is built on three core principles:

1. **Control over automation**: Nothing executes without explicit approval
2. **Idempotency**: Same approval never results in duplicate execution
3. **Explainability**: Every action is traceable from opportunity to outcome

## System Components

```
/server/actions/
├── types.ts                    # Type definitions, enums, schemas
├── drafts/
│   ├── create.ts              # Generate drafts from opportunities
│   ├── edit.ts                # Validate and update editable fields
│   └── approve.ts             # Transition to approved, enqueue execution
├── execute/
│   ├── discount.ts            # Shopify discount creation
│   ├── pause-product.ts       # Shopify product status update
│   └── email.ts               # Email draft/send (MVP: draft-only)
├── execution-engine.ts        # Orchestration, retry logic, idempotency
├── rollback.ts                # Undo executions (where supported)
└── index.ts                   # Central export
```

## API Routes

```
/api/drafts
├── GET     /api/drafts                    # List drafts
├── POST    /api/drafts                    # Create draft
├── GET     /api/drafts/[id]               # Get draft detail
├── PATCH   /api/drafts/[id]               # Edit draft
├── DELETE  /api/drafts/[id]               # Reject draft
└── POST    /api/drafts/[id]/approve       # Approve and execute

/api/executions
├── GET     /api/executions                # List executions
├── GET     /api/executions/[id]           # Get execution detail
└── POST    /api/executions/[id]/rollback  # Rollback execution
```

## Execution Types

### 1. Discount Draft (`DISCOUNT_DRAFT`)

**Operator Intent**: Reduce inventory risk, boost velocity

**Payload**:
```typescript
{
  title: string;
  code?: string;                    // Auto-generated if not provided
  discount_type: "percentage" | "fixed_amount";
  value: number;
  target_type: "product" | "collection" | "entire_order";
  target_ids?: string[];
  usage_limit?: number;
  customer_segment?: string;
  starts_at: string;                // ISO 8601
  ends_at?: string;
  minimum_purchase_amount?: number;
}
```

**Editable Fields**:
- `title`, `value`, `starts_at`, `ends_at`, `usage_limit`

**Execution**: Creates Shopify price rule + discount code

**Rollback**: Supported (deletes price rule)

---

### 2. Winback Email (`WINBACK_EMAIL`)

**Operator Intent**: Re-engage dormant customers

**Payload**:
```typescript
{
  subject: string;
  preview_text?: string;
  body_html: string;
  body_text: string;
  from_name: string;
  from_email: string;
  recipient_segment: string;
  include_discount_code?: string;
  send_at?: string;                 // ISO 8601
}
```

**Editable Fields**:
- `subject`, `preview_text`, `body_html`, `body_text`, `send_at`

**Execution**: MVP creates draft only (manual send required)

**Rollback**: **Not supported** (emails cannot be recalled)

---

### 3. Pause Product (`PAUSE_PRODUCT`)

**Operator Intent**: Reduce inventory risk, prevent overselling

**Payload**:
```typescript
{
  product_ids: string[];
  reason: string;
  restore_at?: string;              // Auto-restore time
  notify_customers: boolean;
  redirect_to_similar: boolean;
  similar_product_ids?: string[];
}
```

**Editable Fields**:
- `reason`, `restore_at`, `notify_customers`, `redirect_to_similar`

**Execution**: Updates Shopify product status to "draft"

**Rollback**: Supported (restores original status)

---

## Workflow

### 1. Create Draft

```typescript
import { createDraftForOpportunity } from "@/server/actions";

const result = await createDraftForOpportunity({
  workspaceId: "workspace_123",
  opportunityId: "opp_456",
  operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
  executionType: ExecutionType.DISCOUNT_DRAFT,
  context: {
    inventoryLevel: 25,
    velocityScore: 0.3,
  },
});

// Returns: { draftId, payload, editableFields }
```

**What happens**:
1. Validates opportunity exists
2. Generates initial payload (AI-powered with fallback)
3. Sets editable field configuration
4. Creates `action_drafts` record with state `DRAFT`

---

### 2. Edit Draft (Optional)

```typescript
import { updateDraft } from "@/server/actions";

const result = await updateDraft({
  workspaceId: "workspace_123",
  draftId: "draft_789",
  updates: {
    title: "Flash Sale - 20% Off Winter Collection",
    value: 20,
    ends_at: "2026-02-01T00:00:00Z",
  },
});

// Returns: { success: true, draft, errors?: [] }
```

**What happens**:
1. Validates draft is in editable state (`DRAFT` or `EDITED`)
2. Checks all update fields are in `editableFields`
3. Validates each field against Zod schema
4. Applies updates to payload
5. Validates complete payload
6. Updates draft with state `EDITED`

---

### 3. Approve Draft

```typescript
import { approveDraft } from "@/server/actions";

const result = await approveDraft({
  workspaceId: "workspace_123",
  draftId: "draft_789",
  approvedBy: "user_123",
});

// Returns: { success: true, executionId, idempotencyKey }
```

**What happens** (atomic transaction):
1. Validates draft state is `DRAFT` or `EDITED`
2. Final payload validation
3. Generates idempotency key: `draft_{draftId}_{timestamp}_{random}`
4. Checks for existing execution with this key (prevents double approval)
5. Updates draft state to `APPROVED`
6. Creates `executions` record with status `PENDING`
7. Updates opportunity state to `approved`
8. Enqueues execution job (currently immediate, TODO: BullMQ)

---

### 4. Execution

Execution is handled by `execution-engine.ts` with the following guarantees:

**Idempotency**:
- Checks execution status before running
- If already `SUCCEEDED`, returns immediately
- If `RUNNING`, returns "already in progress"

**Retry Logic**:
- Max 3 attempts
- Exponential backoff (2s, 4s, 8s)
- Only retries on network/timeout/rate-limit errors
- Non-retryable errors fail immediately

**State Management**:
- `PENDING` → `RUNNING` → `SUCCEEDED` or `FAILED`
- `RETRYING` state during backoff
- Stores provider response and error taxonomy
- Updates draft and opportunity states

**Error Classification**:

| Error Code | Retryable | Description |
|------------|-----------|-------------|
| `NETWORK_ERROR` | Yes | Connection failed |
| `TIMEOUT` | Yes | Request timed out |
| `RATE_LIMIT_EXCEEDED` | Yes | API throttling |
| `INVALID_TOKEN` | No | Auth failed |
| `INVALID_PAYLOAD` | No | Validation failed |
| `PRODUCT_NOT_FOUND` | No | Resource missing |
| `SHOPIFY_API_ERROR` | No | Unknown Shopify error |

---

### 5. Rollback (Where Supported)

```typescript
import { rollbackExecution } from "@/server/actions";

const result = await rollbackExecution({
  workspaceId: "workspace_123",
  executionId: "exec_999",
  reason: "Merchant changed mind",
});

// Returns: { success: true, rollbackSupported: true, message }
```

**Rollback Support by Type**:

| Execution Type | Rollback Supported | Action |
|----------------|-------------------|---------|
| `DISCOUNT_DRAFT` | ✅ Yes | Deletes Shopify price rule |
| `PAUSE_PRODUCT` | ✅ Yes | Restores product status |
| `WINBACK_EMAIL` | ❌ No | Email already sent |

**What happens**:
1. Validates execution status is `SUCCEEDED`
2. Checks if rollback is supported
3. Calls type-specific rollback function
4. Logs rollback in provider response
5. Updates opportunity state to `viewed`

---

## Idempotency Guarantees

The system ensures **no partial executions** and **no duplicate executions**:

1. **Idempotency Key**: Generated once per approval
   ```
   draft_{draftId}_{timestamp}_{random}
   ```

2. **Pre-Execution Check**: Before running executor
   ```typescript
   if (execution.status === ExecutionStatus.SUCCEEDED) {
     return { success: true }; // Already done
   }
   ```

3. **Database Constraints**: Unique index on `idempotency_key`

4. **Atomic Approval**: Transaction wraps:
   - Draft state update
   - Execution record creation
   - Opportunity state update

---

## Error Handling

### Client Errors (400s)

```json
{
  "error": "Validation failed",
  "errors": [
    { "field": "value", "message": "must be positive" }
  ]
}
```

### Server Errors (500s)

```json
{
  "error": "Shopify API error",
  "details": {
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": "2026-01-23T10:30:00Z"
  }
}
```

### Conflict Errors (409)

```json
{
  "error": "Draft cannot be edited in state: approved"
}
```

---

## Observability

Every execution is fully traceable:

1. **Correlation ID**: `executionId` links all operations
2. **Audit Trail**: Immutable execution record with:
   - Request payload
   - Provider response
   - Error code + message
   - Timestamps (started, finished)
3. **Opportunity Linkage**: Every execution traces back to opportunity → events
4. **AI Generation Log**: If AI was used for copy, stored in `ai_generations`

---

## Testing Checklist

### Unit Tests

- [ ] Payload validation (Zod schemas)
- [ ] Editable field validation
- [ ] Idempotency key generation
- [ ] Error classification
- [ ] Backoff calculation

### Integration Tests

- [ ] Create draft → edit → approve flow
- [ ] Duplicate approval returns same execution
- [ ] Non-editable field rejection
- [ ] Invalid state transition rejection
- [ ] Retry on network error
- [ ] No retry on validation error
- [ ] Rollback supported types
- [ ] Rollback unsupported types error

### E2E Tests (Playwright)

- [ ] User approves discount, execution succeeds
- [ ] User approves discount, execution fails, error shown
- [ ] User edits draft, values persist
- [ ] User rejects draft, opportunity dismissed
- [ ] User rolls back execution (discount)
- [ ] User cannot rollback email (shows warning)

---

## TODOs for Production

### High Priority

- [ ] **BullMQ Integration**: Replace `setImmediate` with proper job queue
- [ ] **Shopify SDK**: Replace mock API calls with actual Shopify client
- [ ] **Token Decryption**: Implement secure token decryption
- [ ] **AI Integration**: Connect to prompt system for copy generation
- [ ] **Session Auth**: Replace `x-workspace-id` header with session-based auth

### Medium Priority

- [ ] **Email Provider**: Add Postmark/SendGrid integration
- [ ] **Customer Segmentation**: Implement recipient query system
- [ ] **Auto-Restore**: Schedule job for `restore_at` on paused products
- [ ] **Webhook Notifications**: Notify on execution success/failure
- [ ] **Rate Limit Handling**: Respect Shopify API throttling

### Low Priority

- [ ] **Bulk Operations**: Approve/rollback multiple drafts
- [ ] **Draft Templates**: Save/reuse common configurations
- [ ] **Execution History**: Visual timeline in UI
- [ ] **Confidence Integration**: Feed execution outcomes to learning loop

---

## Security Considerations

1. **Workspace Isolation**: All queries filtered by `workspace_id`
2. **Token Encryption**: Shopify tokens encrypted at rest
3. **Input Validation**: Zod schemas on all inputs
4. **CSRF Protection**: Required for state-changing routes
5. **Audit Logging**: All approvals and executions logged
6. **No PII in Logs**: Customer emails not logged in execution records

---

## File Reference

| File | Purpose | Exports |
|------|---------|---------|
| `types.ts` | Type definitions, enums, schemas | All types, enums, helpers |
| `drafts/create.ts` | Draft generation | `createDraftForOpportunity` |
| `drafts/edit.ts` | Draft updates | `updateDraft`, `getDraftForEdit` |
| `drafts/approve.ts` | Approval flow | `approveDraft`, `rejectDraft` |
| `execute/discount.ts` | Shopify discounts | `executeDiscount`, `rollbackDiscount` |
| `execute/pause-product.ts` | Shopify product pause | `executePauseProduct`, `rollbackPauseProduct` |
| `execute/email.ts` | Email sending | `executeEmail`, `rollbackEmail` |
| `execution-engine.ts` | Orchestration | `executeAction`, `getExecutionStatus`, `listExecutions` |
| `rollback.ts` | Rollback system | `rollbackExecution`, `getRollbackHistory` |
| `index.ts` | Central export | All public functions |

---

## Example: Full Lifecycle

```typescript
// 1. Opportunity detected
const opportunity = await createOpportunity({...});

// 2. Create draft
const draft = await createDraftForOpportunity({
  workspaceId: "ws_123",
  opportunityId: opportunity.id,
  operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
  executionType: ExecutionType.DISCOUNT_DRAFT,
});

// 3. User edits title and value
await updateDraft({
  workspaceId: "ws_123",
  draftId: draft.draftId,
  updates: {
    title: "Winter Clearance - 25% Off",
    value: 25,
  },
});

// 4. User approves
const approval = await approveDraft({
  workspaceId: "ws_123",
  draftId: draft.draftId,
});

// 5. Execution runs (automatic)
// - Creates Shopify price rule
// - Creates discount code
// - Updates execution record

// 6. Check status
const status = await getExecutionStatus({
  workspaceId: "ws_123",
  executionId: approval.executionId,
});

console.log(status.status); // "succeeded"
console.log(status.providerResponse.discountCode.code); // "SAVE3F2A1B"

// 7. If needed, rollback
await rollbackExecution({
  workspaceId: "ws_123",
  executionId: approval.executionId,
  reason: "Merchant changed mind",
});
```

---

## Beta Readiness Criteria

From CLAUDE.md Section E (Actions):

- [x] Draft first, editable, previewable
- [x] Approval required for execution
- [x] Execution idempotent with immutable logs
- [x] Failure modes visible and actionable
- [x] Payload validation (Zod + server)
- [x] Inline editing of safe fields
- [x] Editable fields configurable per type
- [x] Operator intent wording stable
- [x] No partial executions
- [x] Rollback behavior documented

**Status**: ✅ **Ready for integration testing**

Next steps:
1. Add Shopify SDK integration
2. Implement BullMQ job queue
3. Write integration tests
4. Add E2E coverage
5. Connect to opportunity engine
