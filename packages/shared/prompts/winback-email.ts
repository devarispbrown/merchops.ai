/**
 * Win-Back Email Prompt
 * Version: winback-email-v1
 *
 * Generates win-back email copy for dormant customers.
 * Tone: warm, welcoming, not guilt-tripping or desperate.
 */

import type { PromptInput, PromptOutput, PromptTemplate } from "./types";

export interface WinbackEmailInput extends PromptInput {
  workspaceId: string;
  customerName?: string;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  recommendedProducts?: string[];
  storeName?: string;
  previousPurchaseCategory?: string;
  incentivePercent?: number;
}

export interface WinbackEmailOutput extends PromptOutput {
  rationale: string;
  why_now: string;
  counterfactual: string;
  subject: string;
  body: string;
  cta: string;
  personalization_notes?: string;
}

const SYSTEM_PROMPT = `You are a copywriter for a Shopify merchant operations console.

Your role is to write warm, welcoming win-back emails for dormant customers.

CRITICAL RULES:
1. NEVER guilt-trip or make customer feel bad ("We miss you!", "Where did you go?")
2. NEVER use desperate or begging language
3. ALWAYS maintain warm but professional tone
4. ALWAYS include rationale, why_now, and counterfactual
5. Keep subject lines under 50 characters
6. Personalize when data is available, but keep it natural
7. Focus on value and welcome, not shame or pressure
8. Use customer name naturally if provided, or use "there" as fallback

TONE GUIDELINES:
- Warm over cold
- Welcoming over guilt-tripping
- Value-focused over desperate
- Natural over forced

REQUIRED OUTPUT STRUCTURE:
{
  "rationale": "Why reaching out to this customer makes sense",
  "why_now": "Why this timing is appropriate for re-engagement",
  "counterfactual": "What likely happens if no outreach occurs",
  "subject": "Warm, welcoming subject line under 50 chars",
  "body": "3-4 sentence body that welcomes without guilt",
  "cta": "Clear call-to-action",
  "personalization_notes": "Optional notes about personalization used"
}

Example good output:
{
  "rationale": "Customer purchased 90 days ago and may appreciate relevant product updates",
  "why_now": "Dormancy threshold indicates appropriate time for value-focused outreach",
  "counterfactual": "Without outreach, customer likely remains inactive based on typical patterns",
  "subject": "Something new you might like",
  "body": "Hi Sarah, we've added some new items in Home Decor that we thought you might be interested in. Check out these candles. Take a look when you have a moment.",
  "cta": "Browse new arrivals",
  "personalization_notes": "Used customer name and previous purchase category"
}

Example bad output (DO NOT DO THIS):
{
  "subject": "We miss you! Come back!",
  "body": "Where did you go? We haven't seen you in forever! We really miss you and need you back. Don't leave us!",
  "cta": "PLEASE COME BACK"
}`;

function generateUserPrompt(input: WinbackEmailInput): string {
  const {
    customerName,
    lastPurchaseDate,
    daysSinceLastPurchase,
    recommendedProducts,
    storeName,
    previousPurchaseCategory,
    incentivePercent,
  } = input;

  return `Generate win-back email copy for:

Customer Name: ${customerName || "Not provided"}
Last Purchase: ${lastPurchaseDate} (${daysSinceLastPurchase} days ago)
${storeName ? `Store: ${storeName}` : ""}
${previousPurchaseCategory ? `Previous Purchase Category: ${previousPurchaseCategory}` : ""}
${recommendedProducts?.length ? `Recommended Products: ${recommendedProducts.join(", ")}` : ""}
${incentivePercent ? `Incentive Available: ${incentivePercent}% off` : ""}

Generate JSON output with rationale, why_now, counterfactual, subject, body, cta, and optional personalization_notes.
Keep tone warm and welcoming. Use ONLY the data provided. Never guilt-trip.`;
}

/**
 * Deterministic fallback for win-back email
 * Safe, template-based generation with warm but professional tone
 */
function generateFallback(input: WinbackEmailInput): WinbackEmailOutput {
  const {
    customerName,
    daysSinceLastPurchase,
    recommendedProducts,
    previousPurchaseCategory,
    incentivePercent,
  } = input;

  const rationale = `Customer last purchased ${daysSinceLastPurchase} days ago. Re-engagement may help restore purchase activity.`;

  const why_now = `After ${daysSinceLastPurchase} days of inactivity, outreach is appropriate based on dormancy patterns.`;

  const counterfactual =
    "Without outreach, dormant customers typically do not return to active purchasing on their own.";

  const greeting = customerName ? `Hi ${customerName}` : "Hi there";

  let subject = "Something new for you";
  if (incentivePercent) {
    subject = `${incentivePercent}% off for you`;
  } else if (previousPurchaseCategory) {
    subject = `New in ${previousPurchaseCategory}`;
  }

  let body = `${greeting}, `;

  if (previousPurchaseCategory) {
    body += `we've added some new items in ${previousPurchaseCategory} that might interest you. `;
  } else {
    body += "we've added some new items that might interest you. ";
  }

  if (recommendedProducts && recommendedProducts.length > 0) {
    body += `Check out ${recommendedProducts.slice(0, 2).join(" and ")}. `;
  }

  if (incentivePercent) {
    body += `Plus, enjoy ${incentivePercent}% off your next purchase. `;
  }

  body += "Browse at your convenience.";

  const cta = incentivePercent ? "Claim your discount" : "Browse new arrivals";

  const personalization_notes = [
    customerName ? "Used customer name" : null,
    previousPurchaseCategory ? "Referenced previous purchase category" : null,
    recommendedProducts?.length ? "Included product recommendations" : null,
    incentivePercent ? "Included incentive offer" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    rationale,
    why_now,
    counterfactual,
    subject,
    body,
    cta,
    personalization_notes: personalization_notes || "Generic template used",
  };
}

export const winbackEmailPrompt: PromptTemplate<WinbackEmailInput, WinbackEmailOutput> = {
  version: "winback-email-v1",
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: generateUserPrompt,
  outputSchema: {
    description: "Win-back email copy with warm, welcoming tone",
    required: ["rationale", "why_now", "counterfactual", "subject", "body", "cta"],
  },
  fallbackGenerator: generateFallback,
};
