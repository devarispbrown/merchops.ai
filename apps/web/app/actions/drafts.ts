/**
 * Action Draft Server Actions
 *
 * Handles draft creation, editing, and approval with proper validation,
 * workspace isolation, and execution queue management.
 */

'use server';

import {
  validatePayloadForExecutionType,
  type ExecutionType,
} from '@merchops/shared/schemas/action';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  ActionErrors,
  actionSuccess,
  handleUnknownError,
  type ActionResponse,
} from '@/lib/actions/errors';
import { validateInput } from '@/lib/actions/validation';
import { runWithCorrelationAsync, generateCorrelationId } from '@/lib/correlation';
import { getWorkspaceId } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import { logger } from '@/server/observability/logger';

// Validation schemas
const createDraftSchema = z.object({
  opportunityId: z.string().uuid('Invalid opportunity ID'),
});

const updateDraftSchema = z.object({
  id: z.string().uuid('Invalid draft ID'),
  data: z.record(z.unknown()),
});

const approveDraftSchema = z.object({
  id: z.string().uuid('Invalid draft ID'),
});

type CreateDraftResponse = ActionResponse<{
  draftId: string;
  opportunityId: string;
  executionType: string;
}>;

type UpdateDraftResponse = ActionResponse<{
  draftId: string;
  state: string;
}>;

type ApproveDraftResponse = ActionResponse<{
  draftId: string;
  executionId: string;
  jobId: string;
}>;

/**
 * Create action draft from opportunity
 *
 * Generates a draft action based on the opportunity type and context.
 * Uses AI to draft copy and parameters, which can then be edited by the user.
 *
 * @param opportunityId - Opportunity ID to create draft from
 */
export async function createDraftAction(
  opportunityId: string
): Promise<CreateDraftResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(createDraftSchema, { opportunityId });

      logger.info(
        {
          workspaceId,
          opportunityId: data.opportunityId,
        },
        'Creating action draft'
      );

      // Find opportunity and verify workspace access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: data.opportunityId },
      });

      if (!opportunity) {
        throw ActionErrors.notFound('Opportunity');
      }

      if (opportunity.workspace_id !== workspaceId) {
        logger.warn(
          {
            opportunityId: data.opportunityId,
            requestedWorkspace: workspaceId,
            actualWorkspace: opportunity.workspace_id,
          },
          'Unauthorized opportunity access attempt'
        );
        throw ActionErrors.unauthorized('You do not have access to this opportunity');
      }

      // Verify opportunity is in valid state for draft creation
      if (opportunity.state === 'dismissed' || opportunity.state === 'expired') {
        throw ActionErrors.invalidState(
          'Cannot create draft for dismissed or expired opportunity'
        );
      }

      // Check if draft already exists
      const existingDraft = await prisma.actionDraft.findFirst({
        where: {
          workspace_id: workspaceId,
          opportunity_id: data.opportunityId,
          state: { in: ['draft', 'edited'] },
        },
      });

      if (existingDraft) {
        logger.info(
          {
            workspaceId,
            opportunityId: data.opportunityId,
            existingDraftId: existingDraft.id,
          },
          'Draft already exists for this opportunity'
        );

        return actionSuccess({
          draftId: existingDraft.id,
          opportunityId: data.opportunityId,
          executionType: existingDraft.execution_type,
        });
      }

      // Use server-side draft creation logic
      const { createActionDraft } = await import('@/server/actions/drafts/create');

      const draft = await createActionDraft({
        workspaceId,
        opportunityId: data.opportunityId,
      });

      logger.info(
        {
          workspaceId,
          opportunityId: data.opportunityId,
          draftId: draft.id,
          executionType: draft.execution_type,
        },
        'Action draft created successfully'
      );

      // Revalidate pages
      revalidatePath('/queue');
      revalidatePath(`/opportunities/${data.opportunityId}`);

      return actionSuccess({
        draftId: draft.id,
        opportunityId: data.opportunityId,
        executionType: draft.execution_type,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Update action draft
 *
 * Allows editing of draft payload fields that are marked as editable.
 * Validates changes against execution type schema.
 *
 * @param id - Draft ID
 * @param data - Updated field values
 */
export async function updateDraftAction(
  id: string,
  data: Record<string, unknown>
): Promise<UpdateDraftResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const validated = validateInput(updateDraftSchema, { id, data });

      logger.info(
        {
          workspaceId,
          draftId: validated.id,
        },
        'Updating action draft'
      );

      // Find draft and verify workspace access
      const draft = await prisma.actionDraft.findUnique({
        where: { id: validated.id },
      });

      if (!draft) {
        throw ActionErrors.notFound('Action draft');
      }

      if (draft.workspace_id !== workspaceId) {
        logger.warn(
          {
            draftId: validated.id,
            requestedWorkspace: workspaceId,
            actualWorkspace: draft.workspace_id,
          },
          'Unauthorized draft access attempt'
        );
        throw ActionErrors.unauthorized('You do not have access to this draft');
      }

      // Verify draft can be edited
      if (draft.state !== 'draft' && draft.state !== 'edited') {
        throw ActionErrors.invalidState('Cannot edit draft in current state');
      }

      // Use server-side edit logic with field validation
      const { editActionDraft } = await import('@/server/actions/drafts/edit');

      const updated = await editActionDraft({
        draftId: validated.id,
        updates: validated.data,
      });

      logger.info(
        {
          workspaceId,
          draftId: updated.id,
          previousState: draft.state,
          newState: updated.state,
        },
        'Action draft updated successfully'
      );

      // Revalidate pages
      revalidatePath('/queue');
      revalidatePath(`/drafts/${validated.id}`);

      return actionSuccess({
        draftId: updated.id,
        state: updated.state,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Approve action draft
 *
 * Marks draft as approved and enqueues execution job.
 * Creates immutable execution record with idempotency key.
 *
 * @param id - Draft ID to approve
 */
export async function approveDraftAction(id: string): Promise<ApproveDraftResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(approveDraftSchema, { id });

      logger.info(
        {
          workspaceId,
          draftId: data.id,
        },
        'Approving action draft'
      );

      // Find draft and verify workspace access
      const draft = await prisma.actionDraft.findUnique({
        where: { id: data.id },
        include: {
          opportunity: true,
        },
      });

      if (!draft) {
        throw ActionErrors.notFound('Action draft');
      }

      if (draft.workspace_id !== workspaceId) {
        logger.warn(
          {
            draftId: data.id,
            requestedWorkspace: workspaceId,
            actualWorkspace: draft.workspace_id,
          },
          'Unauthorized draft access attempt'
        );
        throw ActionErrors.unauthorized('You do not have access to this draft');
      }

      // Verify draft can be approved
      if (draft.state !== 'draft' && draft.state !== 'edited') {
        throw ActionErrors.invalidState('Cannot approve draft in current state');
      }

      // Validate final payload against execution type schema
      try {
        validatePayloadForExecutionType(
          draft.execution_type as ExecutionType,
          draft.payload_json
        );
      } catch (validationError) {
        logger.error(
          {
            draftId: data.id,
            executionType: draft.execution_type,
            validationError,
          },
          'Draft payload validation failed'
        );
        throw ActionErrors.validationError('Draft payload is invalid');
      }

      // Use server-side approval logic
      const { approveActionDraft } = await import('@/server/actions/drafts/approve');

      const result = await approveActionDraft({
        draftId: data.id,
      });

      logger.info(
        {
          workspaceId,
          draftId: result.draft.id,
          executionId: result.execution.id,
          jobId: result.job.id,
          executionType: draft.execution_type,
        },
        'Action draft approved and execution queued'
      );

      // Revalidate pages
      revalidatePath('/queue');
      revalidatePath('/history');
      revalidatePath(`/drafts/${data.id}`);

      return actionSuccess({
        draftId: result.draft.id,
        executionId: result.execution.id,
        jobId: result.job.id,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}
