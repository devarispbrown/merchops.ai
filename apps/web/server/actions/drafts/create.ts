/**
 * MerchOps Draft Creation
 * Generates action drafts from opportunities with AI-powered copy generation
 */

import { prisma } from "../../db/client";
import {
  ExecutionType,
  OperatorIntent,
  ActionDraftState,
  DiscountDraftPayload,
  WinbackEmailPayload,
  PauseProductPayload,
  getEditableFields,
} from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface CreateDraftInput {
  workspaceId: string;
  opportunityId: string;
  operatorIntent: OperatorIntent;
  executionType: ExecutionType;
  context?: Record<string, any>; // Additional context from opportunity
}

interface CreateDraftResult {
  draftId: string;
  payload: any;
  editableFields: any;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function createDraftForOpportunity(
  input: CreateDraftInput
): Promise<CreateDraftResult> {
  const { workspaceId, opportunityId, operatorIntent, executionType, context = {} } = input;

  // Validate opportunity exists and belongs to workspace
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      workspace_id: workspaceId,
    },
    include: {
      event_links: {
        include: {
          event: true,
        },
      },
    },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found or access denied");
  }

  // Generate initial payload based on execution type
  const payload = await generateInitialPayload({
    executionType,
    operatorIntent,
    opportunity,
    context,
    workspaceId,
  });

  // Get editable field configuration
  const editableFieldsConfig = getEditableFields(executionType);

  // Create draft record
  const draft = await prisma.actionDraft.create({
    data: {
      workspace_id: workspaceId,
      opportunity_id: opportunityId,
      operator_intent: operatorIntent,
      execution_type: executionType,
      payload_json: payload as any,
      editable_fields_json: editableFieldsConfig as any,
      state: ActionDraftState.DRAFT,
    },
  });

  return {
    draftId: draft.id,
    payload,
    editableFields: editableFieldsConfig,
  };
}

// ============================================================================
// PAYLOAD GENERATORS
// ============================================================================

async function generateInitialPayload(params: {
  executionType: ExecutionType;
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<any> {
  const { executionType, operatorIntent, opportunity, context, workspaceId } = params;

  switch (executionType) {
    case ExecutionType.DISCOUNT_DRAFT:
      return await generateDiscountPayload({
        operatorIntent,
        opportunity,
        context,
        workspaceId,
      });

    case ExecutionType.WINBACK_EMAIL:
      return await generateWinbackEmailPayload({
        operatorIntent,
        opportunity,
        context,
        workspaceId,
      });

    case ExecutionType.PAUSE_PRODUCT:
      return await generatePauseProductPayload({
        operatorIntent,
        opportunity,
        context,
        workspaceId,
      });

    default:
      throw new Error(`Unsupported execution type: ${executionType}`);
  }
}

// ============================================================================
// DISCOUNT DRAFT GENERATOR
// ============================================================================

async function generateDiscountPayload(params: {
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<DiscountDraftPayload> {
  const { opportunity, context } = params;

  // Extract product IDs from opportunity events
  const productIds = extractProductIdsFromEvents(opportunity.event_links);

  // Generate discount parameters based on inventory risk
  const discountValue = calculateDiscountValue(context);
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Try AI generation for title, with fallback
  let title: string;
  try {
    title = await generateDiscountTitle(params);
  } catch (error) {
    console.error("AI title generation failed, using fallback", error);
    title = generateFallbackDiscountTitle(opportunity.type);
  }

  return {
    title,
    discount_type: "percentage",
    value: discountValue,
    target_type: productIds.length > 0 ? "product" : "entire_order",
    target_ids: productIds,
    usage_limit: 100,
    starts_at: startsAt,
    ends_at: endsAt,
    minimum_purchase_amount: 0,
  };
}

// ============================================================================
// WINBACK EMAIL GENERATOR
// ============================================================================

async function generateWinbackEmailPayload(params: {
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<WinbackEmailPayload> {
  const { opportunity, context, workspaceId } = params;

  // Get workspace details for from_email
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  const fromEmail = context.fromEmail || `hello@${workspace?.name.toLowerCase()}.com`;
  const fromName = workspace?.name || "Your Store";

  // Try AI generation for email copy, with fallback
  let emailCopy: { subject: string; body_html: string; body_text: string; preview_text: string };
  try {
    emailCopy = await generateEmailCopy(params);
  } catch (error) {
    console.error("AI email generation failed, using fallback", error);
    emailCopy = generateFallbackEmailCopy(opportunity.type);
  }

  return {
    subject: emailCopy.subject,
    preview_text: emailCopy.preview_text,
    body_html: emailCopy.body_html,
    body_text: emailCopy.body_text,
    from_name: fromName,
    from_email: fromEmail,
    recipient_segment: "dormant_30_days",
  };
}

// ============================================================================
// PAUSE PRODUCT GENERATOR
// ============================================================================

async function generatePauseProductPayload(params: {
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<PauseProductPayload> {
  const { opportunity, context } = params;

  // Extract product IDs from opportunity events
  const productIds = extractProductIdsFromEvents(opportunity.event_links);

  if (productIds.length === 0) {
    throw new Error("No product IDs found in opportunity context");
  }

  // Generate reason
  const reason = opportunity.rationale || "Low inventory - preventing overselling";

  return {
    product_ids: productIds,
    reason,
    notify_customers: false,
    redirect_to_similar: false,
  };
}

// ============================================================================
// AI GENERATION (WITH FALLBACKS)
// ============================================================================

async function generateDiscountTitle(params: {
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<string> {
  // TODO: Implement AI generation via prompt system
  // For now, use smart fallback
  throw new Error("AI not yet implemented");
}

async function generateEmailCopy(params: {
  operatorIntent: OperatorIntent;
  opportunity: any;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<{ subject: string; body_html: string; body_text: string; preview_text: string }> {
  // TODO: Implement AI generation via prompt system
  // For now, use smart fallback
  throw new Error("AI not yet implemented");
}

// ============================================================================
// FALLBACK GENERATORS
// ============================================================================

function generateFallbackDiscountTitle(opportunityType: string): string {
  const templates: Record<string, string> = {
    inventory_clearance: "Inventory Clearance - Limited Time Offer",
    seasonal_promotion: "Seasonal Sale - Don't Miss Out",
    velocity_boost: "Featured Products Sale",
    default: "Special Discount - Limited Time",
  };

  return templates[opportunityType] || templates.default;
}

function generateFallbackEmailCopy(opportunityType: string): {
  subject: string;
  body_html: string;
  body_text: string;
  preview_text: string;
} {
  return {
    subject: "We miss you - Come back for a special offer",
    preview_text: "Your favorite products are waiting for you",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>We Miss You!</h1>
          <p>It's been a while since your last visit. We wanted to reach out with a special offer just for you.</p>
          <p>Come back and check out what's new in our store.</p>
          <a href="{{store_url}}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Shop Now
          </a>
          <p style="color: #6B7280; font-size: 14px;">If you'd prefer not to receive these emails, you can unsubscribe below.</p>
        </body>
      </html>
    `,
    body_text: `
We Miss You!

It's been a while since your last visit. We wanted to reach out with a special offer just for you.

Come back and check out what's new in our store.

Visit: {{store_url}}

If you'd prefer not to receive these emails, you can unsubscribe.
    `,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function extractProductIdsFromEvents(eventLinks: any[]): string[] {
  const productIds: string[] = [];

  for (const link of eventLinks) {
    const payload = link.event.payload_json as any;
    if (payload.product_id) {
      productIds.push(payload.product_id);
    }
    if (payload.product_ids && Array.isArray(payload.product_ids)) {
      productIds.push(...payload.product_ids);
    }
  }

  return [...new Set(productIds)]; // Deduplicate
}

function calculateDiscountValue(context: Record<string, any>): number {
  // Smart discount calculation based on inventory risk
  const inventoryLevel = context.inventoryLevel || 0;
  const velocityScore = context.velocityScore || 0;

  if (inventoryLevel > 100) return 15; // 15% for high inventory
  if (inventoryLevel > 50) return 20; // 20% for medium inventory
  if (inventoryLevel > 20) return 25; // 25% for low inventory
  return 30; // 30% for very low inventory
}

// ============================================================================
// EXPORTED WRAPPER FOR SERVER ACTIONS
// ============================================================================

/**
 * Create action draft - wrapper for server actions compatibility
 * Maps from server action interface to internal implementation
 */
export async function createActionDraft(params: {
  workspaceId: string;
  opportunityId: string;
}): Promise<any> {
  // Fetch opportunity to get operator intent and execution type
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: params.opportunityId },
  });

  if (!opportunity) {
    throw new Error("Opportunity not found");
  }

  // Map opportunity type to execution type and operator intent
  // This mapping should match your business logic
  const { executionType, operatorIntent } = mapOpportunityToExecution(opportunity);

  return createDraftForOpportunity({
    workspaceId: params.workspaceId,
    opportunityId: params.opportunityId,
    operatorIntent,
    executionType,
    context: {},
  });
}

/**
 * Map opportunity to execution type and operator intent
 */
function mapOpportunityToExecution(opportunity: any): {
  executionType: ExecutionType;
  operatorIntent: OperatorIntent;
} {
  // Default mapping based on opportunity type
  const typeMapping: Record<string, { executionType: ExecutionType; operatorIntent: OperatorIntent }> = {
    inventory_clearance: {
      executionType: ExecutionType.DISCOUNT_DRAFT,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
    },
    winback_campaign: {
      executionType: ExecutionType.WINBACK_EMAIL,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
    },
    stockout_prevention: {
      executionType: ExecutionType.PAUSE_PRODUCT,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
    },
  };

  return typeMapping[opportunity.type] || {
    executionType: ExecutionType.DISCOUNT_DRAFT,
    operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
  };
}
