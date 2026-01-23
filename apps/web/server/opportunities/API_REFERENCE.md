# Opportunities Engine API Reference

Quick reference for all exported functions from the opportunities engine.

## Import

```typescript
import { ... } from '@/server/opportunities';
```

## Creation Functions

### createOpportunityFromEvents
```typescript
async function createOpportunityFromEvents(
  input: CreateOpportunityInput
): Promise<Opportunity>
```
Main entry point for creating opportunities from events.

### createOpportunitiesBatch
```typescript
async function createOpportunitiesBatch(
  inputs: CreateOpportunityInput[]
): Promise<Opportunity[]>
```
Batch create multiple opportunities.

### generateOpportunityExplanations
```typescript
async function generateOpportunityExplanations(
  input: OpportunityAiInput
): Promise<OpportunityAiOutput>
```
Generate AI explanations or use fallback templates.

## Prioritization Functions

### calculatePriority
```typescript
async function calculatePriority(
  input: PriorityInput
): Promise<PriorityScore>
```
Calculate deterministic priority score with factors.

### comparePriority
```typescript
function comparePriority(
  a: PriorityScore, 
  b: PriorityScore
): number
```
Compare two priority scores for sorting.

## Decay Functions

### getDecayTime
```typescript
function getDecayTime(
  opportunityType: OpportunityType
): Date
```
Get decay timestamp for opportunity type.

### checkDecay
```typescript
function checkDecay(
  opportunity: Opportunity
): { shouldExpire: boolean; reason?: string }
```
Check if opportunity should be expired.

### expireStaleOpportunities
```typescript
async function expireStaleOpportunities(
  prisma: PrismaClient
): Promise<{ count: number; expired_ids: string[] }>
```
Batch expire all stale opportunities (for scheduled job).

### expireStaleOpportunitiesForWorkspace
```typescript
async function expireStaleOpportunitiesForWorkspace(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ count: number; expired_ids: string[] }>
```
Expire stale opportunities for specific workspace.

### getDecayStats
```typescript
async function getDecayStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total_active: number;
  expiring_soon: number;
  expiring_this_week: number;
  average_hours_to_decay: number;
}>
```
Get decay statistics for analytics.

### getOpportunitiesExpiringSoon
```typescript
async function getOpportunitiesExpiringSoon(
  workspaceId: string,
  hoursThreshold: number = 24,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Get opportunities expiring within threshold.

### extendDecayTime
```typescript
async function extendDecayTime(
  opportunityId: string,
  additionalHours: number,
  prisma: PrismaClient
): Promise<Opportunity>
```
Extend decay time for an opportunity.

## State Machine Functions

### transitionState
```typescript
async function transitionState(
  opportunityId: string,
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<Opportunity>
```
Transition with validation (throws on invalid).

### tryTransitionState
```typescript
async function tryTransitionState(
  opportunityId: string,
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<{ success: boolean; opportunity?: Opportunity; error?: Error }>
```
Safe transition (no throw).

### batchTransitionState
```typescript
async function batchTransitionState(
  opportunityIds: string[],
  newState: OpportunityState,
  prisma: PrismaClient
): Promise<{
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}>
```
Batch state transition.

### State Helper Functions

```typescript
async function markAsViewed(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
async function markAsApproved(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
async function markAsExecuted(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
async function markAsResolved(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
async function markAsDismissed(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
async function markAsExpired(opportunityId: string, prisma: PrismaClient): Promise<Opportunity>
```

### getStateMachine
```typescript
async function getStateMachine(
  opportunityId: string,
  prisma: PrismaClient
): Promise<OpportunityStateMachine>
```
Get state machine instance for opportunity.

### getOpportunitiesByState
```typescript
async function getOpportunitiesByState(
  workspaceId: string,
  state: OpportunityState,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Query opportunities by state.

### countOpportunitiesByState
```typescript
async function countOpportunitiesByState(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Record<OpportunityState, number>>
```
Count distribution by state.

## Query Functions

### getOpportunityById
```typescript
async function getOpportunityById(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity | null>
```
Get single opportunity with workspace validation.

### getOpportunityWithEvents
```typescript
async function getOpportunityWithEvents(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<OpportunityWithEvents | null>
```
Get opportunity with linked events.

### getOpportunityWithRelations
```typescript
async function getOpportunityWithRelations(
  id: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<OpportunityWithRelations | null>
```
Get opportunity with events and action drafts.

### getOpportunitiesForWorkspace
```typescript
async function getOpportunitiesForWorkspace(
  workspaceId: string,
  query: OpportunityListQuery,
  prisma: PrismaClient
): Promise<{ opportunities: Opportunity[]; total: number }>
```
Filtered and paginated list.

### getActiveOpportunities
```typescript
async function getActiveOpportunities(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Get non-terminal state opportunities.

### getOpportunitiesByPriority
```typescript
async function getOpportunitiesByPriority(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Record<PriorityBucket, Opportunity[]>>
```
Group opportunities by priority bucket.

### getNewOpportunities
```typescript
async function getNewOpportunities(
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Get never-viewed opportunities.

### searchOpportunities
```typescript
async function searchOpportunities(
  workspaceId: string,
  searchText: string,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Text search in rationale/why_now/counterfactual.

### getOpportunityStats
```typescript
async function getOpportunityStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total: number;
  by_state: Record<OpportunityState, number>;
  by_priority: Record<PriorityBucket, number>;
  average_confidence: number;
}>
```
Complete statistics for workspace.

### getDismissedOpportunityKeys
```typescript
async function getDismissedOpportunityKeys(
  workspaceId: string,
  prisma: PrismaClient
): Promise<string[]>
```
Get all dismiss keys for workspace.

### paginateOpportunities
```typescript
async function paginateOpportunities(
  workspaceId: string,
  filters: OpportunityFilters,
  page: number = 1,
  pageSize: number = 20,
  prisma: PrismaClient
): Promise<PaginatedResult<Opportunity>>
```
Paginated results with metadata.

## Dismissal Functions

### dismissOpportunity
```typescript
async function dismissOpportunity(
  opportunityId: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ opportunity: Opportunity; dismiss_key: string }>
```
Dismiss opportunity and store key.

### dismissOpportunitiesBatch
```typescript
async function dismissOpportunitiesBatch(
  opportunityIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  succeeded: Array<{ id: string; dismiss_key: string }>;
  failed: Array<{ id: string; error: string }>;
}>
```
Batch dismissal with results.

### isDismissed
```typescript
async function isDismissed(
  opportunityType: string,
  eventIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<boolean>
```
Check if exact combination was dismissed.

### shouldFilterDismissed
```typescript
async function shouldFilterDismissed(
  opportunityType: string,
  eventIds: string[],
  workspaceId: string,
  prisma: PrismaClient
): Promise<{ should_filter: boolean; reason?: string }>
```
Check with material change detection.

### undismissOpportunity
```typescript
async function undismissOpportunity(
  opportunityId: string,
  workspaceId: string,
  prisma: PrismaClient
): Promise<Opportunity>
```
Restore dismissed opportunity to new state.

### getDismissalStats
```typescript
async function getDismissalStats(
  workspaceId: string,
  prisma: PrismaClient
): Promise<{
  total_dismissed: number;
  dismissed_by_type: Record<string, number>;
  dismissal_rate: number;
}>
```
Dismissal analytics for workspace.

### getRecentlyDismissed
```typescript
async function getRecentlyDismissed(
  workspaceId: string,
  days: number = 7,
  prisma: PrismaClient
): Promise<Opportunity[]>
```
Get recently dismissed opportunities.

### generateDismissKey
```typescript
function generateDismissKey(
  opportunityType: string, 
  eventIds: string[]
): string
```
Generate dismiss key from type + events.

### parseDismissKey
```typescript
function parseDismissKey(
  key: string
): { type: string; eventIds: string[] }
```
Extract components from dismiss key.

## Types

### OpportunityType
```typescript
enum OpportunityType {
  INVENTORY_CLEARANCE = 'inventory_clearance',
  STOCKOUT_PREVENTION = 'stockout_prevention',
  RESTOCK_NOTIFICATION = 'restock_notification',
  WINBACK_CAMPAIGN = 'winback_campaign',
  HIGH_VELOCITY_PROTECTION = 'high_velocity_protection',
}
```

### OpportunityState
```typescript
enum OpportunityState {
  new = 'new',
  viewed = 'viewed',
  approved = 'approved',
  executed = 'executed',
  resolved = 'resolved',
  dismissed = 'dismissed',
  expired = 'expired',
}
```

### PriorityBucket
```typescript
enum PriorityBucket {
  high = 'high',
  medium = 'medium',
  low = 'low',
}
```

### OperatorIntent
```typescript
enum OperatorIntent {
  reduce_inventory_risk = 'reduce_inventory_risk',
  reengage_dormant_customers = 'reengage_dormant_customers',
  protect_margin = 'protect_margin',
}
```

## Error Classes

### InvalidStateTransitionError
```typescript
class InvalidStateTransitionError extends Error {
  constructor(
    currentState: OpportunityState,
    targetState: OpportunityState,
    opportunityId: string
  )
}
```

### OpportunityNotFoundError
```typescript
class OpportunityNotFoundError extends Error {
  constructor(opportunityId: string)
}
```

## Classes

### OpportunityStateMachine
```typescript
class OpportunityStateMachine {
  canTransitionTo(newState: OpportunityState): boolean
  getValidNextStates(): OpportunityState[]
  isTerminal(): boolean
  validateTransition(newState: OpportunityState): void
}
```
