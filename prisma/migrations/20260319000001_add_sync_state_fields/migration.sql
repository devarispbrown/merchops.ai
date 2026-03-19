-- Migration: add_sync_state_fields
-- Adds sync_state and last_synced_at to ShopifyConnection so the BullMQ
-- sync worker can track progress without overloading the status enum.

ALTER TABLE "ShopifyConnection" ADD COLUMN "sync_state" TEXT;
ALTER TABLE "ShopifyConnection" ADD COLUMN "last_synced_at" TIMESTAMP(3);
