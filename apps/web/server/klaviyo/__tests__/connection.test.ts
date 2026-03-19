/**
 * KlaviyoConnection Unit Tests
 *
 * Covers:
 *  - connectKlaviyo: validates key via getLists, encrypts, persists
 *  - connectKlaviyo: rejects invalid/empty keys
 *  - connectKlaviyo: maps Klaviyo 401 to user-friendly error
 *  - disconnectKlaviyo: sets status=revoked and revokedAt
 *  - disconnectKlaviyo: throws when no connection exists
 *  - getKlaviyoClient: decrypts key and returns client
 *  - getKlaviyoClient: throws when connection missing
 *  - getKlaviyoClient: throws when connection revoked
 *  - getKlaviyoConnectionStatus: returns null when missing
 *
 * Prisma and KlaviyoClient are mocked — no DB or network.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  connectKlaviyo,
  disconnectKlaviyo,
  getKlaviyoClient,
  getKlaviyoConnectionStatus,
} from '../connection';

// ============================================================================
// MOCKS
// ============================================================================

// Mock encryption utilities — pass-through so we can assert on values
vi.mock('../../shopify/oauth', () => ({
  encryptToken: vi.fn((key: string) => `encrypted:${key}`),
  decryptToken: vi.fn((enc: string) => enc.replace('encrypted:', '')),
}));

// Prisma mock
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('../../db/client', () => ({
  prisma: {
    klaviyoConnection: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// KlaviyoClient mock
const mockGetLists = vi.fn();

vi.mock('../client', () => ({
  KlaviyoClient: vi.fn().mockImplementation(function () {
    return {
      getLists: mockGetLists,
    };
  }),
  KlaviyoApiError: class KlaviyoApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public errors: unknown[] = [],
      public correlationId?: string
    ) {
      super(message);
      this.name = 'KlaviyoApiError';
    }
  },
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    workspaceId: 'ws-1',
    apiKeyEncrypted: 'encrypted:pk_test_123',
    status: 'active',
    connectedAt: new Date('2024-01-01'),
    revokedAt: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('connectKlaviyo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('validates key by calling getLists, then persists encrypted key', async () => {
    mockGetLists.mockResolvedValueOnce([]);
    mockUpsert.mockResolvedValueOnce(makeConnection());

    const result = await connectKlaviyo('ws-1', 'pk_test_abc');

    expect(mockGetLists).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    const upsertCall = mockUpsert.mock.calls[0][0];
    // Encrypted key should be stored, never plain text
    expect(upsertCall.create.apiKeyEncrypted).toBe('encrypted:pk_test_abc');
    expect(upsertCall.create.apiKeyEncrypted).not.toBe('pk_test_abc');

    expect(result.status).toBe('active');
  });

  test('trims whitespace from API key before use', async () => {
    mockGetLists.mockResolvedValueOnce([]);
    mockUpsert.mockResolvedValueOnce(makeConnection());

    await connectKlaviyo('ws-1', '  pk_test_abc  ');

    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.create.apiKeyEncrypted).toBe('encrypted:pk_test_abc');
  });

  test('throws user-friendly error when Klaviyo returns 401', async () => {
    const { KlaviyoApiError } = await import('../client');
    mockGetLists.mockRejectedValueOnce(
      new KlaviyoApiError('Unauthorized', 401, [])
    );

    await expect(connectKlaviyo('ws-1', 'bad_key')).rejects.toThrow(
      'Invalid Klaviyo API key'
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  test('throws when API key is empty', async () => {
    await expect(connectKlaviyo('ws-1', '')).rejects.toThrow(
      'API key must not be empty'
    );
    expect(mockGetLists).not.toHaveBeenCalled();
  });

  test('throws when API key is whitespace only', async () => {
    await expect(connectKlaviyo('ws-1', '   ')).rejects.toThrow(
      'API key must not be empty'
    );
  });

  test('propagates non-auth errors from getLists', async () => {
    mockGetLists.mockRejectedValueOnce(new Error('Network error'));

    await expect(connectKlaviyo('ws-1', 'pk_test')).rejects.toThrow(
      'Klaviyo API key validation failed'
    );
  });
});

describe('disconnectKlaviyo', () => {
  beforeEach(() => vi.clearAllMocks());

  test('sets status to revoked and revokedAt', async () => {
    mockFindUnique.mockResolvedValueOnce(makeConnection());
    mockUpdate.mockResolvedValueOnce(makeConnection({ status: 'revoked', revokedAt: new Date() }));

    await disconnectKlaviyo('ws-1');

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.status).toBe('revoked');
    expect(updateCall.data.revokedAt).toBeInstanceOf(Date);
  });

  test('throws when no connection exists', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(disconnectKlaviyo('ws-1')).rejects.toThrow(
      'No Klaviyo connection found'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('getKlaviyoClient', () => {
  beforeEach(() => vi.clearAllMocks());

  test('decrypts key and returns a KlaviyoClient', async () => {
    mockFindUnique.mockResolvedValueOnce(makeConnection());

    const clientInstance = await getKlaviyoClient('ws-1');
    // The client should have a getLists method (from our mock)
    expect(typeof clientInstance.getLists).toBe('function');
  });

  test('decrypts key correctly — raw key never used directly from storage', async () => {
    const { KlaviyoClient } = await import('../client');
    const KlaviyoClientMock = KlaviyoClient as unknown as ReturnType<typeof vi.fn>;
    KlaviyoClientMock.mockClear();

    mockFindUnique.mockResolvedValueOnce(makeConnection({ apiKeyEncrypted: 'encrypted:pk_live_secret' }));

    await getKlaviyoClient('ws-1');

    // KlaviyoClient constructor should receive the decrypted key
    expect(KlaviyoClientMock.mock.calls[0][0]).toBe('pk_live_secret');
  });

  test('throws when no connection found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getKlaviyoClient('ws-1')).rejects.toThrow(
      'No Klaviyo connection found'
    );
  });

  test('throws when connection is revoked', async () => {
    mockFindUnique.mockResolvedValueOnce(makeConnection({ status: 'revoked' }));

    await expect(getKlaviyoClient('ws-1')).rejects.toThrow(
      'not active'
    );
  });

  test('throws when connection is invalid', async () => {
    mockFindUnique.mockResolvedValueOnce(makeConnection({ status: 'invalid' }));

    await expect(getKlaviyoClient('ws-1')).rejects.toThrow(
      'not active'
    );
  });
});

describe('getKlaviyoConnectionStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  test('returns null when no connection exists', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const result = await getKlaviyoConnectionStatus('ws-1');
    expect(result).toBeNull();
  });

  test('returns connection info when connection exists', async () => {
    const conn = makeConnection({ lastSyncedAt: new Date('2024-06-01') });
    mockFindUnique.mockResolvedValueOnce(conn);

    const result = await getKlaviyoConnectionStatus('ws-1');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
    expect(result!.lastSyncedAt).toBeInstanceOf(Date);
  });

  test('never exposes encrypted API key', async () => {
    mockFindUnique.mockResolvedValueOnce(makeConnection());

    const result = await getKlaviyoConnectionStatus('ws-1');
    // apiKeyEncrypted should not be in the returned object
    expect(result).not.toHaveProperty('apiKeyEncrypted');
    expect(result).not.toHaveProperty('apiKey');
  });
});
