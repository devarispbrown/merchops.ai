/**
 * Opportunity Management Server Actions
 *
 * Handles opportunity dismissal, state updates, and view tracking.
 * Ensures workspace isolation and audit logging.
 */

'use server';

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
const dismissOpportunitySchema = z.object({
  id: z.string().uuid('Invalid opportunity ID'),
  reason: z.string().optional(),
});

const markViewedSchema = z.object({
  id: z.string().uuid('Invalid opportunity ID'),
});

type DismissResponse = ActionResponse<{
  id: string;
  state: string;
}>;

type MarkViewedResponse = ActionResponse<{
  id: string;
  state: string;
}>;

/**
 * Dismiss an opportunity
 *
 * Marks opportunity as dismissed with optional reason.
 * Dismissed opportunities won't reappear unless underlying conditions materially change.
 *
 * @param id - Opportunity ID
 * @param reason - Optional dismissal reason
 */
export async function dismissOpportunity(
  id: string,
  reason?: string
): Promise<DismissResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(dismissOpportunitySchema, { id, reason });

      logger.info(
        {
          workspaceId,
          opportunityId: data.id,
          reason: data.reason,
        },
        'Dismissing opportunity'
      );

      // Find opportunity and verify workspace access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: data.id },
      });

      if (!opportunity) {
        throw ActionErrors.notFound('Opportunity');
      }

      if (opportunity.workspace_id !== workspaceId) {
        logger.warn(
          {
            opportunityId: data.id,
            requestedWorkspace: workspaceId,
            actualWorkspace: opportunity.workspace_id,
          },
          'Unauthorized opportunity access attempt'
        );
        throw ActionErrors.unauthorized('You do not have access to this opportunity');
      }

      // Verify opportunity can be dismissed
      if (opportunity.state === 'executed' || opportunity.state === 'resolved') {
        throw ActionErrors.invalidState(
          'Cannot dismiss an opportunity that has already been executed or resolved'
        );
      }

      // Update opportunity state
      const updated = await prisma.opportunity.update({
        where: { id: data.id },
        data: {
          state: 'dismissed',
          updated_at: new Date(),
        },
      });

      // Log dismissal for audit trail
      logger.info(
        {
          workspaceId,
          opportunityId: updated.id,
          previousState: opportunity.state,
          newState: updated.state,
          reason: data.reason,
        },
        'Opportunity dismissed successfully'
      );

      // Revalidate opportunity pages
      revalidatePath('/queue');
      revalidatePath('/');

      return actionSuccess({
        id: updated.id,
        state: updated.state,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}

/**
 * Mark opportunity as viewed
 *
 * Updates opportunity state from 'new' to 'viewed'.
 * Used to track which opportunities have been seen by the user.
 *
 * @param id - Opportunity ID
 */
export async function markOpportunityViewed(id: string): Promise<MarkViewedResponse> {
  return runWithCorrelationAsync({ correlationId: generateCorrelationId() }, async () => {
    try {
      // Get workspace ID and ensure user is authenticated
      const workspaceId = await getWorkspaceId();

      // Validate input
      const data = validateInput(markViewedSchema, { id });

      logger.debug(
        {
          workspaceId,
          opportunityId: data.id,
        },
        'Marking opportunity as viewed'
      );

      // Find opportunity and verify workspace access
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: data.id },
      });

      if (!opportunity) {
        throw ActionErrors.notFound('Opportunity');
      }

      if (opportunity.workspace_id !== workspaceId) {
        logger.warn(
          {
            opportunityId: data.id,
            requestedWorkspace: workspaceId,
            actualWorkspace: opportunity.workspace_id,
          },
          'Unauthorized opportunity access attempt'
        );
        throw ActionErrors.unauthorized('You do not have access to this opportunity');
      }

      // Only update if currently in 'new' state
      if (opportunity.state !== 'new') {
        // Already viewed or in different state, return current state
        return actionSuccess({
          id: opportunity.id,
          state: opportunity.state,
        });
      }

      // Update opportunity state to viewed
      const updated = await prisma.opportunity.update({
        where: { id: data.id },
        data: {
          state: 'viewed',
          updated_at: new Date(),
        },
      });

      logger.info(
        {
          workspaceId,
          opportunityId: updated.id,
          previousState: opportunity.state,
          newState: updated.state,
        },
        'Opportunity marked as viewed'
      );

      // Revalidate opportunity pages
      revalidatePath('/queue');
      revalidatePath('/');

      return actionSuccess({
        id: updated.id,
        state: updated.state,
      });
    } catch (error) {
      return handleUnknownError(error);
    }
  });
}
