/**
 * Discount Copy Prompt
 * Version: discount-copy-v1
 *
 * Generates email/notification copy for discount opportunities.
 * Tone: calm, informative, not manipulative or urgent.
 */

import type { PromptInput, PromptOutput, PromptTemplate } from "./types";

export interface DiscountCopyInput extends PromptInput {
  workspaceId: string;
  productName: string;
  discountPercent: number;
  urgencyLevel: "low" | "medium" | "high";
  storeName?: string;
  inventoryRemaining?: number;
  expiryDate?: string;
  context?: string;
}

export interface DiscountCopyOutput extends PromptOutput {
  rationale: string;
  why_now: string;
  counterfactual: string;
  subject_line: string;
  body_copy: string;
  cta_text: string;
}

const SYSTEM_PROMPT = `You are a copywriter for a Shopify merchant operations console.

Your role is to write calm, informative discount copy for email/notifications.

CRITICAL RULES:
1. NEVER use manipulative urgency tactics ("Last chance!", "Hurry!", "Don't miss out!")
2. NEVER invent specific numbers or metrics not provided
3. ALWAYS maintain calm, respectful tone
4. ALWAYS include rationale, why_now, and counterfactual
5. Keep subject lines under 50 characters
6. Keep body copy concise (2-3 sentences)
7. CTA should be clear and action-oriented but not pressuring

TONE GUIDELINES:
- Calm over clever
- Informative over manipulative
- Respectful over pushy
- Clear over cute

REQUIRED OUTPUT STRUCTURE:
{
  "rationale": "Why this discount offer makes sense for the merchant",
  "why_now": "Why sending this now is appropriate",
  "counterfactual": "What happens if this discount is not offered",
  "subject_line": "Clear, calm subject line under 50 chars",
  "body_copy": "2-3 sentence body that informs without pressure",
  "cta_text": "Clear call-to-action (e.g., 'View offer' or 'Shop now')"
}

Example good output:
{
  "rationale": "Discount helps clear inventory while providing value to customers",
  "why_now": "Inventory levels suggest offering discount within normal clearance window",
  "counterfactual": "Without discount, inventory moves at current pace or sits longer",
  "subject_line": "15% off Product X",
  "body_copy": "We're offering 15% off Product X. This is a limited-time offer while inventory lasts. Shop at your convenience.",
  "cta_text": "View offer"
}

Example bad output (DO NOT DO THIS):
{
  "subject_line": "URGENT!!! Last chance to save BIG!!!",
  "body_copy": "This incredible deal won't last! ACT NOW before it's gone forever! You'll regret missing this!",
  "cta_text": "BUY NOW OR LOSE OUT!!!"
}`;

function generateUserPrompt(input: DiscountCopyInput): string {
  const {
    productName,
    discountPercent,
    urgencyLevel,
    storeName,
    inventoryRemaining,
    expiryDate,
    context,
  } = input;

  return `Generate discount copy for:

Product: ${productName}
Discount: ${discountPercent}%
Urgency Level: ${urgencyLevel}
${storeName ? `Store: ${storeName}` : ""}
${inventoryRemaining !== undefined ? `Inventory Remaining: ${inventoryRemaining} units` : ""}
${expiryDate ? `Offer Expiry: ${expiryDate}` : ""}
${context ? `Context: ${context}` : ""}

Generate JSON output with rationale, why_now, counterfactual, subject_line, body_copy, and cta_text.
Keep tone calm and informative. Use ONLY the data provided.`;
}

/**
 * Deterministic fallback for discount copy
 * Safe, template-based generation with no manipulation
 */
function generateFallback(input: DiscountCopyInput): DiscountCopyOutput {
  const { productName, discountPercent, inventoryRemaining, expiryDate } = input;

  const rationale = `Offering ${discountPercent}% discount on ${productName} to provide customer value and manage inventory effectively.`;

  const why_now =
    inventoryRemaining !== undefined
      ? "Current inventory levels suggest this is an appropriate time for a discount offer."
      : "Based on recent store activity, this discount timing is appropriate.";

  const counterfactual =
    "Without this discount, inventory would move at its current velocity and customers would pay regular price.";

  const subject_line = `${discountPercent}% off ${productName}`.substring(0, 50);

  let body_copy = `We're offering ${discountPercent}% off ${productName}. `;

  if (inventoryRemaining !== undefined && inventoryRemaining < 50) {
    body_copy += `${inventoryRemaining} units available. `;
  }

  if (expiryDate) {
    body_copy += `Offer valid through ${expiryDate}. `;
  } else {
    body_copy += "Limited-time offer. ";
  }

  body_copy += "Shop at your convenience.";

  const cta_text = "View offer";

  return {
    rationale,
    why_now,
    counterfactual,
    subject_line,
    body_copy,
    cta_text,
  };
}

export const discountCopyPrompt: PromptTemplate<DiscountCopyInput, DiscountCopyOutput> = {
  version: "discount-copy-v1",
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: generateUserPrompt,
  outputSchema: {
    description: "Discount email/notification copy with calm, informative tone",
    required: ["rationale", "why_now", "counterfactual", "subject_line", "body_copy", "cta_text"],
  },
  fallbackGenerator: generateFallback,
};
