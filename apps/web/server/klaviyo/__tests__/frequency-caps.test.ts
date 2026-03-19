/**
 * Frequency Caps Unit Tests
 *
 * Covers:
 *  checkFrequencyCap:
 *    - No Klaviyo connection → not capped (graceful skip)
 *    - No recent campaigns → not capped
 *    - Recent campaign for segment → capped with details
 *    - Campaign outside window → not capped
 *    - windowDays option is honoured
 *    - Klaviyo API error → not capped (graceful degradation)
 *    - getKlaviyoConnectionStatus throws → not capped (graceful degradation)
 *
 *  getSuppressionList:
 *    - Empty email list → empty set
 *    - No Klaviyo connection → empty set
 *    - Profile with UNSUBSCRIBED consent → suppressed
 *    - Profile with NEVER_SUBSCRIBED consent → suppressed
 *    - Profile with can_receive_email_marketing=false → suppressed
 *    - Profile with active suppressions array → suppressed
 *    - Profile with SUBSCRIBED consent → not suppressed
 *    - Profile with no subscription data → not suppressed (avoid false positives)
 *    - Klaviyo API error → empty set (graceful degradation)
 *
 *  filterSuppressedRecipients:
 *    - Empty recipient list → returns empty with suppressedCount=0
 *    - Suppressed profiles are removed from the list
 *    - Unsuppressed profiles pass through unchanged
 *    - No Klaviyo connection → all recipients returned, checked=false
 *    - Mixed suppressed / unsuppressed → only unsuppressed returned
 *
 * All Klaviyo API calls are mocked — no network traffic.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  checkFrequencyCap,
  getSuppressionList,
  filterSuppressedRecipients,
  type Recipient,
} from '../frequency-caps';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetKlaviyoConnectionStatus = vi.fn();
const mockGetKlaviyoClient = vi.fn();
const mockGetCampaigns = vi.fn();
const mockGetProfilesByEmail = vi.fn();

vi.mock('../connection', () => ({
  getKlaviyoConnectionStatus: (...args: unknown[]) =>
    mockGetKlaviyoConnectionStatus(...args),
  getKlaviyoClient: (...args: unknown[]) => mockGetKlaviyoClient(...args),
}));

// ============================================================================
// HELPERS
// ============================================================================

function activeConnection(workspaceId = 'ws-1') {
  return {
    workspaceId,
    status: 'active',
    connectedAt: new Date('2024-01-01'),
    revokedAt: null,
    lastSyncedAt: null,
  };
}

function makeClient() {
  return {
    getCampaigns: mockGetCampaigns,
    getProfilesByEmail: mockGetProfilesByEmail,
  };
}

function makeCampaign(
  overrides: {
    name?: string;
    status?: string;
    send_time?: string | null;
  } = {}
) {
  return {
    type: 'campaign' as const,
    id: 'camp-1',
    attributes: {
      name: overrides.name ?? 'MerchOps - Dormant 60 Days',
      status: overrides.status ?? 'Sent',
      archived: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      scheduled_at: null,
      send_time: overrides.send_time !== undefined ? overrides.send_time : new Date().toISOString(),
    },
  };
}

function makeProfile(
  email: string,
  marketingOverride?: Partial<{
    consent: string;
    can_receive_email_marketing: boolean;
    suppressions: Array<{ reason: string; timestamp: string }>;
  }>
) {
  return {
    type: 'profile' as const,
    id: `profile-${email}`,
    attributes: {
      email,
      subscriptions:
        marketingOverride !== undefined
          ? { email: { marketing: marketingOverride } }
          : undefined,
    },
  };
}

// ============================================================================
// checkFrequencyCap
// ============================================================================

describe('checkFrequencyCap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns not capped with reason=no_klaviyo_connection when no connection exists', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(null);

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('no_klaviyo_connection');
    expect(mockGetKlaviyoClient).not.toHaveBeenCalled();
  });

  test('returns not capped when connection is revoked', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue({
      ...activeConnection(),
      status: 'revoked',
    });

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('no_klaviyo_connection');
  });

  test('returns not capped when getKlaviyoConnectionStatus throws', async () => {
    mockGetKlaviyoConnectionStatus.mockRejectedValue(new Error('db error'));

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('no_klaviyo_connection');
  });

  test('returns not capped with reason=klaviyo_api_error when getKlaviyoClient throws', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockRejectedValue(new Error('decrypt failed'));

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('klaviyo_api_error');
  });

  test('returns not capped when getCampaigns API call throws', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockRejectedValue(new Error('Klaviyo 500'));

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('klaviyo_api_error');
  });

  test('returns not capped when no campaigns are returned', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([]);

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('not_recently_sent');
  });

  test('returns not capped when no campaign name matches the segment', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([
      makeCampaign({ name: 'MerchOps - Dormant 30 Days' }),
    ]);

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(false);
    expect(result.reason).toBe('not_recently_sent');
  });

  test('returns capped with details when a matching recent campaign exists', async () => {
    const sendTime = new Date('2026-03-18T10:00:00Z').toISOString();

    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([
      makeCampaign({ name: 'MerchOps - Dormant 60 Days', send_time: sendTime }),
    ]);

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(true);
    expect(result.reason).toBe('recently_sent');
    expect(result.campaignName).toBe('MerchOps - Dormant 60 Days');
    expect(result.lastSentAt).toBeInstanceOf(Date);
    expect(result.lastSentAt?.toISOString()).toBe(sendTime);
  });

  test('returns the most recently sent campaign when multiple match', async () => {
    const olderTime = new Date('2026-03-15T00:00:00Z').toISOString();
    const newerTime = new Date('2026-03-17T00:00:00Z').toISOString();

    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([
      makeCampaign({ name: 'MerchOps - Dormant 60 Days v1', send_time: olderTime }),
      makeCampaign({ name: 'MerchOps - Dormant 60 Days v2', send_time: newerTime }),
    ]);

    const result = await checkFrequencyCap('ws-1', 'dormant_60');

    expect(result.capped).toBe(true);
    expect(result.campaignName).toBe('MerchOps - Dormant 60 Days v2');
    expect(result.lastSentAt?.toISOString()).toBe(newerTime);
  });

  test('passes windowDays option through to getCampaigns as a date filter', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([]);

    await checkFrequencyCap('ws-1', 'dormant_60', { windowDays: 7 });

    expect(mockGetCampaigns).toHaveBeenCalledOnce();
    const [status, sentAfter] = mockGetCampaigns.mock.calls[0];
    expect(status).toBe('Sent');
    // sentAfter should be approximately 7 days ago
    const expectedStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const diffMs = Math.abs((sentAfter as Date).getTime() - expectedStart.getTime());
    expect(diffMs).toBeLessThan(5000); // within 5 s tolerance
  });

  test('defaults to windowDays=3 when no options are provided', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetCampaigns.mockResolvedValue([]);

    await checkFrequencyCap('ws-1', 'dormant_30');

    const [, sentAfter] = mockGetCampaigns.mock.calls[0];
    const expectedStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const diffMs = Math.abs((sentAfter as Date).getTime() - expectedStart.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  test('matching is case-insensitive on campaign name vs segment', async () => {
    const sendTime = new Date().toISOString();

    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    // Campaign name uses upper-case segment variant
    mockGetCampaigns.mockResolvedValue([
      makeCampaign({ name: 'DORMANT_90 Re-engagement', send_time: sendTime }),
    ]);

    const result = await checkFrequencyCap('ws-1', 'dormant_90');

    expect(result.capped).toBe(true);
    expect(result.reason).toBe('recently_sent');
  });
});

// ============================================================================
// getSuppressionList
// ============================================================================

describe('getSuppressionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty set for empty email list without calling the API', async () => {
    const result = await getSuppressionList('ws-1', []);

    expect(result.size).toBe(0);
    expect(mockGetKlaviyoConnectionStatus).not.toHaveBeenCalled();
  });

  test('returns empty set when no Klaviyo connection exists', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(null);

    const result = await getSuppressionList('ws-1', ['a@example.com']);

    expect(result.size).toBe(0);
    expect(mockGetKlaviyoClient).not.toHaveBeenCalled();
  });

  test('returns empty set when getProfilesByEmail throws', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockRejectedValue(new Error('API error'));

    const result = await getSuppressionList('ws-1', ['a@example.com']);

    expect(result.size).toBe(0);
  });

  test('returns empty set when profiles have no subscription data', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('a@example.com'), // no subscription data
    ]);

    const result = await getSuppressionList('ws-1', ['a@example.com']);

    // Absent subscription data is treated as not suppressed to avoid false positives
    expect(result.size).toBe(0);
  });

  test('marks profile with UNSUBSCRIBED consent as suppressed', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('a@example.com', { consent: 'UNSUBSCRIBED' }),
    ]);

    const result = await getSuppressionList('ws-1', ['a@example.com']);

    expect(result.has('a@example.com')).toBe(true);
  });

  test('marks profile with NEVER_SUBSCRIBED consent as suppressed', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('b@example.com', { consent: 'NEVER_SUBSCRIBED' }),
    ]);

    const result = await getSuppressionList('ws-1', ['b@example.com']);

    expect(result.has('b@example.com')).toBe(true);
  });

  test('marks profile with can_receive_email_marketing=false as suppressed', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('c@example.com', { can_receive_email_marketing: false }),
    ]);

    const result = await getSuppressionList('ws-1', ['c@example.com']);

    expect(result.has('c@example.com')).toBe(true);
  });

  test('marks profile with non-empty suppressions array as suppressed', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('d@example.com', {
        suppressions: [{ reason: 'UNSUBSCRIBE', timestamp: '2026-01-01T00:00:00Z' }],
      }),
    ]);

    const result = await getSuppressionList('ws-1', ['d@example.com']);

    expect(result.has('d@example.com')).toBe(true);
  });

  test('does not suppress profile with SUBSCRIBED consent', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('e@example.com', { consent: 'SUBSCRIBED', can_receive_email_marketing: true }),
    ]);

    const result = await getSuppressionList('ws-1', ['e@example.com']);

    expect(result.has('e@example.com')).toBe(false);
  });

  test('handles mixed suppressed and active profiles correctly', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('active@example.com', { consent: 'SUBSCRIBED' }),
      makeProfile('suppressed@example.com', { consent: 'UNSUBSCRIBED' }),
    ]);

    const result = await getSuppressionList('ws-1', [
      'active@example.com',
      'suppressed@example.com',
    ]);

    expect(result.has('active@example.com')).toBe(false);
    expect(result.has('suppressed@example.com')).toBe(true);
    expect(result.size).toBe(1);
  });

  test('normalises emails to lowercase before adding to suppression set', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    // Klaviyo returns the email in mixed case
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('Upper@Example.COM', { consent: 'UNSUBSCRIBED' }),
    ]);

    const result = await getSuppressionList('ws-1', ['Upper@Example.COM']);

    expect(result.has('upper@example.com')).toBe(true);
  });
});

// ============================================================================
// filterSuppressedRecipients
// ============================================================================

describe('filterSuppressedRecipients', () => {
  const makeRecipient = (email: string, id = email): Recipient => ({
    id,
    email,
    firstName: 'Test',
    lastName: 'User',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty result immediately for empty recipient list', async () => {
    const result = await filterSuppressedRecipients('ws-1', []);

    expect(result.recipients).toHaveLength(0);
    expect(result.suppressedCount).toBe(0);
    expect(result.checked).toBe(false);
    expect(mockGetKlaviyoConnectionStatus).not.toHaveBeenCalled();
  });

  test('returns all recipients when no Klaviyo connection exists', async () => {
    // getSuppressionList returns empty set → filterSuppressedRecipients
    // then calls getKlaviyoConnectionStatus again to set "checked"
    mockGetKlaviyoConnectionStatus.mockResolvedValue(null);

    const recipients = [makeRecipient('a@example.com'), makeRecipient('b@example.com')];
    const result = await filterSuppressedRecipients('ws-1', recipients);

    expect(result.recipients).toHaveLength(2);
    expect(result.suppressedCount).toBe(0);
    expect(result.checked).toBe(false);
  });

  test('removes suppressed profiles from the recipient list', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('suppressed@example.com', { consent: 'UNSUBSCRIBED' }),
      makeProfile('active@example.com', { consent: 'SUBSCRIBED' }),
    ]);

    const recipients = [
      makeRecipient('suppressed@example.com'),
      makeRecipient('active@example.com'),
    ];
    const result = await filterSuppressedRecipients('ws-1', recipients);

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].email).toBe('active@example.com');
    expect(result.suppressedCount).toBe(1);
    expect(result.checked).toBe(true);
  });

  test('returns all recipients unchanged when suppression list is empty', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('a@example.com', { consent: 'SUBSCRIBED' }),
      makeProfile('b@example.com', { consent: 'SUBSCRIBED' }),
    ]);

    const recipients = [makeRecipient('a@example.com'), makeRecipient('b@example.com')];
    const result = await filterSuppressedRecipients('ws-1', recipients);

    expect(result.recipients).toHaveLength(2);
    expect(result.suppressedCount).toBe(0);
    expect(result.checked).toBe(true);
  });

  test('filtering is case-insensitive on recipient email', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    // Klaviyo returns lowercase; recipient list has mixed case
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('User@Example.COM', { consent: 'UNSUBSCRIBED' }),
    ]);

    const recipients = [makeRecipient('User@Example.COM')];
    const result = await filterSuppressedRecipients('ws-1', recipients);

    // The profile email normalises to 'user@example.com' which should match
    // the recipient's email when also normalised.
    expect(result.suppressedCount).toBe(1);
    expect(result.recipients).toHaveLength(0);
  });

  test('preserves recipient metadata (id, firstName, lastName) for unsuppressed profiles', async () => {
    mockGetKlaviyoConnectionStatus.mockResolvedValue(activeConnection());
    mockGetKlaviyoClient.mockResolvedValue(makeClient());
    mockGetProfilesByEmail.mockResolvedValue([
      makeProfile('jane@example.com', { consent: 'SUBSCRIBED' }),
    ]);

    const recipient: Recipient = {
      id: 'cust-99',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    const result = await filterSuppressedRecipients('ws-1', [recipient]);

    expect(result.recipients[0]).toEqual(recipient);
  });
});
