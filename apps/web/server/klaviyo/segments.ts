/**
 * Klaviyo Segment Sync
 *
 * Resolves a customer segment from the ShopifyObjectCache and syncs it to a
 * Klaviyo list.  Reuses the same segment resolution logic as the email executor
 * (`getRecipients`) so the two integrations stay in sync.
 *
 * Steps:
 *  1. Resolve customers matching the segment from ShopifyObjectCache.
 *  2. Find or create a Klaviyo list named "MerchOps - {label}".
 *  3. Map customers to Klaviyo profile objects.
 *  4. Batch-add profiles in groups of 100.
 *  5. Update last_synced_at on the connection record.
 *  6. Return { listId, profileCount, listName }.
 */

import { getKlaviyoClient, markKlaviyoSynced } from './connection';
import { getRecipients } from '../actions/execute/email';

// ============================================================================
// TYPES
// ============================================================================

export interface SegmentSyncResult {
  listId: string;
  listName: string;
  profileCount: number;
}

// ============================================================================
// SEGMENT LABEL MAP
// ============================================================================

/** Human-readable Klaviyo list name per segment identifier. */
const SEGMENT_LABELS: Record<string, string> = {
  dormant_30: 'Dormant 30 Days',
  dormant_60: 'Dormant 60 Days',
  dormant_90: 'Dormant 90 Days',
  all_customers: 'All Customers',
};

function getListName(segmentType: string, customName?: string): string {
  if (customName && customName.trim().length > 0) {
    return customName.trim();
  }
  const label = SEGMENT_LABELS[segmentType] ?? segmentType;
  return `MerchOps - ${label}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Sync a customer segment to a Klaviyo list.
 *
 * @param workspaceId  - Workspace whose ShopifyObjectCache is queried.
 * @param segmentType  - Segment identifier (e.g. "dormant_60").
 * @param listName     - Optional override for the Klaviyo list name.
 *                       Defaults to "MerchOps - {Segment Label}".
 */
export async function syncSegmentToKlaviyo(
  workspaceId: string,
  segmentType: string,
  listName?: string
): Promise<SegmentSyncResult> {
  // eslint-disable-next-line no-console
  console.log('[Klaviyo Segment] Starting sync', { workspaceId, segmentType });

  // Resolve customers matching the segment
  const recipients = await getRecipients(workspaceId, segmentType);

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Segment] Recipients resolved', {
    workspaceId,
    segmentType,
    count: recipients.length,
  });

  // Obtain a client for this workspace
  const client = await getKlaviyoClient(workspaceId);

  const targetListName = getListName(segmentType, listName);

  // Find or create the target list
  const listId = await findOrCreateList(client, targetListName);

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Segment] List ready', { workspaceId, listId, listName: targetListName });

  if (recipients.length > 0) {
    // Map to Klaviyo profile format
    const profiles = recipients.map((r) => ({
      email: r.email,
      first_name: r.firstName,
      last_name: r.lastName,
      properties: {
        source: 'merchops',
        segment: segmentType,
      },
    }));

    // Add to list (batching handled inside addProfilesToList)
    await client.addProfilesToList(listId, profiles);
  }

  // Mark connection as synced
  await markKlaviyoSynced(workspaceId);

  // eslint-disable-next-line no-console
  console.log('[Klaviyo Segment] Sync complete', {
    workspaceId,
    listId,
    listName: targetListName,
    profileCount: recipients.length,
  });

  return {
    listId,
    listName: targetListName,
    profileCount: recipients.length,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find a list by name or create it if it does not exist.
 * Returns the list ID.
 */
async function findOrCreateList(
  client: import('./client').KlaviyoClient,
  name: string
): Promise<string> {
  const lists = await client.getLists();
  const existing = lists.find((l) => l.attributes.name === name);

  if (existing) {
    return existing.id;
  }

  const created = await client.createList(name);
  return created.id;
}
