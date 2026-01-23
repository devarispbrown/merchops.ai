# Learning Loop Quick Reference

## Common Imports

```typescript
// Types
import { OutcomeType, type ConfidenceScore, type OutcomeEvidence } from '@/server/learning';

// Outcome computation
import { computeOutcome, isExecutionReadyForOutcome } from '@/server/learning';

// Confidence
import { calculateConfidence, getConfidenceLevel } from '@/server/learning';

// Queries
import { getOutcomeForExecution, getRecentTrackRecord } from '@/server/learning';
```

## Quick Examples

### Compute an Outcome

```typescript
import { computeOutcome } from '@/server/learning';

const result = await computeOutcome('exec-123');
// Returns: { outcome: OutcomeType, evidence: OutcomeEvidence, computed_at: Date }
```

### Check if Ready for Outcome

```typescript
import { isExecutionReadyForOutcome } from '@/server/learning';

const isReady = await isExecutionReadyForOutcome('exec-123');
// Returns: boolean (true if observation window has passed)
```

### Get Outcome Details

```typescript
import { getOutcomeForExecution } from '@/server/learning';

const outcome = await getOutcomeForExecution('exec-123');
// Returns: Full outcome with evidence and execution details
```

### Calculate Confidence

```typescript
import { calculateConfidence } from '@/server/learning';

const score = await calculateConfidence('ws-123', 'reduce_inventory_risk');
// Returns: ConfidenceScore with score, trend, and breakdown
```

### Get Track Record

```typescript
import { getRecentTrackRecord } from '@/server/learning';

const record = await getRecentTrackRecord('ws-123', 'reengage_dormant_customers', 20);
// Returns: TrackRecord with success/harm rates and recent outcomes
```

## Outcome Types

```typescript
OutcomeType.HELPED   // Positive impact (above helped threshold)
OutcomeType.NEUTRAL  // Minimal impact (within neutral zone)
OutcomeType.HURT     // Negative impact (below hurt threshold)
```

## Thresholds by Execution Type

| Execution Type | Observation Window | Baseline Window | Helped Threshold | Hurt Threshold | Primary Metric |
|----------------|-------------------|-----------------|------------------|----------------|----------------|
| discount_draft | 7 days | 14 days | +10% | -5% | Revenue |
| winback_email_draft | 14 days | 30 days | +5% | -2% | Conversion rate |
| pause_product | 14 days | 30 days | -15% | +10% | Stockout frequency |

## Confidence Score Ranges

```typescript
0-40   → 'Low'      // Insufficient data or poor track record
41-70  → 'Medium'   // Mixed results
71-100 → 'High'     // Consistent success
```

## Confidence Trends

```typescript
'improving'  // Later success rate > earlier by 10%+
'stable'     // Within ±10%
'declining'  // Later success rate < earlier by 10%+
```

## API Endpoints

```bash
# List outcomes
GET /api/outcomes?limit=50&operator_intent=reduce_inventory_risk

# Single outcome
GET /api/outcomes/[executionId]

# Override outcome (admin)
POST /api/outcomes/[executionId]
Body: { outcome: "helped", evidence: {...}, reason: "..." }

# Confidence scores
GET /api/confidence?operator_intent=reduce_inventory_risk
```

## Background Job

```typescript
import { computeOutcomesJob } from '@/server/jobs/compute-outcomes';

// Run manually
await computeOutcomesJob();

// Schedule (daily at 2 AM)
scheduler.add('compute-outcomes', '0 2 * * *', computeOutcomesJob);
```

## Evidence Structure

```typescript
interface OutcomeEvidence {
  baseline_window: { start: Date; end: Date; metric_name: string; value: number };
  observation_window: { start: Date; end: Date; metric_name: string; value: number };
  baseline_value: number;
  observed_value: number;
  delta: number;
  delta_percentage: number;
  helped_threshold: number;
  hurt_threshold: number;
  sample_size?: number;
  notes?: string;
}
```

## Debugging

```typescript
// Check executions ready for outcome
import { getExecutionsReadyForOutcome } from '@/server/learning';
const ready = await getExecutionsReadyForOutcome('ws-123', 10);

// Get workspace statistics
import { getOutcomeStatistics } from '@/server/learning';
const stats = await getOutcomeStatistics('ws-123');

// Get job statistics
import { getOutcomeJobStatistics } from '@/server/jobs/compute-outcomes';
const jobStats = await getOutcomeJobStatistics();
```

## Common Patterns

### Display Confidence in UI

```typescript
import { calculateConfidence, getConfidenceLevel, getConfidenceExplanation } from '@/server/learning';

const confidence = await calculateConfidence(workspaceId, operatorIntent);
const level = getConfidenceLevel(confidence.score); // "High", "Medium", "Low"
const explanation = getConfidenceExplanation(confidence); // Human-readable text

return (
  <div>
    <Badge variant={level}>{level} Confidence</Badge>
    <p>{confidence.score}/100</p>
    <p>{explanation}</p>
  </div>
);
```

### Show Recent Track Record

```typescript
import { getRecentTrackRecord } from '@/server/learning';

const record = await getRecentTrackRecord(workspaceId, operatorIntent);

return (
  <div>
    <p>Success Rate: {(record.success_rate * 100).toFixed(1)}%</p>
    <p>Recent Executions: {record.total_executions}</p>
    <ul>
      <li>{record.helped_count} helped</li>
      <li>{record.neutral_count} neutral</li>
      <li>{record.hurt_count} hurt</li>
    </ul>
  </div>
);
```

### Manual Outcome Computation

```typescript
import { computeOutcomeForExecution } from '@/server/jobs/compute-outcomes';

// Trigger outcome computation manually
const result = await computeOutcomeForExecution(executionId);

if (result.success) {
  console.log('Outcome:', result.outcome);
} else {
  console.error('Error:', result.error);
}
```

## Testing

```typescript
// Mock outcome evidence for tests
const mockEvidence: OutcomeEvidence = {
  baseline_window: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-14'),
    metric_name: 'revenue',
    value: 1000,
  },
  observation_window: {
    start: new Date('2024-01-15'),
    end: new Date('2024-01-22'),
    metric_name: 'revenue',
    value: 1200,
  },
  baseline_value: 1000,
  observed_value: 1200,
  delta: 200,
  delta_percentage: 0.2,
  helped_threshold: 0.1,
  hurt_threshold: -0.05,
  sample_size: 50,
};

// Test confidence calculation
import { getConfidenceLevel } from '@/server/learning';
expect(getConfidenceLevel(75)).toBe('High');
expect(getConfidenceLevel(50)).toBe('Medium');
expect(getConfidenceLevel(30)).toBe('Low');
```

## Performance Tips

1. **Batch queries** - Use `getOutcomesForWorkspace` with pagination instead of individual queries
2. **Cache confidence** - Confidence scores change slowly, can cache for 1 hour
3. **Index queries** - All queries use indexed fields (workspace_id, created_at)
4. **Limit recent outcomes** - Default to last 20 executions, don't fetch more unnecessarily

## Error Handling

```typescript
try {
  const outcome = await computeOutcome(executionId);
  if (!outcome) {
    // Execution not ready or already computed
    console.warn('Outcome not computed:', executionId);
  }
} catch (error) {
  // Log error but don't block
  console.error('Error computing outcome:', error);
  // Continue processing other executions
}
```

## Multi-Tenant Safety

All queries are automatically scoped to workspace:

```typescript
// ✅ Safe - workspace_id required
await getOutcomesForWorkspace(workspaceId, { ... });

// ✅ Safe - execution belongs to workspace
await getOutcomeForExecution(executionId); // Joins to execution.workspace_id

// ✅ Safe - confidence scoped to workspace
await calculateConfidence(workspaceId, operatorIntent);
```

---

**For full documentation, see**: `/apps/web/server/learning/README.md`
**For implementation details, see**: `/LEARNING_LOOP_IMPLEMENTATION.md`
