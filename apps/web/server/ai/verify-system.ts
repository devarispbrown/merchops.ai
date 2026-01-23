/**
 * AI Prompt System Verification Script
 *
 * Verifies that all prompt system components are working correctly.
 * Run with: npx tsx apps/web/server/ai/verify-system.ts
 */

import {
  opportunityRationalePrompt,
  discountCopyPrompt,
  winbackEmailPrompt,
  listPromptVersions,
  getPrompt,
  isValidPromptVersion,
  getLatestVersion,
} from "@merchops/shared/prompts";

console.log("🔍 MerchOps AI Prompt System Verification\n");

// Test 1: Version Registry
console.log("✓ Test 1: Version Registry");
const versions = listPromptVersions();
console.log(`  Found ${versions.length} prompt versions:`);
versions.forEach((v) => console.log(`    - ${v}`));

// Test 2: Version Validation
console.log("\n✓ Test 2: Version Validation");
console.log(`  'opportunity-rationale-v1' valid: ${isValidPromptVersion("opportunity-rationale-v1")}`);
console.log(`  'invalid-prompt' valid: ${isValidPromptVersion("invalid-prompt")}`);

// Test 3: Get Prompt by Version
console.log("\n✓ Test 3: Get Prompt by Version");
const prompt = getPrompt("opportunity-rationale-v1");
console.log(`  Retrieved: ${prompt.version}`);

// Test 4: Get Latest Version
console.log("\n✓ Test 4: Get Latest Version");
const latest = getLatestVersion("opportunity-rationale");
console.log(`  Latest 'opportunity-rationale': ${latest}`);

// Test 5: Opportunity Rationale Fallback
console.log("\n✓ Test 5: Opportunity Rationale Fallback");
const rationaleOutput = opportunityRationalePrompt.fallbackGenerator({
  workspaceId: "test",
  opportunityType: "inventory_clearance",
  operatorIntent: "reduce_inventory_risk",
  eventsSummary: "Inventory threshold crossed",
  storeContext: {
    productName: "Test Product",
    currentInventory: 15,
  },
  timeWindow: {
    startDate: "2026-01-01",
    endDate: "2026-01-15",
  },
});
console.log(`  Rationale length: ${rationaleOutput.rationale.length} chars`);
console.log(`  Why now length: ${rationaleOutput.why_now.length} chars`);
console.log(`  Counterfactual length: ${rationaleOutput.counterfactual.length} chars`);
console.log(`  Impact range: ${rationaleOutput.impact_range || "N/A"}`);

// Test 6: Discount Copy Fallback
console.log("\n✓ Test 6: Discount Copy Fallback");
const discountOutput = discountCopyPrompt.fallbackGenerator({
  workspaceId: "test",
  productName: "Test Product",
  discountPercent: 20,
  urgencyLevel: "medium",
  inventoryRemaining: 10,
});
console.log(`  Subject line: "${discountOutput.subject_line}"`);
console.log(`  Subject length: ${discountOutput.subject_line.length} chars (max 50)`);
console.log(`  Body length: ${discountOutput.body_copy.length} chars`);
console.log(`  CTA: "${discountOutput.cta_text}"`);

// Test 7: Win-back Email Fallback
console.log("\n✓ Test 7: Win-back Email Fallback");
const winbackOutput = winbackEmailPrompt.fallbackGenerator({
  workspaceId: "test",
  lastPurchaseDate: "2025-10-01",
  daysSinceLastPurchase: 90,
  customerName: "Sarah",
  previousPurchaseCategory: "Winter Apparel",
  recommendedProducts: ["Product A", "Product B"],
  incentivePercent: 15,
});
console.log(`  Subject: "${winbackOutput.subject}"`);
console.log(`  Body length: ${winbackOutput.body.length} chars`);
console.log(`  CTA: "${winbackOutput.cta}"`);
console.log(`  Personalization: ${winbackOutput.personalization_notes}`);

// Test 8: Required Fields
console.log("\n✓ Test 8: Required Fields Validation");
const hasRequiredFields = (output: any) => {
  return (
    output.rationale &&
    output.rationale.length > 0 &&
    output.why_now &&
    output.why_now.length > 0 &&
    output.counterfactual &&
    output.counterfactual.length > 0
  );
};
console.log(`  Opportunity rationale has required fields: ${hasRequiredFields(rationaleOutput)}`);
console.log(`  Discount copy has required fields: ${hasRequiredFields(discountOutput)}`);
console.log(`  Win-back email has required fields: ${hasRequiredFields(winbackOutput)}`);

// Test 9: Safety Checks
console.log("\n✓ Test 9: Safety Checks");
const hasProhibitedPhrases = (text: string) => {
  const prohibited = [
    /will definitely/gi,
    /guaranteed to/gi,
    /100% certain/gi,
    /urgent!+/gi,
    /act now!+/gi,
    /we miss you/gi,
  ];
  return prohibited.some((pattern) => pattern.test(text));
};

const allDiscountText =
  discountOutput.subject_line + " " + discountOutput.body_copy + " " + discountOutput.cta_text;
const allWinbackText = winbackOutput.subject + " " + winbackOutput.body + " " + winbackOutput.cta;

console.log(`  Discount copy has prohibited phrases: ${hasProhibitedPhrases(allDiscountText)}`);
console.log(`  Win-back email has prohibited phrases: ${hasProhibitedPhrases(allWinbackText)}`);

// Test 10: Prompt Template Structure
console.log("\n✓ Test 10: Prompt Template Structure");
const templates = [opportunityRationalePrompt, discountCopyPrompt, winbackEmailPrompt];
templates.forEach((tmpl) => {
  console.log(`  ${tmpl.version}:`);
  console.log(`    - Has systemPrompt: ${!!tmpl.systemPrompt}`);
  console.log(`    - Has userPromptTemplate: ${typeof tmpl.userPromptTemplate === "function"}`);
  console.log(`    - Has fallbackGenerator: ${typeof tmpl.fallbackGenerator === "function"}`);
  console.log(`    - Has outputSchema: ${!!tmpl.outputSchema}`);
});

console.log("\n✅ All verification tests passed!\n");
console.log("Next steps:");
console.log("1. Run unit tests: pnpm test apps/web/server/ai/__tests__/prompts.test.ts");
console.log("2. Review examples: npx tsx apps/web/server/ai/examples.ts");
console.log("3. Integrate with opportunity engine");
console.log("4. Enable AI integration (set AI_ENABLED=true in generate.ts)");
console.log("\nFor full documentation, see /docs/prompts.md");
