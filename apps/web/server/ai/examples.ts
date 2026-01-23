/**
 * MerchOps AI Prompt System - Usage Examples
 *
 * Demonstrates how to use the prompt system in real scenarios.
 */

import type { PrismaClient } from "@prisma/client";
import { generateAndLog, generateBatch, getGenerationHistory, getTokenStats } from "./generate";
import {
  opportunityRationalePrompt,
  discountCopyPrompt,
  winbackEmailPrompt,
  type OpportunityRationaleInput,
  type DiscountCopyInput,
  type WinbackEmailInput,
} from "@merchops/shared/prompts";

/**
 * Example 1: Generate opportunity rationale for inventory clearance
 */
export async function exampleOpportunityRationale(
  workspaceId: string,
  prisma: PrismaClient
) {
  const input: OpportunityRationaleInput = {
    workspaceId,
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary:
      "Product 'Winter Jacket XL' inventory dropped below threshold. Current: 12 units, Velocity: 8 units/14 days",
    storeContext: {
      storeName: "Mountain Gear Co",
      productName: "Winter Jacket XL",
      currentInventory: 12,
      velocityLast14Days: 8,
    },
    timeWindow: {
      startDate: "2026-01-10",
      endDate: "2026-01-23",
    },
  };

  const output = await generateAndLog(opportunityRationalePrompt, input, prisma);

  console.log("=== Opportunity Rationale ===");
  console.log("Rationale:", output.rationale);
  console.log("Why Now:", output.why_now);
  console.log("Counterfactual:", output.counterfactual);
  console.log("Impact Range:", output.impact_range || "N/A");

  return output;
}

/**
 * Example 2: Generate discount copy for multiple products
 */
export async function exampleBatchDiscountCopy(workspaceId: string, prisma: PrismaClient) {
  const inputs: DiscountCopyInput[] = [
    {
      workspaceId,
      productName: "Winter Jacket XL",
      discountPercent: 20,
      urgencyLevel: "medium",
      storeName: "Mountain Gear Co",
      inventoryRemaining: 12,
      expiryDate: "2026-02-01",
      context: "End of season clearance",
    },
    {
      workspaceId,
      productName: "Hiking Boots",
      discountPercent: 15,
      urgencyLevel: "low",
      storeName: "Mountain Gear Co",
      inventoryRemaining: 45,
    },
    {
      workspaceId,
      productName: "Camping Tent",
      discountPercent: 25,
      urgencyLevel: "high",
      storeName: "Mountain Gear Co",
      inventoryRemaining: 3,
      expiryDate: "2026-01-31",
      context: "Last 3 units",
    },
  ];

  const outputs = await generateBatch(discountCopyPrompt, inputs, prisma);

  console.log("=== Batch Discount Copy ===");
  outputs.forEach((output, i) => {
    console.log(`\n--- Product ${i + 1}: ${inputs[i].productName} ---`);
    console.log("Subject:", output.subject_line);
    console.log("Body:", output.body_copy);
    console.log("CTA:", output.cta_text);
  });

  return outputs;
}

/**
 * Example 3: Generate win-back email for dormant customer
 */
export async function exampleWinbackEmail(workspaceId: string, prisma: PrismaClient) {
  const input: WinbackEmailInput = {
    workspaceId,
    customerName: "Sarah Johnson",
    lastPurchaseDate: "2025-10-15",
    daysSinceLastPurchase: 90,
    recommendedProducts: ["New Winter Collection", "Fleece Pullover", "Thermal Leggings"],
    storeName: "Mountain Gear Co",
    previousPurchaseCategory: "Winter Apparel",
    incentivePercent: 15,
  };

  const output = await generateAndLog(winbackEmailPrompt, input, prisma);

  console.log("=== Win-back Email ===");
  console.log("Subject:", output.subject);
  console.log("Body:", output.body);
  console.log("CTA:", output.cta);
  console.log("Personalization:", output.personalization_notes);

  return output;
}

/**
 * Example 4: View generation history and stats
 */
export async function exampleAuditTrail(workspaceId: string, prisma: PrismaClient) {
  // Get recent generation history
  const history = await getGenerationHistory(workspaceId, prisma, {
    limit: 10,
  });

  console.log("=== Generation History ===");
  history.forEach((gen) => {
    console.log(`\n[${gen.created_at?.toISOString()}]`);
    console.log(`Prompt: ${gen.prompt_version}`);
    console.log(`Model: ${gen.model}`);
    console.log(`Tokens: ${gen.tokens}`);
    console.log(`Latency: ${gen.latency_ms}ms`);
  });

  // Get token usage statistics
  const stats = await getTokenStats(workspaceId, prisma, {
    start: new Date("2026-01-01"),
    end: new Date("2026-01-31"),
  });

  console.log("\n=== Token Usage Statistics (January 2026) ===");
  console.log(`Total Generations: ${stats.total_generations}`);
  console.log(`Total Tokens: ${stats.total_tokens}`);
  console.log(`Avg Tokens/Generation: ${stats.avg_tokens_per_generation.toFixed(1)}`);
  console.log(`Avg Latency: ${stats.avg_latency_ms.toFixed(0)}ms`);
  console.log(`Fallback Rate: ${(stats.fallback_rate * 100).toFixed(1)}%`);

  return { history, stats };
}

/**
 * Example 5: Using fallbacks directly (for testing or when AI is disabled)
 */
export function exampleDirectFallback() {
  console.log("=== Direct Fallback Usage ===");

  // Use fallback generator directly
  const output = opportunityRationalePrompt.fallbackGenerator({
    workspaceId: "test-workspace",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Inventory threshold crossed",
    storeContext: {
      productName: "Test Product",
      currentInventory: 8,
    },
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  });

  console.log("Rationale:", output.rationale);
  console.log("Why Now:", output.why_now);
  console.log("Counterfactual:", output.counterfactual);
  console.log("\nNote: This used deterministic template, no AI calls made");

  return output;
}

/**
 * Example 6: Complete opportunity creation flow
 */
export async function exampleCompleteOpportunityFlow(
  workspaceId: string,
  prisma: PrismaClient
) {
  console.log("=== Complete Opportunity Flow ===");

  // Step 1: Generate rationale
  const rationale = await generateAndLog(
    opportunityRationalePrompt,
    {
      workspaceId,
      opportunityType: "inventory_clearance",
      operatorIntent: "reduce_inventory_risk",
      eventsSummary: "Inventory threshold crossed for Winter Jacket XL",
      storeContext: {
        productName: "Winter Jacket XL",
        currentInventory: 12,
        velocityLast14Days: 8,
      },
      timeWindow: {
        startDate: "2026-01-10",
        endDate: "2026-01-23",
      },
    },
    prisma
  );

  // Step 2: Create opportunity in database
  const opportunity = await prisma.opportunity.create({
    data: {
      workspace_id: workspaceId,
      type: "inventory_clearance",
      priority_bucket: "high",
      rationale: rationale.rationale,
      why_now: rationale.why_now,
      counterfactual: rationale.counterfactual,
      impact_range: rationale.impact_range || "8-12 units",
      confidence: 0.75,
      decay_at: new Date("2026-01-31"),
    },
  });

  console.log("Opportunity created:", opportunity.id);

  // Step 3: Generate discount copy for action draft
  const discountCopy = await generateAndLog(
    discountCopyPrompt,
    {
      workspaceId,
      productName: "Winter Jacket XL",
      discountPercent: 20,
      urgencyLevel: "medium",
      inventoryRemaining: 12,
      expiryDate: "2026-02-01",
    },
    prisma
  );

  // Step 4: Create action draft
  const actionDraft = await prisma.actionDraft.create({
    data: {
      workspace_id: workspaceId,
      opportunity_id: opportunity.id,
      operator_intent: "reduce_inventory_risk",
      execution_type: "discount_draft",
      payload_json: {
        subject: discountCopy.subject_line,
        body: discountCopy.body_copy,
        cta: discountCopy.cta_text,
        discount_percent: 20,
        product_name: "Winter Jacket XL",
      },
      editable_fields_json: ["subject", "body", "cta", "discount_percent"],
    },
  });

  console.log("Action draft created:", actionDraft.id);

  return {
    opportunity,
    actionDraft,
    rationale,
    discountCopy,
  };
}

/**
 * Example 7: Error handling and fallback scenarios
 */
export async function exampleErrorHandling(workspaceId: string, prisma: PrismaClient) {
  console.log("=== Error Handling Examples ===");

  try {
    // Even if AI fails, this will use fallback and succeed
    const output = await generateAndLog(
      opportunityRationalePrompt,
      {
        workspaceId,
        opportunityType: "test",
        operatorIntent: "reduce_inventory_risk",
        eventsSummary: "Test event",
        timeWindow: {
          startDate: "2026-01-01",
          endDate: "2026-01-15",
        },
      },
      prisma
    );

    console.log("Generation succeeded (likely used fallback)");
    console.log("Output:", output);

    // Check if fallback was used
    const lastGeneration = await prisma.aiGeneration.findFirst({
      where: { workspace_id: workspaceId },
      orderBy: { created_at: "desc" },
    });

    if (lastGeneration?.model === "fallback-template") {
      console.log("✓ Fallback was used successfully");
    } else {
      console.log("✓ AI generation was successful");
    }
  } catch (error) {
    console.error("Generation failed:", error);
  }
}

/**
 * Example usage script
 * Run with: npx tsx apps/web/server/ai/examples.ts
 */
export async function runAllExamples(workspaceId: string, prisma: PrismaClient) {
  console.log("\n🚀 MerchOps AI Prompt System Examples\n");

  await exampleOpportunityRationale(workspaceId, prisma);
  console.log("\n" + "=".repeat(60) + "\n");

  await exampleBatchDiscountCopy(workspaceId, prisma);
  console.log("\n" + "=".repeat(60) + "\n");

  await exampleWinbackEmail(workspaceId, prisma);
  console.log("\n" + "=".repeat(60) + "\n");

  await exampleAuditTrail(workspaceId, prisma);
  console.log("\n" + "=".repeat(60) + "\n");

  exampleDirectFallback();
  console.log("\n" + "=".repeat(60) + "\n");

  await exampleCompleteOpportunityFlow(workspaceId, prisma);
  console.log("\n" + "=".repeat(60) + "\n");

  await exampleErrorHandling(workspaceId, prisma);

  console.log("\n✅ All examples completed!\n");
}
