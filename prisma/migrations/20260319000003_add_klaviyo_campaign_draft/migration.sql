-- Migration: add_klaviyo_campaign_draft
-- Adds klaviyo_campaign_draft to the ExecutionType enum.
-- This supports creating Klaviyo email campaign drafts as a new execution type.
-- Campaigns are always created in DRAFT status — they are never auto-sent.

ALTER TYPE "ExecutionType" ADD VALUE IF NOT EXISTS 'klaviyo_campaign_draft';
