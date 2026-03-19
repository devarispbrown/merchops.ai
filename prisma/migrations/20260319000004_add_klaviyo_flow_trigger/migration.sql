-- Migration: 20260319000004_add_klaviyo_flow_trigger
-- Adds klaviyo_flow_trigger to the ExecutionType enum.
-- Klaviyo flow enrollment is triggered by creating metric events via the
-- Klaviyo Events API, which causes profiles matching the metric to enter
-- the associated flow.

ALTER TYPE "ExecutionType" ADD VALUE 'klaviyo_flow_trigger';
