-- Migration: add_klaviyo_connection
-- Adds KlaviyoConnection model for storing encrypted Klaviyo API keys
-- and connection metadata per workspace.

-- Add klaviyo_segment_sync to ExecutionType enum
ALTER TYPE "ExecutionType" ADD VALUE IF NOT EXISTS 'klaviyo_segment_sync';

-- CreateTable
CREATE TABLE "klaviyo_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),

    CONSTRAINT "klaviyo_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "klaviyo_connections_workspace_id_key" ON "klaviyo_connections"("workspace_id");

-- AddForeignKey
ALTER TABLE "klaviyo_connections"
    ADD CONSTRAINT "klaviyo_connections_workspace_id_fkey"
    FOREIGN KEY ("workspace_id")
    REFERENCES "Workspace"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
