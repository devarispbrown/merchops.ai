/**
 * Opportunity Creation
 *
 * Creates opportunities from events with AI-generated or fallback explanations.
 */

import { PrismaClient, Opportunity } from '@prisma/client';
import { prisma } from '../db/client';
import {
  CreateOpportunityInput,
  OpportunityType,
  OpportunityAiInput,
  OpportunityAiOutput,
  DECAY_CONFIGS,
} from './types';
import { calculatePriority } from './prioritize';
import { isDismissed } from './dismiss';

// ============================================================================
// OPPORTUNITY CREATION
// ============================================================================

/**
 * Creates an opportunity from events
 */
export async function createOpportunityFromEvents(
  input: CreateOpportunityInput
): Promise<Opportunity> {
  const {
    workspace_id,
    type,
    event_ids,
    operator_intent,
    why_now,
    rationale,
    impact_range,
    counterfactual,
    confidence = 0.5,
  } = input;

  // Calculate decay time
  const decay_at = calculateDecayTime(type);

  // Calculate priority if not provided
  let priority_bucket = input.priority_bucket;
  if (!priority_bucket) {
    const events = await prisma.event.findMany({
      where: { id: { in: event_ids } },
    });

    const priorityScore = await calculatePriority({
      opportunity_type: type,
      events,
      confidence,
    });

    priority_bucket = priorityScore.bucket;
  }

  // Create opportunity
  const opportunity = await prisma.opportunity.create({
    data: {
      workspace_id,
      type,
      priority_bucket,
      why_now,
      rationale,
      impact_range,
      counterfactual,
      decay_at,
      confidence,
      state: 'new',
    },
  });

  // Link events to opportunity
  await linkEventsToOpportunity(opportunity.id, event_ids);

  return opportunity;
}

/**
 * Links events to an opportunity
 */
async function linkEventsToOpportunity(
  opportunity_id: string,
  event_ids: string[]
): Promise<void> {
  await prisma.opportunityEventLink.createMany({
    data: event_ids.map((event_id) => ({
      opportunity_id,
      event_id,
    })),
    skipDuplicates: true,
  });
}

// ============================================================================
// DECAY TIME CALCULATION
// ============================================================================

/**
 * Calculates when an opportunity should decay based on its type
 */
function calculateDecayTime(type: OpportunityType): Date {
  const config = DECAY_CONFIGS[type];
  const now = new Date();
  const decayTime = new Date(now.getTime() + config.hours_to_decay * 60 * 60 * 1000);
  return decayTime;
}

// ============================================================================
// AI GENERATION
// ============================================================================

/**
 * Generates opportunity explanations using AI
 * Falls back to templates if AI fails
 */
export async function generateOpportunityExplanations(
  input: OpportunityAiInput
): Promise<OpportunityAiOutput> {
  try {
    // TODO: Implement AI generation with versioned prompts
    // For now, use fallback templates
    return generateFallbackExplanations(input);
  } catch (error) {
    // Always fall back to deterministic templates
    return generateFallbackExplanations(input);
  }
}

/**
 * Generates deterministic fallback explanations
 */
function generateFallbackExplanations(
  input: OpportunityAiInput
): OpportunityAiOutput {
  switch (input.opportunity_type) {
    case OpportunityType.INVENTORY_CLEARANCE:
      return generateInventoryClearanceExplanation(input);

    case OpportunityType.STOCKOUT_PREVENTION:
      return generateStockoutPreventionExplanation(input);

    case OpportunityType.RESTOCK_NOTIFICATION:
      return generateRestockNotificationExplanation(input);

    case OpportunityType.WINBACK_CAMPAIGN:
      return generateWinbackCampaignExplanation(input);

    case OpportunityType.HIGH_VELOCITY_PROTECTION:
      return generateHighVelocityProtectionExplanation(input);

    default:
      return generateGenericExplanation(input);
  }
}

// ============================================================================
// EXPLANATION TEMPLATES
// ============================================================================

function generateInventoryClearanceExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  const event = input.event_data[0] || {};
  const payload = event.payload_json || {};

  return {
    why_now: `${payload.product_title || 'Product'} inventory dropped to ${
      payload.current_inventory || 0
    } units, below your ${payload.threshold || 10} unit threshold.`,
    rationale: `Low inventory creates holding cost risk and potential waste if the product doesn't sell. A targeted discount can accelerate sales and clear inventory before it becomes a liability.`,
    counterfactual: `Without action, this inventory may sit for weeks, tying up capital and warehouse space. Risk of obsolescence or seasonal irrelevance increases over time.`,
    impact_range: `${Math.max(1, Math.floor((payload.current_inventory || 0) * 0.3))}-${Math.floor(
      (payload.current_inventory || 0) * 0.7
    )} units potentially cleared`,
  };
}

function generateStockoutPreventionExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  const event = input.event_data[0] || {};
  const payload = event.payload_json || {};

  return {
    why_now: `${payload.product_title || 'Product'} is completely out of stock as of ${
      event.occurred_at ? new Date(event.occurred_at).toLocaleDateString() : 'recently'
    }.`,
    rationale: `Stockouts result in lost sales, disappointed customers, and potential brand damage. Customers may switch to competitors if they can't find your product available.`,
    counterfactual: `Without restocking or pausing this product, customers will continue encountering out-of-stock messages, damaging conversion rates and customer satisfaction.`,
    impact_range: `Prevents 5-15 lost sales based on typical demand`,
  };
}

function generateRestockNotificationExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  const event = input.event_data[0] || {};
  const payload = event.payload_json || {};

  return {
    why_now: `${payload.product_title || 'Product'} just came back in stock after ${
      payload.out_of_stock_duration_days || 0
    } days.`,
    rationale: `Customers who previously encountered stockouts may not know the product is available again. Proactive notification can recapture lost demand and reward patient customers.`,
    counterfactual: `Without notification, potential customers won't know about restocking. Sales momentum from the restock window may be lost.`,
    impact_range: `${Math.floor((payload.new_inventory || 0) * 0.1)}-${Math.floor(
      (payload.new_inventory || 0) * 0.3
    )} units from pent-up demand`,
  };
}

function generateWinbackCampaignExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  const event = input.event_data[0] || {};
  const payload = event.payload_json || {};

  return {
    why_now: `${payload.customer_email || 'Customer'} hasn't ordered in ${
      payload.days_inactive || 0
    } days (${payload.threshold || 0} day threshold crossed).`,
    rationale: `Dormant customers represent lost revenue potential. They've purchased before, so re-engagement costs less than new acquisition. Early intervention prevents complete churn.`,
    counterfactual: `Without re-engagement, this customer's lifetime relationship may end. Average customer lifetime value: $${
      payload.total_lifetime_value || 0
    } across ${payload.total_lifetime_orders || 0} orders.`,
    impact_range: `$${Math.floor((payload.average_order_value || 0) * 0.5)}-$${Math.floor(
      payload.average_order_value || 0
    )} potential recovery`,
  };
}

function generateHighVelocityProtectionExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  const event = input.event_data[0] || {};
  const payload = event.payload_json || {};

  return {
    why_now: `${payload.product_title || 'Product'} is selling ${
      payload.spike_multiplier || 0
    }x faster than baseline (${payload.current_units_per_day || 0} units/day vs ${
      payload.baseline_units_per_day || 0
    } units/day baseline).`,
    rationale: `Velocity spikes indicate unexpected demand. With only ${
      payload.current_inventory || 0
    } units remaining, you risk stockout in ${
      payload.estimated_days_to_stockout || 'a few'
    } days. This is a high-performing product worth protecting.`,
    counterfactual: `Without action, this product will stock out during peak demand, causing maximum revenue loss and customer frustration. Competitors may capture your demand.`,
    impact_range: `Protects $${Math.floor(
      (payload.current_inventory || 0) * 50 * 0.5
    )}-$${Math.floor((payload.current_inventory || 0) * 50)} in potential revenue`,
  };
}

function generateGenericExplanation(
  input: OpportunityAiInput
): OpportunityAiOutput {
  return {
    why_now: 'Store conditions have changed requiring attention.',
    rationale: 'This opportunity was detected based on recent store activity.',
    counterfactual: 'Without action, current trends may continue.',
    impact_range: 'Impact varies based on action taken',
  };
}

// ============================================================================
// BATCH CREATION
// ============================================================================

/**
 * Creates multiple opportunities from a batch of event groups
 */
export async function createOpportunitiesBatch(
  inputs: CreateOpportunityInput[]
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  for (const input of inputs) {
    try {
      const opportunity = await createOpportunityFromEvents(input);
      opportunities.push(opportunity);
    } catch (error) {
      console.error('Failed to create opportunity:', error);
      // Continue with remaining opportunities
    }
  }

  return opportunities;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Finds similar opportunities to prevent duplicates
 * Looks for opportunities with same type and overlapping events
 */
export async function findSimilarOpportunity(
  workspace_id: string,
  type: OpportunityType,
  event_ids: string[],
  prismaClient: PrismaClient = prisma
): Promise<Opportunity | null> {
  // Find opportunities of same type
  const candidates = await prismaClient.opportunity.findMany({
    where: {
      workspace_id,
      type,
      state: {
        notIn: ['resolved', 'dismissed', 'expired'],
      },
    },
    include: {
      event_links: {
        select: { event_id: true },
      },
    },
  });

  // Check for event overlap
  for (const candidate of candidates) {
    const candidateEventIds = candidate.event_links.map((link) => link.event_id);

    // If any event IDs overlap, consider it similar
    const hasOverlap = event_ids.some((id) => candidateEventIds.includes(id));

    if (hasOverlap) {
      return candidate;
    }
  }

  return null;
}

/**
 * Creates opportunity with deduplication and dismissal checks
 */
export async function createOpportunityWithDeduplication(
  input: CreateOpportunityInput,
  prismaClient: PrismaClient = prisma
): Promise<Opportunity | null> {
  const { workspace_id, type, event_ids } = input;

  // Check if dismissed
  const wasDismissed = await isDismissed(type, event_ids, workspace_id, prismaClient);
  if (wasDismissed) {
    return null; // Don't recreate dismissed opportunities
  }

  // Check for similar existing opportunities
  const similar = await findSimilarOpportunity(workspace_id, type, event_ids, prismaClient);
  if (similar) {
    return null; // Don't create duplicate
  }

  // Create new opportunity
  return createOpportunityFromEvents(input);
}
