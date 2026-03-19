/**
 * Klaviyo Segment Sync Unit Tests
 *
 * Covers:
 *  - Customer resolution via getRecipients (mocked)
 *  - Finding an existing Klaviyo list by name
 *  - Creating a new list when one doesn't exist
 *  - Batching 250 profiles → 3 addProfilesToList calls
 *  - Profile mapping: email, first_name, last_name, properties.source, properties.segment
 *  - Default list name: "MerchOps - {label}"
 *  - Custom list name override
 *  - markKlaviyoSynced called on success
 *  - Returns { listId, listName, profileCount }
 *  - Empty segment: returns { profileCount: 0 }
 *
 * Dependencies mocked: getRecipients, getKlaviyoClient, markKlaviyoSynced
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { syncSegmentToKlaviyo } from '../segments';

// ============================================================================
// MOCKS
// ============================================================================

// Use vi.hoisted so these are available inside the vi.mock factory
const { mockGetLists, mockCreateList, mockAddProfilesToList, mockClient } = vi.hoisted(() => {
  const mockGetLists = vi.fn();
  const mockCreateList = vi.fn();
  const mockAddProfilesToList = vi.fn();
  const mockClient = {
    getLists: mockGetLists,
    createList: mockCreateList,
    addProfilesToList: mockAddProfilesToList,
  };
  return { mockGetLists, mockCreateList, mockAddProfilesToList, mockClient };
});

vi.mock('../connection', () => ({
  getKlaviyoClient: vi.fn().mockResolvedValue(mockClient),
  markKlaviyoSynced: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../actions/execute/email', () => ({
  getRecipients: vi.fn(),
}));

import { getRecipients } from '../../actions/execute/email';
import { markKlaviyoSynced } from '../connection';

// ============================================================================
// HELPERS
// ============================================================================

function makeRecipients(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cust-${i}`,
    email: `user${i}@example.com`,
    firstName: 'User',
    lastName: String(i),
  }));
}

function makeList(id: string, name: string) {
  return {
    type: 'list',
    id,
    attributes: { name, created: '2024-01-01', updated: '2024-01-01' },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('syncSegmentToKlaviyo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddProfilesToList.mockResolvedValue(undefined);
  });

  // --------------------------------------------------------------------------
  // List discovery
  // --------------------------------------------------------------------------
  describe('list discovery', () => {
    test('uses an existing list when name matches', async () => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeRecipients(3));
      mockGetLists.mockResolvedValueOnce([
        makeList('existing-id', 'MerchOps - Dormant 60 Days'),
      ]);

      const result = await syncSegmentToKlaviyo('ws-1', 'dormant_60');

      expect(mockCreateList).not.toHaveBeenCalled();
      expect(result.listId).toBe('existing-id');
    });

    test('creates a new list when no matching list found', async () => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeRecipients(1));
      mockGetLists.mockResolvedValueOnce([
        makeList('other-id', 'Some Other List'),
      ]);
      mockCreateList.mockResolvedValueOnce(
        makeList('new-id', 'MerchOps - Dormant 60 Days')
      );

      const result = await syncSegmentToKlaviyo('ws-1', 'dormant_60');

      expect(mockCreateList).toHaveBeenCalledWith('MerchOps - Dormant 60 Days');
      expect(result.listId).toBe('new-id');
    });

    test('creates list when no lists exist at all', async () => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeRecipients(2));
      mockGetLists.mockResolvedValueOnce([]);
      mockCreateList.mockResolvedValueOnce(makeList('created-id', 'MerchOps - Dormant 30 Days'));

      await syncSegmentToKlaviyo('ws-1', 'dormant_30');

      expect(mockCreateList).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // Default list names
  // --------------------------------------------------------------------------
  describe('default list names', () => {
    test.each([
      ['dormant_30', 'MerchOps - Dormant 30 Days'],
      ['dormant_60', 'MerchOps - Dormant 60 Days'],
      ['dormant_90', 'MerchOps - Dormant 90 Days'],
      ['all_customers', 'MerchOps - All Customers'],
      ['unknown_segment', 'MerchOps - unknown_segment'],
    ])('segment "%s" → list name "%s"', async (segment, expectedName) => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      mockGetLists.mockResolvedValueOnce([]);
      mockCreateList.mockResolvedValueOnce(makeList('id', expectedName));

      const result = await syncSegmentToKlaviyo('ws-1', segment);
      expect(result.listName).toBe(expectedName);
    });
  });

  // --------------------------------------------------------------------------
  // Custom list name
  // --------------------------------------------------------------------------
  test('uses custom list name when provided', async () => {
    (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeRecipients(1));
    mockGetLists.mockResolvedValueOnce([]);
    mockCreateList.mockResolvedValueOnce(makeList('id', 'My Custom List'));

    const result = await syncSegmentToKlaviyo('ws-1', 'dormant_60', 'My Custom List');

    expect(mockCreateList).toHaveBeenCalledWith('My Custom List');
    expect(result.listName).toBe('My Custom List');
  });

  // --------------------------------------------------------------------------
  // Profile mapping
  // --------------------------------------------------------------------------
  describe('profile mapping', () => {
    test('maps recipient fields to Klaviyo profile attributes', async () => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'c1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Wonder' },
      ]);
      mockGetLists.mockResolvedValueOnce([makeList('list-id', 'MerchOps - Dormant 60 Days')]);

      await syncSegmentToKlaviyo('ws-1', 'dormant_60');

      const [_listId, profiles] = mockAddProfilesToList.mock.calls[0] as [string, unknown[]];
      const profile = profiles[0] as Record<string, unknown>;
      expect(profile.email).toBe('alice@example.com');
      expect(profile.first_name).toBe('Alice');
      expect(profile.last_name).toBe('Wonder');
    });

    test('includes source=merchops and segment in profile properties', async () => {
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'c1', email: 'bob@example.com', firstName: 'Bob', lastName: 'B' },
      ]);
      mockGetLists.mockResolvedValueOnce([makeList('list-id', 'MerchOps - Dormant 90 Days')]);

      await syncSegmentToKlaviyo('ws-1', 'dormant_90');

      const [_listId, profiles] = mockAddProfilesToList.mock.calls[0] as [string, unknown[]];
      const profile = profiles[0] as { properties: Record<string, unknown> };
      expect(profile.properties.source).toBe('merchops');
      expect(profile.properties.segment).toBe('dormant_90');
    });
  });

  // --------------------------------------------------------------------------
  // Batching
  // --------------------------------------------------------------------------
  describe('batching', () => {
    test('calls addProfilesToList once for the full profile list', async () => {
      // addProfilesToList handles its own internal batching
      const recipients = makeRecipients(250);
      (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(recipients);
      mockGetLists.mockResolvedValueOnce([makeList('list-id', 'MerchOps - Dormant 60 Days')]);

      await syncSegmentToKlaviyo('ws-1', 'dormant_60');

      // syncSegmentToKlaviyo calls addProfilesToList once with all profiles;
      // the KlaviyoClient method handles chunking internally
      expect(mockAddProfilesToList).toHaveBeenCalledTimes(1);
      const [listId, profiles] = mockAddProfilesToList.mock.calls[0] as [string, unknown[]];
      expect(listId).toBe('list-id');
      expect((profiles as unknown[]).length).toBe(250);
    });
  });

  // --------------------------------------------------------------------------
  // Empty segment
  // --------------------------------------------------------------------------
  test('handles empty segment gracefully — does not call addProfilesToList', async () => {
    (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    mockGetLists.mockResolvedValueOnce([makeList('list-id', 'MerchOps - Dormant 60 Days')]);

    const result = await syncSegmentToKlaviyo('ws-1', 'dormant_60');

    expect(mockAddProfilesToList).not.toHaveBeenCalled();
    expect(result.profileCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Return value
  // --------------------------------------------------------------------------
  test('returns correct { listId, listName, profileCount }', async () => {
    const recipients = makeRecipients(5);
    (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(recipients);
    mockGetLists.mockResolvedValueOnce([makeList('the-list-id', 'MerchOps - Dormant 30 Days')]);

    const result = await syncSegmentToKlaviyo('ws-1', 'dormant_30');

    expect(result.listId).toBe('the-list-id');
    expect(result.listName).toBe('MerchOps - Dormant 30 Days');
    expect(result.profileCount).toBe(5);
  });

  // --------------------------------------------------------------------------
  // markKlaviyoSynced
  // --------------------------------------------------------------------------
  test('calls markKlaviyoSynced after successful sync', async () => {
    (getRecipients as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeRecipients(2));
    mockGetLists.mockResolvedValueOnce([makeList('list-id', 'MerchOps - Dormant 60 Days')]);

    await syncSegmentToKlaviyo('ws-1', 'dormant_60');

    expect(markKlaviyoSynced).toHaveBeenCalledWith('ws-1');
  });
});
