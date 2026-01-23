# MerchOps Database Schema

Complete PostgreSQL database schema for MerchOps Beta MVP using Prisma ORM.

## Architecture Overview

The schema is designed around these core principles:

1. **Immutability for Audit Trail**: Events and Executions are append-only
2. **Strict Multi-Tenancy**: All data scoped to workspace_id
3. **Explicit Lineage**: Every opportunity traces to events, every execution to drafts
4. **Deterministic Replay**: Event deduplication and execution idempotency
5. **Learning Loop**: Outcomes computed from executions to build confidence

## Schema Organization

### Tenancy Layer
- `workspaces` - 1:1 with Shopify store (MVP constraint)
- `users` - Belongs to workspace

### Integration Layer
- `shopify_connections` - OAuth tokens (encrypted), scopes, status
- `shopify_objects_cache` - Denormalized Shopify data with versioning

### Event Store (Immutable)
- `events` - Server-computed events with deduplication
- Indexed by workspace, type, occurred_at for fast queries

### Opportunity Engine
- `opportunities` - Ranked suggestions with why_now, counterfactual, decay
- `opportunity_event_links` - Many-to-many link to triggering events

### Action Layer
- `action_drafts` - Editable drafts with operator intent
- Payload and editable_fields stored as JSON for flexibility

### Execution Layer (Immutable)
- `executions` - Immutable execution logs with idempotency
- Stores request payload and provider response for full auditability

### Learning Loop
- `outcomes` - Helped/neutral/hurt classification with evidence
- Links back to execution for full traceability

### AI Audit
- `ai_generations` - Prompt version, inputs, outputs, latency tracking

## Key Design Decisions

### UUIDs for IDs
All primary keys use UUIDs for distributed generation safety and non-sequential IDs.

### JSON Fields
Strategic use of JSON for:
- Event payloads (event-type specific data)
- Opportunity evidence
- Action payloads (execution-type specific)
- Editable fields metadata
- Outcome evidence

This provides flexibility while maintaining queryability on structured fields.

### Immutability
Events and Executions have no `updated_at` field - they are append-only for audit integrity.

### Indexes
Performance-critical indexes:
- All workspace_id foreign keys
- Event deduplication (workspace_id + dedupe_key unique)
- Execution idempotency (idempotency_key unique)
- Time-series queries (created_at, occurred_at, synced_at)
- State transitions (opportunity.state, execution.status)

### Cascading Deletes
Workspace deletion cascades to all related data, maintaining referential integrity.

## Enums

### OpportunityState
`new → viewed → (approved → executed → resolved) | dismissed | expired`

State machine ensures opportunities flow through approval before execution.

### ActionDraftState
`draft → edited → approved | rejected → executed`

Tracks editing history and approval status.

### ExecutionStatus
`pending → running → succeeded | failed | retrying`

Clear execution lifecycle with retry support.

### OutcomeType
`helped | neutral | hurt`

Simple ternary classification for learning loop.

## Migration Workflow

### Initial Setup
```bash
# Generate Prisma Client
pnpm prisma generate

# Create initial migration
pnpm prisma migrate dev --name init

# Apply migrations
pnpm prisma migrate deploy
```

### Making Schema Changes

1. **Edit schema.prisma**
   - Add new fields, models, or enums
   - Update indexes if query patterns change

2. **Create migration**
   ```bash
   pnpm prisma migrate dev --name descriptive_migration_name
   ```

3. **Review migration SQL**
   - Check generated SQL in `prisma/migrations/`
   - Verify no data loss or unexpected changes

4. **Test migration**
   - Run against test database
   - Verify data integrity
   - Test rollback if needed

5. **Deploy to production**
   ```bash
   pnpm prisma migrate deploy
   ```

### Migration Best Practices

- **One logical change per migration**: Makes rollback easier
- **Test with real data volume**: Some indexes take time on large tables
- **Use transactions**: Prisma migrations are atomic by default
- **Backup before deploy**: Always have rollback plan
- **No manual schema drift**: Always use migrations, never manual SQL

## Database Constraints

### Unique Constraints
- `users.email` - One email per user
- `shopify_connections.workspace_id` - One Shopify connection per workspace (MVP)
- `shopify_objects_cache.[workspace_id, object_type, shopify_id]` - One cached object per Shopify ID
- `events.[workspace_id, dedupe_key]` - Prevents duplicate events
- `executions.idempotency_key` - Prevents duplicate executions
- `outcomes.execution_id` - One outcome per execution

### Foreign Key Constraints
All relations use foreign keys with CASCADE delete for workspace cleanup.

## Query Patterns

### Multi-Tenant Isolation
```typescript
// Always scope by workspace_id
const opportunities = await prisma.opportunity.findMany({
  where: {
    workspace_id: workspaceId,
    state: 'new',
  },
});
```

### Event Deduplication
```typescript
// Check before creating
const exists = await prisma.event.findUnique({
  where: {
    workspace_id_dedupe_key: {
      workspace_id: workspaceId,
      dedupe_key: dedupeKey,
    },
  },
});
```

### Execution Idempotency
```typescript
// Try to find existing execution first
const existing = await prisma.execution.findUnique({
  where: { idempotency_key: key },
});

if (existing) {
  return existing; // Already executed
}
```

### Opportunity with Events
```typescript
const opportunity = await prisma.opportunity.findUnique({
  where: { id: opportunityId },
  include: {
    event_links: {
      include: {
        event: true,
      },
    },
  },
});
```

### Execution with Full Context
```typescript
const execution = await prisma.execution.findUnique({
  where: { id: executionId },
  include: {
    action_draft: {
      include: {
        opportunity: {
          include: {
            event_links: {
              include: { event: true },
            },
          },
        },
      },
    },
    outcome: true,
  },
});
```

## Performance Considerations

### Index Coverage
All common query patterns have supporting indexes:
- Workspace scoped queries: `workspace_id` index
- Time-series queries: `created_at`, `occurred_at` indexes
- State filtering: `state`, `status` indexes
- Deduplication: Unique composite indexes

### JSON Field Querying
For complex JSON queries, consider:
```typescript
// Use jsonPath for deep queries
await prisma.event.findMany({
  where: {
    payload_json: {
      path: ['product_id'],
      equals: '12345',
    },
  },
});
```

### Connection Pooling
Prisma Client uses connection pooling by default:
- Development: 10 connections
- Production: Configure via DATABASE_URL

## Monitoring

Key metrics to track:
- Event deduplication hit rate
- Execution idempotency hit rate
- Query latency by table
- Migration duration
- Database size growth

## Backup and Recovery

### Backup Strategy
1. **Daily automated backups** of entire database
2. **Point-in-time recovery** capability
3. **Pre-migration backups** before schema changes
4. **Test restore** procedure quarterly

### Data Retention
- Events: Indefinite (immutable audit log)
- Executions: Indefinite (immutable audit log)
- Opportunities: Expire via `decay_at`, but keep historical
- AI Generations: Retain for prompt improvement analysis

## Security

### Encryption
- Shopify access tokens: Encrypted at application layer before storage
- Sensitive PII: Minimal collection, encrypted at rest

### Access Control
- No direct database access for application users
- All queries scoped by workspace_id
- Admin queries require elevated permissions

### Audit Trail
Complete audit capability via:
- Event immutability
- Execution immutability
- AI generation logging
- Opportunity state transitions

## Troubleshooting

### Migration Failures
```bash
# Check migration status
pnpm prisma migrate status

# Resolve failed migration
pnpm prisma migrate resolve --rolled-back "migration_name"

# Reset database (DEVELOPMENT ONLY)
pnpm prisma migrate reset
```

### Schema Drift
```bash
# Detect drift
pnpm prisma db pull

# Compare with schema.prisma
# Fix drift with new migration
```

### Performance Issues
```bash
# Analyze query performance
EXPLAIN ANALYZE <your-query>

# Check index usage
SELECT * FROM pg_stat_user_indexes;
```

## Future Considerations

### Scalability
- Partition events table by workspace_id or time
- Read replicas for reporting queries
- Archive old opportunities and executions

### Multi-Store Support
- Remove unique constraint on shopify_connections.workspace_id
- Add workspace roles and permissions
- Implement row-level security

### Observability
- Add query tracing
- Slow query logging
- Connection pool monitoring
