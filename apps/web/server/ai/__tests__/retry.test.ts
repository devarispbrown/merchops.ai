/**
 * AI Generation - Retry Logic Test Suite
 *
 * Tests retry behavior with exponential backoff for transient errors.
 * This is isolated to ensure retry logic works correctly under various failure scenarios.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock implementation of retry logic for testing
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
  multiplier: number = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }

    // Check if error is retryable
    const isRetryable =
      error.status === 429 || // Rate limit
      error.status === 500 || // Server error
      error.status === 502 || // Bad gateway
      error.status === 503 || // Service unavailable
      error.status === 504; // Gateway timeout

    if (!isRetryable) {
      throw error;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // Retry with exponential backoff
    return withRetry(fn, retries - 1, delayMs * multiplier, multiplier);
  }
}

class MockAPIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

describe("Retry Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("succeeds on first attempt when no error", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries on rate limit error (429)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);

    // Fast-forward through delays
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  test("retries on server error (500)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Server error", 500))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("retries on bad gateway (502)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Bad gateway", 502))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("retries on service unavailable (503)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Service unavailable", 503))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("retries on gateway timeout (504)", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Gateway timeout", 504))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test("does not retry on non-retryable error (400)", async () => {
    const fn = vi.fn().mockRejectedValue(new MockAPIError("Bad request", 400));

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Bad request");

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  test("does not retry on auth error (401)", async () => {
    const fn = vi.fn().mockRejectedValue(new MockAPIError("Unauthorized", 401));

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Unauthorized");

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  test("does not retry on forbidden error (403)", async () => {
    const fn = vi.fn().mockRejectedValue(new MockAPIError("Forbidden", 403));

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Forbidden");

    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  test("throws after max retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new MockAPIError("Rate limited", 429));

    // Mock setTimeout to execute immediately
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any) => {
      fn();
      return 0 as any;
    }) as any);

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Rate limited");

    expect(fn).toHaveBeenCalledTimes(4); // Initial + 3 retries
  });

  test("uses exponential backoff", async () => {
    const delays: number[] = [];

    // Track delays by mocking the delay function
    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any, delay: number) => {
      delays.push(delay);
      // Execute immediately
      fn();
      return 0 as any;
    }) as any);

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockResolvedValue("success");

    await withRetry(fn, 3, 100, 2);

    // Should have exponential backoff: 100ms, 200ms, 400ms
    expect(delays).toEqual([100, 200, 400]);
  });

  test("handles multiple sequential failures and eventual success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockRejectedValueOnce(new MockAPIError("Server error", 500))
      .mockResolvedValue("success");

    const promise = withRetry(fn, 3, 100);
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe("Retry Edge Cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("handles zero retries", async () => {
    const fn = vi.fn().mockRejectedValue(new MockAPIError("Rate limited", 429));

    await expect(withRetry(fn, 0, 100)).rejects.toThrow("Rate limited");

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("handles non-APIError exceptions", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Network failure"));

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Network failure");

    expect(fn).toHaveBeenCalledTimes(1); // Non-retryable
  });

  test("handles errors without status property", async () => {
    const error = new Error("Unknown error");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, 3, 100)).rejects.toThrow("Unknown error");

    expect(fn).toHaveBeenCalledTimes(1); // Non-retryable
  });
});

describe("Retry Performance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("total retry time increases exponentially", async () => {
    let totalDelay = 0;

    vi.spyOn(global, "setTimeout").mockImplementation(((fn: any, delay: number) => {
      totalDelay += delay;
      fn(); // Execute immediately
      return 0 as any;
    }) as any);

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockRejectedValueOnce(new MockAPIError("Rate limited", 429))
      .mockResolvedValue("success");

    await withRetry(fn, 3, 1000, 2);

    // Total delay should be: 1000 + 2000 + 4000 = 7000ms
    expect(totalDelay).toBe(7000);
  });
});
