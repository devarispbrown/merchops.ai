/**
 * Draft Approval - Unit Test Suite
 *
 * Tests that approving a draft enqueues a BullMQ job with the correct payload,
 * and that missing Redis throws a clear, actionable error.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// ============================================================================
// MOCKS — must be hoisted before any imports that use these modules
// ============================================================================

// Mock BullMQ Queue
const mockQueueAdd = vi.fn().mockResolvedValue({ id: "job-123", name: "execution" });

vi.mock("../../../jobs/queues", () => ({
  getExecutionQueue: vi.fn(() => ({ add: mockQueueAdd })),
}));

// Mock job config so QUEUE_NAMES is available without Redis
vi.mock("../../../jobs/config", () => ({
  QUEUE_NAMES: {
    SHOPIFY_SYNC: "shopify-sync",
    EVENT_COMPUTE: "event-compute",
    OPPORTUNITY_GENERATE: "opportunity-generate",
    EXECUTION: "execution",
    OUTCOME_COMPUTE: "outcome-compute",
  },
  isRedisConfigured: vi.fn(() => true),
  redisConnection: { host: "localhost", port: 6379 },
}));

// Mock Prisma client
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("../../../db/client", () => ({
  prisma: {
    actionDraft: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    execution: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: (...args: any[]) => mockCreate(...args),
    },
    opportunity: {
      update: (...args: any[]) => mockUpdate(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { approveDraft } from "../approve";
import { getExecutionQueue } from "../../../jobs/queues";
import { ActionDraftState, ExecutionStatus } from "../../types";

// ============================================================================
// FIXTURES
// ============================================================================

const WORKSPACE_ID = "ws-test-001";
const DRAFT_ID = "draft-test-001";
const EXECUTION_ID = "exec-test-001";
const OPPORTUNITY_ID = "opp-test-001";

const VALID_DRAFT = {
  id: DRAFT_ID,
  workspace_id: WORKSPACE_ID,
  opportunity_id: OPPORTUNITY_ID,
  execution_type: "discount_draft",
  state: ActionDraftState.DRAFT,
  operator_intent: "reduce_inventory_risk",
  payload_json: {
    title: "Summer Sale",
    discount_type: "percentage",
    value: 10,
    target_type: "entire_order",
    starts_at: "2026-04-01T00:00:00.000Z",
  },
  opportunity: {
    id: OPPORTUNITY_ID,
    state: "new",
  },
};

const VALID_EXECUTION = {
  id: EXECUTION_ID,
  workspace_id: WORKSPACE_ID,
  action_draft_id: DRAFT_ID,
  status: ExecutionStatus.PENDING,
  idempotency_key: `draft_${DRAFT_ID}_000_abc`,
  started_at: new Date(),
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe("approveDraft — BullMQ enqueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path behaviour
    mockFindFirst.mockResolvedValue(VALID_DRAFT);

    // First findUnique call (idempotency check on execution) returns null
    // so that a fresh execution is always created in the default case.
    mockFindUnique.mockResolvedValue(null);

    mockTransaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        actionDraft: { update: vi.fn().mockResolvedValue(VALID_DRAFT) },
        execution: { create: vi.fn().mockResolvedValue(VALID_EXECUTION) },
        opportunity: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  });

  // --------------------------------------------------------------------------
  // Core enqueue behaviour
  // --------------------------------------------------------------------------

  test("enqueues a BullMQ job after a successful approval", async () => {
    const result = await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    expect(result.success).toBe(true);
    expect(result.executionId).toBe(EXECUTION_ID);
    expect(mockQueueAdd).toHaveBeenCalledOnce();
  });

  test("enqueues job to the execution queue with correct job name", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [jobName] = mockQueueAdd.mock.calls[0];
    expect(jobName).toBe("execution");
  });

  test("job payload contains execution_id matching the created execution", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.execution_id).toBe(EXECUTION_ID);
  });

  test("job payload contains workspace_id", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.workspace_id).toBe(WORKSPACE_ID);
  });

  test("job payload contains action_draft_id matching the approved draft", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.action_draft_id).toBe(DRAFT_ID);
  });

  test("job payload contains execution_type from the draft", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.execution_type).toBe("discount_draft");
  });

  test("job payload contains idempotency_key", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.idempotency_key).toBeDefined();
    expect(typeof jobData.idempotency_key).toBe("string");
    expect(jobData.idempotency_key.length).toBeGreaterThan(0);
  });

  test("job payload contains the draft payload as-is", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, jobData] = mockQueueAdd.mock.calls[0];
    expect(jobData.payload).toEqual(VALID_DRAFT.payload_json);
  });

  // --------------------------------------------------------------------------
  // Job options
  // --------------------------------------------------------------------------

  test("job options set attempts to 3", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, , jobOptions] = mockQueueAdd.mock.calls[0];
    expect(jobOptions.attempts).toBe(3);
  });

  test("job options use exponential backoff", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, , jobOptions] = mockQueueAdd.mock.calls[0];
    expect(jobOptions.backoff).toEqual({ type: "exponential", delay: 5000 });
  });

  test("job options set removeOnComplete", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, , jobOptions] = mockQueueAdd.mock.calls[0];
    expect(jobOptions.removeOnComplete).toBe(true);
  });

  test("jobId is set to executionId for deduplication", async () => {
    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    const [, , jobOptions] = mockQueueAdd.mock.calls[0];
    expect(jobOptions.jobId).toBe(EXECUTION_ID);
  });

  // --------------------------------------------------------------------------
  // Redis unavailable path
  // --------------------------------------------------------------------------

  test("throws a clear error when Redis / queue is not available", async () => {
    // Simulate Redis not configured — getExecutionQueue returns null
    vi.mocked(getExecutionQueue).mockReturnValueOnce(null);

    await expect(
      approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID })
    ).rejects.toThrow("Redis is required for execution dispatch");
  });

  test("thrown Redis error message is unambiguous", async () => {
    vi.mocked(getExecutionQueue).mockReturnValueOnce(null);

    let thrownMessage = "";
    try {
      await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });
    } catch (err: any) {
      thrownMessage = err.message;
    }

    expect(thrownMessage).toContain("Redis");
    expect(thrownMessage).toContain("execution dispatch");
  });

  // --------------------------------------------------------------------------
  // Idempotency — no re-enqueue when execution already exists
  // --------------------------------------------------------------------------

  test("does not enqueue a job when execution already exists (idempotent approval)", async () => {
    // Existing execution found on the first findUnique call
    mockFindUnique.mockResolvedValueOnce({
      ...VALID_EXECUTION,
      id: "existing-exec-id",
    });

    const result = await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    expect(result.executionId).toBe("existing-exec-id");
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Guard rails — invalid draft state
  // --------------------------------------------------------------------------

  test("throws when draft state is not approvable (already approved)", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...VALID_DRAFT,
      state: ActionDraftState.APPROVED,
    });

    await expect(
      approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID })
    ).rejects.toThrow("Draft cannot be approved from state");

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  test("throws when draft state is rejected", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...VALID_DRAFT,
      state: ActionDraftState.REJECTED,
    });

    await expect(
      approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID })
    ).rejects.toThrow("Draft cannot be approved from state");

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  test("throws when draft is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    await expect(
      approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID })
    ).rejects.toThrow("Draft not found or access denied");

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // Edited draft — also approvable
  // --------------------------------------------------------------------------

  test("successfully enqueues when draft is in EDITED state", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ...VALID_DRAFT,
      state: ActionDraftState.EDITED,
    });

    const result = await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    expect(result.success).toBe(true);
    expect(mockQueueAdd).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------------------------------
  // setImmediate must not be called
  // --------------------------------------------------------------------------

  test("does not call setImmediate for execution dispatch", async () => {
    const setImmediateSpy = vi.spyOn(globalThis, "setImmediate" as any);

    await approveDraft({ workspaceId: WORKSPACE_ID, draftId: DRAFT_ID });

    expect(setImmediateSpy).not.toHaveBeenCalled();

    setImmediateSpy.mockRestore();
  });
});
