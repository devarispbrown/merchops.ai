-- Migration: add_confidence_scores
-- Adds the confidence_scores table to persist historical confidence score
-- records per workspace and operator intent.

-- CreateTable
CREATE TABLE "confidence_scores" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "operator_intent" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confidence_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "confidence_scores_workspace_id_operator_intent_computed_at_idx" ON "confidence_scores"("workspace_id", "operator_intent", "computed_at");

-- AddForeignKey
ALTER TABLE "confidence_scores" ADD CONSTRAINT "confidence_scores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
