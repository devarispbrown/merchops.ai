/**
 * Shopify Email Integration
 *
 * Creates email marketing activity drafts in Shopify via the Admin GraphQL API.
 * Drafts are always created with DRAFT status — the merchant reviews and sends
 * from the Shopify admin. This module never triggers a live send.
 *
 * Pattern follows klaviyo/connection.ts for connection management and reuses
 * getRecipients from actions/execute/email.ts for segment resolution.
 */

import crypto from 'crypto';

import { ShopifyConnectionStatus } from '@prisma/client';

import { prisma } from '../db/client';
import { getRecipients } from '../actions/execute/email';
import { ShopifyClient, ShopifyApiError } from './client';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateShopifyEmailDraftParams {
  workspaceId: string;
  subject: string;
  previewText: string;
  htmlBody: string;
  fromName?: string;
  recipientSegment: string;
}

export interface ShopifyEmailDraftResult {
  activityId: string;
  title: string;
  status: 'draft';
  recipientCount: number;
  /** Direct link into Shopify admin for the merchant to review and send. */
  shopifyAdminUrl: string;
  createdAt: string;
}

export interface ShopifyEmailDraft {
  activityId: string;
  title: string;
  status: string;
  createdAt: string;
}

// ============================================================================
// INTERNAL GRAPHQL RESPONSE SHAPES
// ============================================================================

/**
 * Response shape for the emailMarketingActivityCreate mutation.
 */
interface EmailMarketingActivityCreateResponse {
  emailMarketingActivityCreate: {
    emailMarketingActivity: {
      id: string;
      title: string;
      status: string;
      createdAt: string;
    } | null;
    userErrors: Array<{
      field: string[] | null;
      message: string;
    }>;
  };
}

/**
 * Response shape for the marketingActivities query.
 */
interface MarketingActivitiesQueryResponse {
  marketingActivities: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        status: {
          status: string;
        };
        createdAt: string;
      };
    }>;
  };
}

// ============================================================================
// GRAPHQL DOCUMENTS
// ============================================================================

/**
 * Shopify Email Marketing — create a draft marketing activity.
 *
 * Uses the emailMarketingActivityCreate mutation which is part of Shopify's
 * Email Marketing API (available on stores with Shopify Email installed).
 * The status is set to DRAFT so the merchant controls when it is sent.
 */
const EMAIL_MARKETING_ACTIVITY_CREATE_MUTATION = /* GraphQL */ `
  mutation emailMarketingActivityCreate($input: EmailMarketingActivityCreateInput!) {
    emailMarketingActivityCreate(input: $input) {
      emailMarketingActivity {
        id
        title
        status
        createdAt
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Query recent email marketing activities in DRAFT status.
 */
const MARKETING_ACTIVITIES_QUERY = /* GraphQL */ `
  query {
    marketingActivities(first: 20, query: "channel:email AND status:DRAFT") {
      edges {
        node {
          id
          title
          status {
            status
          }
          createdAt
        }
      }
    }
  }
`;

// ============================================================================
// CONNECTION HELPER
// ============================================================================

/**
 * Retrieve a ShopifyClient for the given workspace.
 *
 * Fetches the active ShopifyConnection from Prisma and constructs a client
 * using the stored domain and encrypted access token. ShopifyClient decrypts
 * the token internally via decryptToken() from shopify/oauth.ts.
 *
 * Throws if no active connection exists for the workspace.
 */
export async function getShopifyClientForWorkspace(
  workspaceId: string
): Promise<{ client: ShopifyClient; storeDomain: string }> {
  const connection = await prisma.shopifyConnection.findUnique({
    where: { workspace_id: workspaceId },
    select: {
      store_domain: true,
      access_token_encrypted: true,
      status: true,
    },
  });

  if (!connection) {
    throw new ShopifyApiError(
      `No Shopify connection found for workspace ${workspaceId}`
    );
  }

  if (connection.status !== ShopifyConnectionStatus.active) {
    throw new ShopifyApiError(
      `Shopify connection is not active for workspace ${workspaceId} (status: ${connection.status})`
    );
  }

  const client = new ShopifyClient(
    connection.store_domain,
    connection.access_token_encrypted
  );

  return { client, storeDomain: connection.store_domain };
}

// ============================================================================
// CREATE DRAFT
// ============================================================================

/**
 * Create an email marketing draft in Shopify Email.
 *
 * Steps:
 * 1. Obtain a ShopifyClient via the active connection for this workspace.
 * 2. Resolve the recipient count using getRecipients() so we know the
 *    estimated audience size before creating the draft.
 * 3. Call the emailMarketingActivityCreate GraphQL mutation with DRAFT status.
 * 4. Return structured result with the Shopify admin URL so the merchant can
 *    navigate directly to the draft and send when ready.
 *
 * Error handling:
 * - No active ShopifyConnection → ShopifyApiError with clear message
 * - GraphQL userErrors → ShopifyApiError with field + message from Shopify
 * - Rate limiting / network errors → handled by ShopifyClient (retry + backoff)
 */
export async function createShopifyEmailDraft(
  params: CreateShopifyEmailDraftParams
): Promise<ShopifyEmailDraftResult> {
  const {
    workspaceId,
    subject,
    previewText,
    htmlBody,
    fromName,
    recipientSegment,
  } = params;

  const correlationId = crypto.randomUUID();

  // eslint-disable-next-line no-console
  console.log('[Shopify Email] Creating draft', {
    correlationId,
    workspaceId,
    subject,
    recipientSegment,
  });

  // Step 1: Get a connected ShopifyClient
  const { client, storeDomain } = await getShopifyClientForWorkspace(workspaceId);

  // Step 2: Resolve recipient count from the segment
  // We call getRecipients() to get the real count — this mirrors the existing
  // email execution flow in actions/execute/email.ts and avoids re-implementing
  // the segment resolution logic.
  const recipients = await getRecipients(workspaceId, recipientSegment);
  const recipientCount = recipients.length;

  // eslint-disable-next-line no-console
  console.log('[Shopify Email] Resolved recipients', {
    correlationId,
    workspaceId,
    recipientSegment,
    recipientCount,
  });

  // Step 3: Call Shopify GraphQL mutation
  const variables: Record<string, unknown> = {
    input: {
      title: subject,
      emailBody: htmlBody,
      subject,
      previewText,
      ...(fromName && { fromName }),
      status: 'DRAFT',
    },
  };

  const data = await client.graphql<EmailMarketingActivityCreateResponse>(
    EMAIL_MARKETING_ACTIVITY_CREATE_MUTATION,
    variables,
    correlationId
  );

  // ShopifyClient.graphql() already extracts and throws on userErrors embedded
  // in the response envelope, but we also defensively check the mutation-level
  // userErrors array here so the error message carries field context.
  const { emailMarketingActivity, userErrors } =
    data.emailMarketingActivityCreate;

  if (userErrors && userErrors.length > 0) {
    const first = userErrors[0];
    const fieldLabel = first.field ? first.field.join('.') : 'unknown';
    throw new ShopifyApiError(
      `Shopify Email draft error on field '${fieldLabel}': ${first.message}`,
      undefined,
      userErrors,
      correlationId
    );
  }

  if (!emailMarketingActivity) {
    throw new ShopifyApiError(
      'Shopify Email draft creation returned no activity',
      undefined,
      data,
      correlationId
    );
  }

  const shopifyAdminUrl = `https://${storeDomain}/admin/email`;

  // eslint-disable-next-line no-console
  console.log('[Shopify Email] Draft created', {
    correlationId,
    workspaceId,
    activityId: emailMarketingActivity.id,
    shopifyAdminUrl,
  });

  return {
    activityId: emailMarketingActivity.id,
    title: emailMarketingActivity.title,
    status: 'draft',
    recipientCount,
    shopifyAdminUrl,
    createdAt: emailMarketingActivity.createdAt,
  };
}

// ============================================================================
// LIST DRAFTS
// ============================================================================

/**
 * Retrieve recent email marketing drafts from Shopify.
 *
 * Queries the marketingActivities connection filtered to channel:email and
 * DRAFT status, returning the 20 most recent activities. The merchant can
 * then use the Shopify admin to review and send each draft.
 *
 * Error handling follows the same pattern as createShopifyEmailDraft — network
 * and rate-limit errors are handled by ShopifyClient; connection absence throws
 * with a clear message.
 */
export async function getShopifyEmailDrafts(
  workspaceId: string
): Promise<ShopifyEmailDraft[]> {
  const correlationId = crypto.randomUUID();

  // eslint-disable-next-line no-console
  console.log('[Shopify Email] Fetching drafts', {
    correlationId,
    workspaceId,
  });

  const { client } = await getShopifyClientForWorkspace(workspaceId);

  const data = await client.graphql<MarketingActivitiesQueryResponse>(
    MARKETING_ACTIVITIES_QUERY,
    undefined,
    correlationId
  );

  const drafts: ShopifyEmailDraft[] = data.marketingActivities.edges.map(
    ({ node }) => ({
      activityId: node.id,
      title: node.title,
      status: node.status.status,
      createdAt: node.createdAt,
    })
  );

  // eslint-disable-next-line no-console
  console.log('[Shopify Email] Fetched drafts', {
    correlationId,
    workspaceId,
    count: drafts.length,
  });

  return drafts;
}
