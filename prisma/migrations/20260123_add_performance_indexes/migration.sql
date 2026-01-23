-- Performance Optimization Migration
-- Adds composite indexes for common query patterns

-- CreateIndex: Composite index for workspace + state + priority queries
CREATE INDEX IF NOT EXISTS "Opportunity_workspace_id_state_priority_bucket_idx" ON "Opportunity"("workspace_id", "state", "priority_bucket");

-- CreateIndex: Composite index for workspace + type + state queries
CREATE INDEX IF NOT EXISTS "Opportunity_workspace_id_type_state_idx" ON "Opportunity"("workspace_id", "type", "state");
