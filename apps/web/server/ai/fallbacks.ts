/**
 * Deterministic Fallback Templates
 *
 * Provides safe, template-based generation when AI is unavailable.
 * Never hallucinates metrics or uses manipulative language.
 */

import type {
  OpportunityRationaleInput,
  OpportunityRationaleOutput,
  DiscountCopyInput,
  DiscountCopyOutput,
  WinbackEmailInput,
  WinbackEmailOutput,
} from "@merchops/shared/prompts";

/**
 * Generate opportunity rationale using deterministic template
 * Implements same logic as prompt fallbackGenerator
 */
export function generateOpportunityRationaleFallback(
  input: OpportunityRationaleInput
): OpportunityRationaleOutput {
  const { opportunityType: _opportunityType, operatorIntent, storeContext } = input;

  let rationale = `An opportunity to ${operatorIntent.replace(/_/g, " ")} has been detected. `;
  let why_now = "This opportunity surfaced based on recent store activity. ";
  let counterfactual = "Without action, current trends are likely to continue. ";
  let impact_range: string | undefined = undefined;
  const confidence_note = "Deterministic template used";

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
        "Without outreach, these customers are likely to remain dormant based on typical inactivity patterns.";
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
    if (storeContext?.productName) {
      rationale = `${storeContext.productName} shows strong performance that may benefit from margin protection strategies.`;
    } else {
      rationale = "High-performing product velocity suggests margin protection opportunity.";
    }
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

/**
 * Generate discount copy using deterministic template
 */
export function generateDiscountCopyFallback(input: DiscountCopyInput): DiscountCopyOutput {
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

/**
 * Generate win-back email using deterministic template
 */
export function generateWinbackEmailFallback(input: WinbackEmailInput): WinbackEmailOutput {
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

/**
 * Utility: Ensure text doesn't contain prohibited phrases
 */
export function sanitizeOutput(text: string): string {
  const prohibitedPhrases = [
    /will definitely/gi,
    /guaranteed to/gi,
    /proven to/gi,
    /always results in/gi,
    /never fails to/gi,
    /100% certain/gi,
    /urgent!*/gi,
    /hurry!*/gi,
    /last chance!*/gi,
    /don't miss out!*/gi,
    /act now!*/gi,
  ];

  let sanitized = text;
  prohibitedPhrases.forEach((phrase) => {
    sanitized = sanitized.replace(phrase, "[REMOVED]");
  });

  return sanitized;
}

/**
 * Utility: Validate output contains required fields
 */
export function validateOutput<T extends { rationale: string; why_now: string; counterfactual: string }>(
  output: T
): boolean {
  if (!output.rationale || output.rationale.trim().length === 0) {
    return false;
  }
  if (!output.why_now || output.why_now.trim().length === 0) {
    return false;
  }
  if (!output.counterfactual || output.counterfactual.trim().length === 0) {
    return false;
  }
  return true;
}

/**
 * Utility: Format date range for context
 */
export function formatTimeWindow(start: Date, end: Date): string {
  const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return `${days}-day window from ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;
}

/**
 * Utility: Calculate safe impact range from numbers
 * Never exaggerates or invents data
 */
export function calculateImpactRange(baseValue: number, confidence: number = 0.5): string {
  const lowerBound = Math.max(1, Math.floor(baseValue * confidence));
  const upperBound = Math.ceil(baseValue * (1 + confidence));
  return `${lowerBound}-${upperBound}`;
}

/**
 * Get opportunity fallback content
 *
 * This is an alias for generateOpportunityRationaleFallback
 * to maintain compatibility with different import patterns.
 */
export function getOpportunityFallback(
  input: OpportunityRationaleInput
): OpportunityRationaleOutput {
  return generateOpportunityRationaleFallback(input);
}
