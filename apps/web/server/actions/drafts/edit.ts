/**
 * MerchOps Draft Editing
 * Validates and updates editable fields in action drafts
 */

import { prisma } from "../../db/client";
import { ActionDraftState, getPayloadSchema, getEditableFields } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface UpdateDraftInput {
  workspaceId: string;
  draftId: string;
  updates: Record<string, any>; // Field path -> new value
}

interface UpdateDraftResult {
  success: boolean;
  draft: any;
  errors?: Array<{ field: string; message: string }>;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function updateDraft(input: UpdateDraftInput): Promise<UpdateDraftResult> {
  const { workspaceId, draftId, updates } = input;

  // Fetch draft
  const draft = await prisma.actionDraft.findFirst({
    where: {
      id: draftId,
      workspace_id: workspaceId,
    },
  });

  if (!draft) {
    throw new Error("Draft not found or access denied");
  }

  // Validate draft is in editable state
  if (![ActionDraftState.DRAFT, ActionDraftState.EDITED].includes(draft.state as ActionDraftState)) {
    throw new Error("Draft cannot be edited in current state");
  }

  // Validate updates against editable fields
  const validationResult = validateUpdates({
    draft,
    updates,
  });

  if (!validationResult.valid) {
    return {
      success: false,
      draft,
      errors: validationResult.errors,
    };
  }

  // Apply updates to payload
  const updatedPayload = applyUpdates(draft.payload_json as any, updates);

  // Validate complete payload against schema
  try {
    const schema = getPayloadSchema(draft.execution_type as any);
    schema.parse(updatedPayload);
  } catch (error: any) {
    return {
      success: false,
      draft,
      errors: [
        {
          field: "payload",
          message: `Payload validation failed: ${error.message}`,
        },
      ],
    };
  }

  // Update draft
  const updatedDraft = await prisma.actionDraft.update({
    where: { id: draftId },
    data: {
      payload_json: updatedPayload as any,
      state: ActionDraftState.EDITED,
      updated_at: new Date(),
    },
  });

  return {
    success: true,
    draft: updatedDraft,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
}

function validateUpdates(params: {
  draft: any;
  updates: Record<string, any>;
}): ValidationResult {
  const { draft, updates } = params;
  const errors: Array<{ field: string; message: string }> = [];

  // Get editable fields configuration
  const editableFields = getEditableFields(draft.execution_type);
  const editableFieldPaths = new Set(editableFields.map((f) => f.path));

  // Check if all update fields are editable
  for (const fieldPath of Object.keys(updates)) {
    if (!editableFieldPaths.has(fieldPath)) {
      errors.push({
        field: fieldPath,
        message: `Field '${fieldPath}' is not editable`,
      });
      continue;
    }

    // Validate individual field
    const fieldConfig = editableFields.find((f) => f.path === fieldPath);
    if (!fieldConfig) continue;

    const value = updates[fieldPath];

    // Type validation
    if (fieldConfig.validation) {
      try {
        fieldConfig.validation.parse(value);
      } catch (error: any) {
        errors.push({
          field: fieldPath,
          message: error.message,
        });
      }
    }

    // Required check
    if (fieldConfig.required && (value === null || value === undefined || value === "")) {
      errors.push({
        field: fieldPath,
        message: `Field '${fieldConfig.label}' is required`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PAYLOAD UPDATES
// ============================================================================

function applyUpdates(payload: any, updates: Record<string, any>): any {
  const updatedPayload = { ...payload };

  for (const [path, value] of Object.entries(updates)) {
    // Handle nested paths (e.g., "config.value")
    const parts = path.split(".");
    if (parts.length === 1) {
      updatedPayload[path] = value;
    } else {
      // Nested update
      let current = updatedPayload;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
  }

  return updatedPayload;
}

// ============================================================================
// HELPERS
// ============================================================================

export async function getDraftForEdit(workspaceId: string, draftId: string) {
  const draft = await prisma.actionDraft.findFirst({
    where: {
      id: draftId,
      workspace_id: workspaceId,
    },
    include: {
      opportunity: {
        select: {
          id: true,
          type: true,
          why_now: true,
          rationale: true,
          counterfactual: true,
        },
      },
    },
  });

  if (!draft) {
    throw new Error("Draft not found or access denied");
  }

  return {
    id: draft.id,
    state: draft.state,
    executionType: draft.execution_type,
    operatorIntent: draft.operator_intent,
    payload: draft.payload_json,
    editableFields: draft.editable_fields_json,
    opportunity: draft.opportunity,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
  };
}

// ============================================================================
// EXPORTED WRAPPER FOR SERVER ACTIONS
// ============================================================================

/**
 * Edit action draft - wrapper for server actions compatibility
 * Maps from server action interface to internal implementation
 */
export async function editActionDraft(params: {
  draftId: string;
  updates: Record<string, unknown>;
}): Promise<any> {
  // Fetch draft to get workspace ID
  const draft = await prisma.actionDraft.findUnique({
    where: { id: params.draftId },
  });

  if (!draft) {
    throw new Error("Draft not found");
  }

  return updateDraft({
    workspaceId: draft.workspace_id,
    draftId: params.draftId,
    updates: params.updates,
  });
}
