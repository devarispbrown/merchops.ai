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
import { generateAndLog } from "../../ai/generate";
import { renderEmail } from "../../email/render";
import {
  discountCopyPrompt,
  winbackEmailPrompt,
  opportunityRationalePrompt,
  type DiscountCopyInput,
  type WinbackEmailInput,
  type OpportunityRationaleInput,
  type DiscountCopyOutput,
  type WinbackEmailOutput,
  type OpportunityRationaleOutput,
  type PromptInput,
  type PromptOutput,
  type PromptTemplate,
} from "@merchops/shared/prompts";

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
// AI COPY HELPER
// ============================================================================

/**
 * Calls the AI provider with a given prompt template and inputs.
 * Validates output fields via the prompt's required schema list.
 * Falls back to the prompt's deterministic fallbackGenerator on any error.
 * Logs every attempt (including fallbacks) to the ai_generations audit table.
 */
export async function generateAICopy<
  TInput extends PromptInput,
  TOutput extends PromptOutput,
>(
  promptTemplate: PromptTemplate<TInput, TOutput>,
  inputs: TInput,
  workspaceId: string
): Promise<TOutput> {
  // generateAndLog handles AI call, Zod-style field validation, fallback on
  // failure, and audit logging — all in one call.
  return generateAndLog(promptTemplate, { ...inputs, workspaceId }, prisma);
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
  const { opportunity, context, workspaceId } = params;

  // Extract product IDs from opportunity events
  const productIds = extractProductIdsFromEvents(opportunity.event_links);

  // Generate discount parameters based on inventory risk
  const discountValue = calculateDiscountValue(context);
  const startsAt = new Date().toISOString();
  const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Build AI inputs for discount-copy-v1
  const productName =
    context.productName ||
    extractProductNameFromEvents(opportunity.event_links) ||
    opportunity.type;

  const discountInputs: DiscountCopyInput = {
    workspaceId,
    productName,
    discountPercent: discountValue,
    urgencyLevel: resolveUrgencyLevel(context),
    storeName: context.storeName,
    inventoryRemaining: context.inventoryLevel,
    expiryDate: endsAt,
    context: opportunity.rationale || undefined,
  };

  const aiCopy = await generateAICopy<DiscountCopyInput, DiscountCopyOutput>(
    discountCopyPrompt,
    discountInputs,
    workspaceId
  );

  // Enhance the opportunity rationale fields using opportunity-rationale-v1
  await enhanceOpportunityRationale({
    opportunity,
    operatorIntent: params.operatorIntent,
    context,
    workspaceId,
  });

  return {
    title: aiCopy.subject_line,
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

  // Derive sensible defaults from opportunity context
  const lastPurchaseDate =
    context.lastPurchaseDate || new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const daysSinceLastPurchase = context.daysSinceLastPurchase || 45;

  const winbackInputs: WinbackEmailInput = {
    workspaceId,
    customerName: context.customerName,
    lastPurchaseDate,
    daysSinceLastPurchase,
    recommendedProducts: context.recommendedProducts,
    storeName: fromName,
    previousPurchaseCategory: context.previousPurchaseCategory,
    incentivePercent: context.incentivePercent,
  };

  const aiCopy = await generateAICopy<WinbackEmailInput, WinbackEmailOutput>(
    winbackEmailPrompt,
    winbackInputs,
    workspaceId
  );

  // Enhance the opportunity rationale fields using opportunity-rationale-v1
  await enhanceOpportunityRationale({
    opportunity,
    operatorIntent: params.operatorIntent,
    context,
    workspaceId,
  });

  // Render email using react-email templates
  const rendered = await renderEmail('winback_email_draft', {
    subject: aiCopy.subject,
    previewText: aiCopy.body.substring(0, 150),
    body: aiCopy.body,
    cta: aiCopy.cta,
    ctaUrl: '{{store_url}}',
    storeName: fromName,
    unsubscribeUrl: '{{unsubscribe_url}}',
  });

  return {
    subject: aiCopy.subject,
    preview_text: aiCopy.body.substring(0, 150),
    body_html: rendered.html,
    body_text: rendered.text,
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
  const { opportunity, context: _context, workspaceId } = params;

  // Extract product IDs from opportunity events
  const productIds = extractProductIdsFromEvents(opportunity.event_links);

  if (productIds.length === 0) {
    throw new Error("No product IDs found in opportunity context");
  }

  // Enhance the opportunity rationale fields using opportunity-rationale-v1
  const rationaleOutput = await enhanceOpportunityRationale({
    opportunity,
    operatorIntent: params.operatorIntent,
    context: _context,
    workspaceId,
  });

  const reason = rationaleOutput?.rationale || opportunity.rationale || "Low inventory - preventing overselling";

  return {
    product_ids: productIds,
    reason,
    notify_customers: false,
    redirect_to_similar: false,
  };
}

// ============================================================================
// OPPORTUNITY RATIONALE ENHANCER
// ============================================================================

/**
 * Calls opportunity-rationale-v1 to generate enhanced rationale, why_now, and
 * counterfactual for the opportunity. Updates the opportunity record in-place.
 * Never throws — falls back gracefully if AI is unavailable.
 */
async function enhanceOpportunityRationale(params: {
  opportunity: any;
  operatorIntent: OperatorIntent;
  context: Record<string, any>;
  workspaceId: string;
}): Promise<OpportunityRationaleOutput | null> {
  const { opportunity, operatorIntent, context, workspaceId } = params;

  try {
    const eventsSummary = buildEventsSummary(opportunity.event_links);

    const rationaleInputs: OpportunityRationaleInput = {
      workspaceId,
      opportunityType: opportunity.type,
      operatorIntent,
      eventsSummary,
      storeContext: {
        storeName: context.storeName,
        productName: context.productName || extractProductNameFromEvents(opportunity.event_links),
        currentInventory: context.inventoryLevel,
        velocityLast14Days: context.velocityScore,
        lastPurchaseDate: context.lastPurchaseDate,
        customerSegmentSize: context.customerSegmentSize,
      },
      timeWindow: {
        startDate: opportunity.created_at
          ? new Date(opportunity.created_at).toISOString()
          : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    const rationaleOutput = await generateAICopy<OpportunityRationaleInput, OpportunityRationaleOutput>(
      opportunityRationalePrompt,
      rationaleInputs,
      workspaceId
    );

    // Persist enhanced rationale back to the opportunity record
    await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: {
        rationale: rationaleOutput.rationale,
        why_now: rationaleOutput.why_now,
        counterfactual: rationaleOutput.counterfactual,
        ...(rationaleOutput.impact_range && { impact_range: rationaleOutput.impact_range }),
      },
    });

    return rationaleOutput;
  } catch (error) {
    // Non-fatal: rationale enhancement failure must not block draft creation
    console.error("Opportunity rationale enhancement failed, continuing with existing values:", error);
    return null;
  }
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

function extractProductNameFromEvents(eventLinks: any[]): string | undefined {
  for (const link of eventLinks) {
    const payload = link.event.payload_json as any;
    if (payload.product_title) return payload.product_title;
    if (payload.product_name) return payload.product_name;
  }
  return undefined;
}

function buildEventsSummary(eventLinks: any[]): string {
  if (!eventLinks || eventLinks.length === 0) {
    return "No specific events recorded.";
  }

  return eventLinks
    .map((link: any) => {
      const event = link.event;
      return `Event type: ${event.type} at ${event.occurred_at}`;
    })
    .join("; ");
}

function calculateDiscountValue(context: Record<string, any>): number {
  // Smart discount calculation based on inventory risk
  const inventoryLevel = context.inventoryLevel || 0;
  const _velocityScore = context.velocityScore || 0;

  if (inventoryLevel > 100) return 15; // 15% for high inventory
  if (inventoryLevel > 50) return 20; // 20% for medium inventory
  if (inventoryLevel > 20) return 25; // 25% for low inventory
  return 30; // 30% for very low inventory
}

function resolveUrgencyLevel(context: Record<string, any>): "low" | "medium" | "high" {
  const inventoryLevel = context.inventoryLevel || 0;
  if (inventoryLevel <= 20) return "high";
  if (inventoryLevel <= 50) return "medium";
  return "low";
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
