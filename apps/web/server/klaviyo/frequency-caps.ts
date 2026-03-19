/**
 * Klaviyo Frequency Cap Checking
 *
 * Prevents over-emailing customers by checking whether a given segment was
 * recently targeted by a Klaviyo campaign, and whether individual profiles are
 * suppressed from receiving marketing email.
 *
 * Design principles:
 *  - Gracefully degradable: if Klaviyo is not connected or the API fails, all
 *    checks return "not capped" so the opportunity engine is never blocked.
 *  - Non-blocking: callers must not await these checks in a way that prevents
 *    normal operation if the check is slow or unavailable.
 *  - No PII logging: email addresses are counted but never written to logs.
 */

import { getKlaviyoConnectionStatus, getKlaviyoClient } from './connection';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default number of days to look back when checking for recent campaigns. */
const DEFAULT_WINDOW_DAYS = 3;

// ============================================================================
// TYPES
// ============================================================================

export interface FrequencyCapOptions {
  /** How many days back to look for sent campaigns. Default: 3. */
  windowDays?: number;
}

export interface FrequencyCapResult {
  /** Whether the segment is currently capped (i.e. was recently emailed). */
  capped: boolean;
  /**
   * Machine-readable reason code:
   *  - "no_klaviyo_connection"   — workspace has no active Klaviyo connection; check skipped.
   *  - "klaviyo_api_error"       — Klaviyo API call failed; check skipped (graceful degradation).
   *  - "recently_sent"           — a campaign targeting this segment was sent within the window.
   *  - "not_recently_sent"       — no recent campaign found; segment is not capped.
   */
  reason: 'no_klaviyo_connection' | 'klaviyo_api_error' | 'recently_sent' | 'not_recently_sent';
  /** ISO timestamp of the most recent sent campaign targeting this segment, if found. */
  lastSentAt?: Date;
  /** Name of the most recent matching campaign, if found. */
  campaignName?: string;
}

export interface Recipient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface FilterSuppressionResult {
  /** Recipients who passed suppression check. */
  recipients: Recipient[];
  /** How many recipients were removed due to suppression. */
  suppressedCount: number;
  /** Whether the suppression check was actually performed (false = Klaviyo unavailable). */
  checked: boolean;
}

// ============================================================================
// FREQUENCY CAP CHECK
// ============================================================================

/**
 * Check whether the given segment was recently emailed via a Klaviyo campaign.
 *
 * The check looks for campaigns with `status === "Sent"` whose `send_time` falls
 * within the last `windowDays` days and whose name contains the segment label
 * (e.g. "dormant_30", "dormant_60", "dormant_90", "all_customers").
 *
 * This is a best-effort heuristic: Klaviyo does not expose the audience list on
 * the campaign list endpoint in a filterable way, so we match on campaign name.
 * Operators who use MerchOps to send campaigns will always have the segment
 * label in the name (set by the segment sync logic).
 *
 * @param workspaceId  - Workspace to check.
 * @param segment      - Segment identifier (e.g. "dormant_60").
 * @param options      - Optional configuration.
 */
export async function checkFrequencyCap(
  workspaceId: string,
  segment: string,
  options?: FrequencyCapOptions
): Promise<FrequencyCapResult> {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;

  // 1. Verify Klaviyo is connected — skip gracefully if not.
  let connectionStatus: Awaited<ReturnType<typeof getKlaviyoConnectionStatus>>;
  try {
    connectionStatus = await getKlaviyoConnectionStatus(workspaceId);
  } catch {
    // If we can't even read connection status, treat as no connection.
    return { capped: false, reason: 'no_klaviyo_connection' };
  }

  if (!connectionStatus || connectionStatus.status !== 'active') {
    return { capped: false, reason: 'no_klaviyo_connection' };
  }

  // 2. Query Klaviyo campaigns — degrade gracefully on any API error.
  let client: Awaited<ReturnType<typeof getKlaviyoClient>>;
  try {
    client = await getKlaviyoClient(workspaceId);
  } catch {
    return { capped: false, reason: 'klaviyo_api_error' };
  }

  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  let campaigns: Awaited<ReturnType<typeof client.getCampaigns>>;
  try {
    campaigns = await client.getCampaigns('Sent', windowStart);
  } catch {
    console.warn('[FrequencyCap] Klaviyo API error fetching campaigns — skipping cap check', {
      workspaceId,
      segment,
    });
    return { capped: false, reason: 'klaviyo_api_error' };
  }

  // 3. Look for a campaign whose name contains the segment identifier.
  //    MerchOps segment names follow the "MerchOps - <Segment Label>" pattern.
  //    The segment identifier (e.g. "dormant_60") is converted to multiple
  //    needle variants so we match both "dormant_60" and the human-readable
  //    "dormant 60" form that appears in list/campaign names like
  //    "MerchOps - Dormant 60 Days".
  const segmentNeedles = buildSegmentNeedles(segment);
  const matching = campaigns.filter((campaign) => {
    const name = campaign.attributes.name?.toLowerCase() ?? '';
    return segmentNeedles.some((needle) => name.includes(needle));
  });

  if (matching.length === 0) {
    return { capped: false, reason: 'not_recently_sent' };
  }

  // Find the most recently sent among the matches.
  const mostRecent = matching.reduce((best, current) => {
    const bestTime = best.attributes.send_time ? new Date(best.attributes.send_time).getTime() : 0;
    const currTime = current.attributes.send_time
      ? new Date(current.attributes.send_time).getTime()
      : 0;
    return currTime > bestTime ? current : best;
  });

  const lastSentAt = mostRecent.attributes.send_time
    ? new Date(mostRecent.attributes.send_time)
    : undefined;

  // eslint-disable-next-line no-console
  console.log('[FrequencyCap] Segment capped — recent campaign found', {
    workspaceId,
    segment,
    campaignName: mostRecent.attributes.name,
    windowDays,
  });

  return {
    capped: true,
    reason: 'recently_sent',
    lastSentAt,
    campaignName: mostRecent.attributes.name,
  };
}

// ============================================================================
// SUPPRESSION LIST
// ============================================================================

/**
 * Retrieve which of the provided email addresses are suppressed in Klaviyo.
 *
 * A profile is considered suppressed when:
 *  - Its email marketing consent is NOT "SUBSCRIBED", OR
 *  - Its `subscriptions.email.marketing.can_receive_email_marketing` is false, OR
 *  - It has any active suppressions on its email marketing channel.
 *
 * @param workspaceId - Workspace whose Klaviyo account to query.
 * @param emails      - List of email addresses to check.
 * @returns           - Set of lowercased suppressed email addresses.
 */
export async function getSuppressionList(
  workspaceId: string,
  emails: string[]
): Promise<Set<string>> {
  if (emails.length === 0) {
    return new Set();
  }

  // Verify connection exists before making API calls.
  let connectionStatus: Awaited<ReturnType<typeof getKlaviyoConnectionStatus>>;
  try {
    connectionStatus = await getKlaviyoConnectionStatus(workspaceId);
  } catch {
    return new Set();
  }

  if (!connectionStatus || connectionStatus.status !== 'active') {
    return new Set();
  }

  let client: Awaited<ReturnType<typeof getKlaviyoClient>>;
  try {
    client = await getKlaviyoClient(workspaceId);
  } catch {
    return new Set();
  }

  let profiles: Awaited<ReturnType<typeof client.getProfilesByEmail>>;
  try {
    profiles = await client.getProfilesByEmail(emails);
  } catch {
    console.warn('[FrequencyCap] Klaviyo API error fetching profiles — skipping suppression check', {
      workspaceId,
      // Log the count, never the actual addresses.
      emailCount: emails.length,
    });
    return new Set();
  }

  const suppressed = new Set<string>();

  for (const profile of profiles) {
    const email = profile.attributes.email?.toLowerCase();
    if (!email) {
      continue;
    }

    const marketing = profile.attributes.subscriptions?.email?.marketing;

    if (!marketing) {
      // No subscription data available — treat as not suppressed to avoid
      // false positives and silent data loss. Align with the consent-filtering
      // TODO comment in email.ts.
      continue;
    }

    const isSuppressed =
      marketing.consent === 'UNSUBSCRIBED' ||
      marketing.consent === 'NEVER_SUBSCRIBED' ||
      marketing.can_receive_email_marketing === false ||
      (Array.isArray(marketing.suppressions) && marketing.suppressions.length > 0);

    if (isSuppressed) {
      suppressed.add(email);
    }
  }

  return suppressed;
}

// ============================================================================
// FILTER SUPPRESSED RECIPIENTS
// ============================================================================

/**
 * Remove Klaviyo-suppressed profiles from a recipient list.
 *
 * Gracefully skips suppression filtering if Klaviyo is not connected or if the
 * API call fails — in that case all original recipients are returned unchanged
 * with `checked: false`.
 *
 * @param workspaceId - Workspace whose Klaviyo account to query.
 * @param recipients  - Candidate recipient list from `getRecipients()`.
 */
export async function filterSuppressedRecipients(
  workspaceId: string,
  recipients: Recipient[]
): Promise<FilterSuppressionResult> {
  if (recipients.length === 0) {
    return { recipients: [], suppressedCount: 0, checked: false };
  }

  const emails = recipients.map((r) => r.email);

  let suppressed: Set<string>;
  try {
    suppressed = await getSuppressionList(workspaceId, emails);
  } catch {
    // Should never reach here because getSuppressionList catches internally,
    // but guard defensively.
    return { recipients, suppressedCount: 0, checked: false };
  }

  // If suppression list is empty but the connection exists we still ran the
  // check — the result is just that no one is suppressed.
  const connectionStatus = await getKlaviyoConnectionStatus(workspaceId).catch(() => null);
  const checked = connectionStatus?.status === 'active';

  const filtered = recipients.filter((r) => !suppressed.has(r.email.toLowerCase()));
  const suppressedCount = recipients.length - filtered.length;

  if (suppressedCount > 0) {
    // eslint-disable-next-line no-console
    console.log('[FrequencyCap] Removed suppressed recipients', {
      workspaceId,
      suppressedCount,
      remainingCount: filtered.length,
    });
  }

  return {
    recipients: filtered,
    suppressedCount,
    checked,
  };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Build a list of lowercased search needles for matching a segment identifier
 * against Klaviyo campaign names.
 *
 * Example: "dormant_60" → ["dormant_60", "dormant 60"]
 *
 * This covers both the raw identifier and the space-separated form that
 * appears in MerchOps list/campaign names such as "MerchOps - Dormant 60 Days".
 */
function buildSegmentNeedles(segment: string): string[] {
  const lower = segment.toLowerCase();
  const withSpaces = lower.replace(/_/g, ' ');
  const needles = [lower];
  if (withSpaces !== lower) {
    needles.push(withSpaces);
  }
  return needles;
}
