-- MerchOps Initial Migration
-- Creates all tables, enums, indexes, and foreign keys for the complete schema

-- CreateEnum
CREATE TYPE "OpportunityState" AS ENUM ('new', 'viewed', 'approved', 'executed', 'resolved', 'dismissed', 'expired');

-- CreateEnum
CREATE TYPE "ActionDraftState" AS ENUM ('draft', 'edited', 'approved', 'executing', 'executed', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'retrying');

-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('helped', 'neutral', 'hurt');

-- CreateEnum
CREATE TYPE "PriorityBucket" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "OperatorIntent" AS ENUM ('reduce_inventory_risk', 'reengage_dormant_customers', 'protect_margin');

-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('discount_draft', 'winback_email_draft', 'pause_product');

-- CreateEnum
CREATE TYPE "ShopifyConnectionStatus" AS ENUM ('active', 'revoked', 'error');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('inventory_threshold_crossed', 'product_out_of_stock', 'product_back_in_stock', 'velocity_spike', 'customer_inactivity_threshold', 'order_created', 'order_paid', 'product_created', 'product_updated');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('webhook', 'scheduled_job', 'api_sync', 'computed', 'manual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('trial', 'starter', 'growth', 'pro');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyConnection" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "store_domain" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" "ShopifyConnectionStatus" NOT NULL DEFAULT 'active',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "ShopifyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyObjectCache" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "shopify_id" TEXT NOT NULL,
    "data_json" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifyObjectCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload_json" JSONB NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "source" "EventSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority_bucket" "PriorityBucket" NOT NULL,
    "why_now" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "impact_range" TEXT NOT NULL,
    "counterfactual" TEXT NOT NULL,
    "decay_at" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "state" "OpportunityState" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEventLink" (
    "opportunity_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,

    CONSTRAINT "OpportunityEventLink_pkey" PRIMARY KEY ("opportunity_id","event_id")
);

-- CreateTable
CREATE TABLE "ActionDraft" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "operator_intent" "OperatorIntent" NOT NULL,
    "execution_type" "ExecutionType" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "editable_fields_json" JSONB NOT NULL,
    "state" "ActionDraftState" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "action_draft_id" TEXT NOT NULL,
    "request_payload_json" JSONB NOT NULL,
    "provider_response_json" JSONB,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'pending',
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "Execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "outcome" "OutcomeType" NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence_json" JSONB NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "inputs_json" JSONB NOT NULL,
    "outputs_json" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT,
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'trial',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "stripe_event_id" TEXT,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_created_at_idx" ON "Workspace"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_workspace_id_idx" ON "User"("workspace_id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyConnection_workspace_id_key" ON "ShopifyConnection"("workspace_id");

-- CreateIndex
CREATE INDEX "ShopifyConnection_workspace_id_idx" ON "ShopifyConnection"("workspace_id");

-- CreateIndex
CREATE INDEX "ShopifyConnection_status_idx" ON "ShopifyConnection"("status");

-- CreateIndex
CREATE INDEX "ShopifyConnection_store_domain_idx" ON "ShopifyConnection"("store_domain");

-- CreateIndex
CREATE INDEX "ShopifyObjectCache_workspace_id_object_type_idx" ON "ShopifyObjectCache"("workspace_id", "object_type");

-- CreateIndex
CREATE INDEX "ShopifyObjectCache_synced_at_idx" ON "ShopifyObjectCache"("synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyObjectCache_workspace_id_object_type_shopify_id_key" ON "ShopifyObjectCache"("workspace_id", "object_type", "shopify_id");

-- CreateIndex
CREATE INDEX "Event_workspace_id_type_idx" ON "Event"("workspace_id", "type");

-- CreateIndex
CREATE INDEX "Event_workspace_id_occurred_at_idx" ON "Event"("workspace_id", "occurred_at");

-- CreateIndex
CREATE INDEX "Event_created_at_idx" ON "Event"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Event_workspace_id_dedupe_key_key" ON "Event"("workspace_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "Opportunity_workspace_id_state_idx" ON "Opportunity"("workspace_id", "state");

-- CreateIndex
CREATE INDEX "Opportunity_workspace_id_priority_bucket_idx" ON "Opportunity"("workspace_id", "priority_bucket");

-- CreateIndex
CREATE INDEX "Opportunity_workspace_id_created_at_idx" ON "Opportunity"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "Opportunity_decay_at_idx" ON "Opportunity"("decay_at");

-- CreateIndex
CREATE INDEX "Opportunity_workspace_id_state_priority_bucket_idx" ON "Opportunity"("workspace_id", "state", "priority_bucket");

-- CreateIndex
CREATE INDEX "Opportunity_workspace_id_type_state_idx" ON "Opportunity"("workspace_id", "type", "state");

-- CreateIndex
CREATE INDEX "OpportunityEventLink_opportunity_id_idx" ON "OpportunityEventLink"("opportunity_id");

-- CreateIndex
CREATE INDEX "OpportunityEventLink_event_id_idx" ON "OpportunityEventLink"("event_id");

-- CreateIndex
CREATE INDEX "ActionDraft_workspace_id_state_idx" ON "ActionDraft"("workspace_id", "state");

-- CreateIndex
CREATE INDEX "ActionDraft_opportunity_id_idx" ON "ActionDraft"("opportunity_id");

-- CreateIndex
CREATE INDEX "ActionDraft_created_at_idx" ON "ActionDraft"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "Execution_idempotency_key_key" ON "Execution"("idempotency_key");

-- CreateIndex
CREATE INDEX "Execution_workspace_id_status_idx" ON "Execution"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "Execution_action_draft_id_idx" ON "Execution"("action_draft_id");

-- CreateIndex
CREATE INDEX "Execution_started_at_idx" ON "Execution"("started_at");

-- CreateIndex
CREATE INDEX "Execution_idempotency_key_idx" ON "Execution"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_execution_id_key" ON "Outcome"("execution_id");

-- CreateIndex
CREATE INDEX "Outcome_execution_id_idx" ON "Outcome"("execution_id");

-- CreateIndex
CREATE INDEX "Outcome_outcome_idx" ON "Outcome"("outcome");

-- CreateIndex
CREATE INDEX "Outcome_computed_at_idx" ON "Outcome"("computed_at");

-- CreateIndex
CREATE INDEX "AiGeneration_workspace_id_prompt_version_idx" ON "AiGeneration"("workspace_id", "prompt_version");

-- CreateIndex
CREATE INDEX "AiGeneration_created_at_idx" ON "AiGeneration"("created_at");

-- CreateIndex
CREATE INDEX "AiGeneration_model_idx" ON "AiGeneration"("model");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspace_id_key" ON "Subscription"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "Subscription"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_subscription_id_key" ON "Subscription"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "Subscription_stripe_customer_id_idx" ON "Subscription"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_plan_tier_idx" ON "Subscription"("plan_tier");

-- CreateIndex
CREATE INDEX "UsageRecord_subscription_id_period_start_idx" ON "UsageRecord"("subscription_id", "period_start");

-- CreateIndex
CREATE INDEX "UsageRecord_metric_idx" ON "UsageRecord"("metric");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_subscription_id_metric_period_start_key" ON "UsageRecord"("subscription_id", "metric", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_stripe_event_id_key" ON "BillingEvent"("stripe_event_id");

-- CreateIndex
CREATE INDEX "BillingEvent_subscription_id_idx" ON "BillingEvent"("subscription_id");

-- CreateIndex
CREATE INDEX "BillingEvent_event_type_idx" ON "BillingEvent"("event_type");

-- CreateIndex
CREATE INDEX "BillingEvent_created_at_idx" ON "BillingEvent"("created_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyConnection" ADD CONSTRAINT "ShopifyConnection_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyObjectCache" ADD CONSTRAINT "ShopifyObjectCache_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEventLink" ADD CONSTRAINT "OpportunityEventLink_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEventLink" ADD CONSTRAINT "OpportunityEventLink_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraft" ADD CONSTRAINT "ActionDraft_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraft" ADD CONSTRAINT "ActionDraft_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Execution" ADD CONSTRAINT "Execution_action_draft_id_fkey" FOREIGN KEY ("action_draft_id") REFERENCES "ActionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
