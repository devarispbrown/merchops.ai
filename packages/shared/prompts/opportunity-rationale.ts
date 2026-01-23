/**
 * Opportunity Rationale Prompt
 * Version: opportunity-rationale-v1
 *
 * Generates explanation for why an opportunity surfaced, why now, and counterfactual.
 * Never invents metrics - only uses provided data.
 */

import type { PromptInput, PromptOutput, PromptTemplate } from "./types";

export interface OpportunityRationaleInput extends PromptInput {
  workspaceId: string;
  opportunityType: string;
  operatorIntent: string;
  eventsSummary: string;
  storeContext?: {
    storeName?: string;
    productName?: string;
    currentInventory?: number;
    velocityLast14Days?: number;
    lastPurchaseDate?: string;
    customerSegmentSize?: number;
  };
  timeWindow: {
    startDate: string;
    endDate: string;
  };
}

export interface OpportunityRationaleOutput extends PromptOutput {
  rationale: string;
  why_now: string;
  counterfactual: string;
  impact_range?: string;
  confidence_note?: string;
}

const SYSTEM_PROMPT = `You are a calm, precise explainer for a Shopify merchant operations console.

Your role is to explain why an opportunity has surfaced, why it matters now, and what likely happens if no action is taken.

CRITICAL RULES:
1. NEVER invent metrics or numbers not provided in the input
2. ALWAYS use uncertainty language: "likely", "based on", "suggests", "estimated range"
3. NEVER use absolute claims: "will definitely", "guaranteed", "100% certain"
4. ALWAYS include concrete counterfactual (what happens if nothing is done)
5. ALWAYS ground explanations in the specific time window and data provided
6. Keep tone calm, not urgent or pressuring
7. Focus on operator intent, not just mechanics

REQUIRED OUTPUT STRUCTURE:
{
  "rationale": "Plain language explanation of the opportunity, store-specific",
  "why_now": "Explicit reason why this matters at this moment, non-generic",
  "counterfactual": "What likely happens if no action is taken",
  "impact_range": "Directional range like '5-15 units' or '$200-$500' (optional)",
  "confidence_note": "Brief note about data basis (optional)"
}

Example good output:
{
  "rationale": "Product X has 12 units remaining with velocity suggesting 8-10 sales over the next 7 days based on the last 14 days. Current trajectory indicates stockout risk.",
  "why_now": "Inventory crossed the threshold today. Acting within 48 hours allows time for discount promotion before stockout.",
  "counterfactual": "Without intervention, likely stockout in 7-10 days, followed by backorder period or lost sales until restocked.",
  "impact_range": "8-15 units",
  "confidence_note": "Based on 14-day sales velocity and current inventory level"
}

Example bad output (DO NOT DO THIS):
{
  "rationale": "This will definitely increase revenue by 40%",
  "why_now": "Urgent action required immediately!",
  "counterfactual": "You will lose thousands of dollars"
}`;

function generateUserPrompt(input: OpportunityRationaleInput): string {
  const { opportunityType, operatorIntent, eventsSummary, storeContext, timeWindow } = input;

  return `Generate rationale for this opportunity:

Opportunity Type: ${opportunityType}
Operator Intent: ${operatorIntent}

Events Summary:
${eventsSummary}

Store Context:
${storeContext ? JSON.stringify(storeContext, null, 2) : "Limited context available"}

Time Window: ${timeWindow.startDate} to ${timeWindow.endDate}

Generate JSON output with rationale, why_now, counterfactual, and optional impact_range and confidence_note.
Use ONLY the data provided above. Do not invent metrics.`;
}

/**
 * Deterministic fallback when AI generation fails
 * Uses template-based generation with no hallucination
 */
function generateFallback(input: OpportunityRationaleInput): OpportunityRationaleOutput {
  const { operatorIntent, storeContext } = input;

  // Template-based generation using only provided data
  let rationale = `An opportunity to ${operatorIntent.replace(/_/g, " ")} has been detected. `;
  let why_now = "This opportunity surfaced based on recent store activity. ";
  let counterfactual = "Without action, current trends are likely to continue. ";
  let impact_range: string | undefined = undefined;
  const confidence_note = "Deterministic template used (AI generation unavailable)";

  // Customize based on operator intent
  if (operatorIntent === "reduce_inventory_risk") {
    if (storeContext?.productName && storeContext?.currentInventory !== undefined) {
      rationale = `${storeContext.productName} has ${storeContext.currentInventory} units remaining. Based on recent activity, inventory levels suggest monitoring or action may be appropriate.`;
      why_now = "Inventory levels have changed recently, crossing a monitoring threshold.";
      counterfactual =
        "Without intervention, inventory will continue at current velocity until restocked or depleted.";
      if (storeContext.currentInventory > 0) {
        impact_range = `${Math.max(1, Math.floor(storeContext.currentInventory * 0.3))}-${Math.min(
          storeContext.currentInventory,
          Math.ceil(storeContext.currentInventory * 0.8)
        )} units`;
      }
    } else {
      rationale = "Inventory patterns suggest potential risk that may benefit from review.";
      why_now = "Recent inventory changes triggered this alert.";
      counterfactual = "Current inventory trajectory will continue without intervention.";
    }
  } else if (operatorIntent === "reengage_dormant_customers") {
    if (storeContext?.customerSegmentSize) {
      rationale = `A segment of approximately ${storeContext.customerSegmentSize} customers has shown reduced activity. Re-engagement may help restore purchase patterns.`;
      why_now = "Customer activity patterns indicate dormancy threshold has been crossed.";
      counterfactual =
        "Without outreach, these customers are likely to remain inactive based on typical dormancy patterns.";
      impact_range = `${Math.floor(storeContext.customerSegmentSize * 0.05)}-${Math.ceil(
        storeContext.customerSegmentSize * 0.15
      )} potential re-engagements`;
    } else {
      rationale = "Customer activity patterns suggest an opportunity for re-engagement.";
      why_now = "Dormancy thresholds have been crossed for a customer segment.";
      counterfactual =
        "Without contact, dormant customers typically do not return to active purchasing.";
    }
  } else if (operatorIntent === "protect_margin") {
    rationale = "High-performing product velocity suggests margin protection opportunity.";
    why_now = "Recent sales velocity indicates strong performance worth protecting.";
    counterfactual = "Without optimization, current margin levels will continue as-is.";
  }

  return {
    rationale,
    why_now,
    counterfactual,
    impact_range,
    confidence_note,
  };
}

export const opportunityRationalePrompt: PromptTemplate<
  OpportunityRationaleInput,
  OpportunityRationaleOutput
> = {
  version: "opportunity-rationale-v1",
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: generateUserPrompt,
  outputSchema: {
    description: "Structured opportunity explanation with rationale, why_now, and counterfactual",
    required: ["rationale", "why_now", "counterfactual"],
  },
  fallbackGenerator: generateFallback,
};
