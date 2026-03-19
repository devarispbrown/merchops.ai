-- Migration: Add shopify_email_draft to ExecutionType enum
-- This value supports the Shopify Email draft executor which creates
-- email marketing activity drafts via the Shopify Admin GraphQL API.
-- Drafts are always created with DRAFT status — merchants review and
-- send from the Shopify admin. This executor never triggers a live send.

ALTER TYPE "ExecutionType" ADD VALUE IF NOT EXISTS 'shopify_email_draft';
