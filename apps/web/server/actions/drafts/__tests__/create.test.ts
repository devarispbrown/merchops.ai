/**
 * Draft Creation — Unit Test Suite
 *
 * Verifies that AI generation is called with the correct prompt for each
 * execution type, that fallback is used when AI_PROVIDER is absent or throws,
 * that Zod validation failures also trigger the fallback, and that an
 * ai_generations audit record is written on every successful generation.
 *
 * The AI provider itself is mocked at the module level — no HTTP calls are made.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================================
// MOCKS — must be hoisted before any imports that rely on these modules
// ============================================================================

// ---------------------------------------------------------------------------
// Mock @anthropic-ai/sdk so no real HTTP ever fires
// ---------------------------------------------------------------------------
const mockAnthropicCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockAnthropicCreate };
    static APIError = class extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    };
  }
  return { default: MockAnthropic };
});

// ---------------------------------------------------------------------------
// Mock Prisma client
// ---------------------------------------------------------------------------
const mockOpportunityFindFirst = vi.fn();
const mockOpportunityFindUnique = vi.fn();
const mockOpportunityUpdate = vi.fn();
const mockActionDraftCreate = vi.fn();
const mockWorkspaceFindUnique = vi.fn();
const mockAiGenerationCreate = vi.fn();

vi.mock("../../../db/client", () => ({
  prisma: {
    opportunity: {
      findFirst: (...args: any[]) => mockOpportunityFindFirst(...args),
      findUnique: (...args: any[]) => mockOpportunityFindUnique(...args),
      update: (...args: any[]) => mockOpportunityUpdate(...args),
    },
    actionDraft: {
      create: (...args: any[]) => mockActionDraftCreate(...args),
    },
    workspace: {
      findUnique: (...args: any[]) => mockWorkspaceFindUnique(...args),
    },
    aiGeneration: {
      create: (...args: any[]) => mockAiGenerationCreate(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Reset provider cache between tests so env-var changes take effect
// ---------------------------------------------------------------------------
vi.mock("../../../ai/generate", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../ai/generate")>();
  return { ...original };
});

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { createDraftForOpportunity, generateAICopy } from "../create";
import { ExecutionType, OperatorIntent, ActionDraftState } from "../../types";
import {
  discountCopyPrompt,
  winbackEmailPrompt,
  opportunityRationalePrompt,
  type DiscountCopyInput,
  type WinbackEmailInput,
  type OpportunityRationaleInput,
} from "@merchops/shared/prompts";
import { resetProviderCache } from "../../../ai/generate";

// ============================================================================
// FIXTURES
// ============================================================================

const WORKSPACE_ID = "ws-create-test-001";
const OPPORTUNITY_ID = "opp-create-test-001";
const DRAFT_ID = "draft-create-test-001";

const BASE_OPPORTUNITY = {
  id: OPPORTUNITY_ID,
  workspace_id: WORKSPACE_ID,
  type: "inventory_clearance",
  priority_bucket: "high",
  rationale: "Existing rationale",
  why_now: "Existing why_now",
  counterfactual: "Existing counterfactual",
  impact_range: "5-10 units",
  state: "new",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  event_links: [
    {
      event: {
        type: "inventory_threshold_crossed",
        occurred_at: "2026-01-15T00:00:00.000Z",
        payload_json: { product_id: "prod-123", product_title: "Winter Jacket", inventory: 12 },
      },
    },
  ],
};

const WINBACK_OPPORTUNITY = {
  ...BASE_OPPORTUNITY,
  id: OPPORTUNITY_ID,
  type: "winback_campaign",
  event_links: [
    {
      event: {
        type: "customer_inactivity_threshold",
        occurred_at: "2026-01-15T00:00:00.000Z",
        payload_json: { customer_segment_size: 50 },
      },
    },
  ],
};

const PAUSE_OPPORTUNITY = {
  ...BASE_OPPORTUNITY,
  type: "stockout_prevention",
  event_links: [
    {
      event: {
        type: "product_out_of_stock",
        occurred_at: "2026-01-15T00:00:00.000Z",
        payload_json: { product_id: "prod-456" },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers to build valid AI response JSON strings
// ---------------------------------------------------------------------------
function makeDiscountCopyResponse(overrides: Record<string, string> = {}): string {
  return JSON.stringify({
    rationale: "Discount helps clear inventory",
    why_now: "Inventory dropped below threshold",
    counterfactual: "Without discount, inventory stays at current level",
    subject_line: "20% off Winter Jacket",
    body_copy: "We're offering 20% off Winter Jacket while supplies last. Shop at your convenience.",
    cta_text: "View offer",
    ...overrides,
  });
}

function makeWinbackEmailResponse(overrides: Record<string, string> = {}): string {
  return JSON.stringify({
    rationale: "Customer has been inactive for 45 days",
    why_now: "Dormancy threshold crossed",
    counterfactual: "Without outreach, customer likely stays inactive",
    subject: "Something new for you",
    body: "Hi there, we've added some new items that might interest you. Browse at your convenience.",
    cta: "Browse new arrivals",
    personalization_notes: "Generic template",
    ...overrides,
  });
}

function makeRationaleResponse(overrides: Record<string, string> = {}): string {
  return JSON.stringify({
    rationale: "AI-generated rationale based on store data",
    why_now: "Threshold crossed today",
    counterfactual: "Without action, inventory continues depleting",
    impact_range: "5-12 units",
    confidence_note: "Based on 14-day velocity",
    ...overrides,
  });
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

// Snapshot of original env state so tests can cleanly restore it
const ORIGINAL_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

/**
 * Enable the Anthropic provider for tests that exercise the live AI path.
 * Must be paired with disableAIProvider() in afterEach / cleanup.
 */
function enableAIProvider() {
  process.env.ANTHROPIC_API_KEY = "test-key-for-mocked-anthropic";
  resetProviderCache();
}

/**
 * Disable the Anthropic provider to force fallback path.
 */
function disableAIProvider() {
  delete process.env.ANTHROPIC_API_KEY;
  resetProviderCache();
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default happy-path Prisma responses
  mockOpportunityFindFirst.mockResolvedValue(BASE_OPPORTUNITY);
  mockOpportunityUpdate.mockResolvedValue(BASE_OPPORTUNITY);
  mockWorkspaceFindUnique.mockResolvedValue({ id: WORKSPACE_ID, name: "Test Store" });
  mockActionDraftCreate.mockResolvedValue({ id: DRAFT_ID, state: ActionDraftState.DRAFT });
  mockAiGenerationCreate.mockResolvedValue({ id: "gen-001", created_at: new Date() });

  // Default Anthropic response (discount copy + rationale)
  mockAnthropicCreate.mockResolvedValue({
    content: [{ type: "text", text: makeDiscountCopyResponse() }],
    usage: { input_tokens: 100, output_tokens: 200 },
    model: "claude-3-5-sonnet-20241022",
    stop_reason: "end_turn",
  });

  // Start each test with AI disabled (safe default); enable explicitly in tests that need it
  disableAIProvider();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Restore original env state
  if (ORIGINAL_ANTHROPIC_KEY !== undefined) {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_KEY;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
  resetProviderCache();
});

// ============================================================================
// TESTS: DISCOUNT DRAFT
// ============================================================================

describe("createDraftForOpportunity — discount draft", () => {
  test("calls AI with discount-copy-v1 prompt for discount execution type", async () => {
    enableAIProvider();
    // Return discount copy JSON for first call, rationale JSON for subsequent
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeDiscountCopyResponse() }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12, productName: "Winter Jacket" },
    });

    // First AI call should use the discount copy system prompt
    const firstCall = mockAnthropicCreate.mock.calls[0][0];
    expect(firstCall.system).toContain("copywriter");
    expect(firstCall.system).toContain("discount");
  });

  test("uses subject_line from AI output as discount title", async () => {
    enableAIProvider();
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeDiscountCopyResponse({ subject_line: "25% off Winter Jacket" }) }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValue({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    expect(result.payload.title).toBe("25% off Winter Jacket");
  });

  test("also calls opportunity-rationale-v1 during discount draft creation", async () => {
    enableAIProvider();
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeDiscountCopyResponse() }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    // At least two AI calls: one for discount copy, one for rationale
    expect(mockAnthropicCreate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("uses fallback discount title when AI_PROVIDER is not set", async () => {
    // AI provider is already disabled by beforeEach — no API key present
    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12, productName: "Winter Jacket" },
    });

    // Fallback must always produce a non-empty title
    expect(typeof result.payload.title).toBe("string");
    expect(result.payload.title.length).toBeGreaterThan(0);
    // Fallback should not have called Anthropic
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  test("uses fallback discount title when AI call throws", async () => {
    enableAIProvider();
    // Make Anthropic throw an error to simulate provider being down
    mockAnthropicCreate.mockRejectedValue(new Error("Provider unavailable"));

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12, productName: "Winter Jacket" },
    });

    expect(typeof result.payload.title).toBe("string");
    expect(result.payload.title.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS: WINBACK EMAIL DRAFT
// ============================================================================

describe("createDraftForOpportunity — winback email draft", () => {
  beforeEach(() => {
    mockOpportunityFindFirst.mockResolvedValue(WINBACK_OPPORTUNITY);
  });

  test("calls AI with winback-email-v1 prompt for winback execution type", async () => {
    enableAIProvider();
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeWinbackEmailResponse() }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValue({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: { daysSinceLastPurchase: 45 },
    });

    // First call system prompt should be the winback copywriter prompt
    const firstCall = mockAnthropicCreate.mock.calls[0][0];
    expect(firstCall.system).toContain("win-back");
  });

  test("uses AI subject as email subject", async () => {
    enableAIProvider();
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeWinbackEmailResponse({ subject: "New arrivals for you" }) }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValue({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: {},
    });

    expect(result.payload.subject).toBe("New arrivals for you");
  });

  test("uses fallback email subject when AI_PROVIDER is not set", async () => {
    // AI provider already disabled by beforeEach
    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: { daysSinceLastPurchase: 45 },
    });

    expect(typeof result.payload.subject).toBe("string");
    expect(result.payload.subject.length).toBeGreaterThan(0);
    expect(typeof result.payload.body_html).toBe("string");
    expect(result.payload.body_html.length).toBeGreaterThan(0);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  test("uses fallback email subject when AI call throws", async () => {
    enableAIProvider();
    mockAnthropicCreate.mockRejectedValue(new Error("Provider timeout"));

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: {},
    });

    expect(typeof result.payload.subject).toBe("string");
    expect(result.payload.subject.length).toBeGreaterThan(0);
  });

  test("uses fallback when AI output fails required field validation", async () => {
    enableAIProvider();
    // Return JSON that is missing required 'subject' field
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ body: "Hello", cta: "Shop now" }) }],
      usage: { input_tokens: 50, output_tokens: 50 },
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
    });

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: { daysSinceLastPurchase: 30 },
    });

    // Fallback should fill in subject
    expect(typeof result.payload.subject).toBe("string");
    expect(result.payload.subject.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TESTS: PAUSE PRODUCT
// ============================================================================

describe("createDraftForOpportunity — pause product", () => {
  beforeEach(() => {
    mockOpportunityFindFirst.mockResolvedValue(PAUSE_OPPORTUNITY);
  });

  test("also calls opportunity-rationale-v1 during pause product creation", async () => {
    enableAIProvider();
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: makeRationaleResponse() }],
      usage: { input_tokens: 80, output_tokens: 150 },
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
    });

    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.PAUSE_PRODUCT,
      context: {},
    });

    // Should call rationale prompt
    expect(mockAnthropicCreate).toHaveBeenCalled();
    const firstCall = mockAnthropicCreate.mock.calls[0][0];
    expect(firstCall.system).toContain("explainer");
  });

  test("falls back to opportunity.rationale when AI is unavailable", async () => {
    // AI provider already disabled by beforeEach
    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.PAUSE_PRODUCT,
      context: {},
    });

    expect(typeof result.payload.reason).toBe("string");
    expect(result.payload.reason.length).toBeGreaterThan(0);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TESTS: AI GENERATION AUDIT LOGGING
// ============================================================================

describe("ai_generations audit table", () => {
  test("creates an ai_generations record on successful AI call", async () => {
    enableAIProvider();
    mockAnthropicCreate
      .mockResolvedValueOnce({
        content: [{ type: "text", text: makeDiscountCopyResponse() }],
        usage: { input_tokens: 100, output_tokens: 200 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      })
      .mockResolvedValue({
        content: [{ type: "text", text: makeRationaleResponse() }],
        usage: { input_tokens: 80, output_tokens: 150 },
        model: "claude-3-5-sonnet-20241022",
        stop_reason: "end_turn",
      });

    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    expect(mockAiGenerationCreate).toHaveBeenCalled();

    const record = mockAiGenerationCreate.mock.calls[0][0].data;
    expect(record.workspace_id).toBe(WORKSPACE_ID);
    expect(record.prompt_version).toBeDefined();
    expect(record.model).toBeDefined();
    expect(record.tokens).toBeTypeOf("number");
    expect(record.latency_ms).toBeTypeOf("number");
    expect(record.inputs_json).toBeDefined();
    expect(record.outputs_json).toBeDefined();
  });

  test("creates an ai_generations record when fallback is used", async () => {
    // AI provider already disabled by beforeEach
    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    // Fallback path still logs to audit table via generateAndLog
    expect(mockAiGenerationCreate).toHaveBeenCalled();
    const record = mockAiGenerationCreate.mock.calls[0][0].data;
    expect(record.model).toBe("fallback-template");
  });

  test("audit record includes prompt_version matching discount-copy-v1", async () => {
    // Fallback still records the correct prompt version
    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    const promptVersions = mockAiGenerationCreate.mock.calls.map(
      (call) => call[0].data.prompt_version
    );
    expect(promptVersions).toContain("discount-copy-v1");
  });

  test("audit record includes prompt_version matching winback-email-v1", async () => {
    mockOpportunityFindFirst.mockResolvedValue(WINBACK_OPPORTUNITY);
    // Fallback still records the correct prompt version
    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: {},
    });

    const promptVersions = mockAiGenerationCreate.mock.calls.map(
      (call) => call[0].data.prompt_version
    );
    expect(promptVersions).toContain("winback-email-v1");
  });

  test("audit record includes prompt_version matching opportunity-rationale-v1", async () => {
    // Fallback still records both prompt versions
    await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 12 },
    });

    const promptVersions = mockAiGenerationCreate.mock.calls.map(
      (call) => call[0].data.prompt_version
    );
    expect(promptVersions).toContain("opportunity-rationale-v1");
  });
});

// ============================================================================
// TESTS: FALLBACK SAFETY NET
// ============================================================================

describe("fallback safety net", () => {
  test("draft creation never throws when AI fails completely", async () => {
    enableAIProvider();
    mockAnthropicCreate.mockRejectedValue(new Error("Connection refused"));

    await expect(
      createDraftForOpportunity({
        workspaceId: WORKSPACE_ID,
        opportunityId: OPPORTUNITY_ID,
        operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
        executionType: ExecutionType.DISCOUNT_DRAFT,
        context: { inventoryLevel: 12 },
      })
    ).resolves.toBeDefined();
  });

  test("draft creation never throws when AI returns invalid JSON", async () => {
    enableAIProvider();
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "This is not JSON at all" }],
      usage: { input_tokens: 10, output_tokens: 10 },
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
    });

    await expect(
      createDraftForOpportunity({
        workspaceId: WORKSPACE_ID,
        opportunityId: OPPORTUNITY_ID,
        operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
        executionType: ExecutionType.DISCOUNT_DRAFT,
        context: { inventoryLevel: 12 },
      })
    ).resolves.toBeDefined();
  });

  test("draft creation never throws when AI returns JSON missing required fields", async () => {
    enableAIProvider();
    // Missing 'subject_line' for discount copy
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            rationale: "ok",
            why_now: "ok",
            counterfactual: "ok",
            // subject_line intentionally omitted
            body_copy: "some copy",
            cta_text: "click",
          }),
        },
      ],
      usage: { input_tokens: 50, output_tokens: 50 },
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
    });

    await expect(
      createDraftForOpportunity({
        workspaceId: WORKSPACE_ID,
        opportunityId: OPPORTUNITY_ID,
        operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
        executionType: ExecutionType.DISCOUNT_DRAFT,
        context: { inventoryLevel: 12 },
      })
    ).resolves.toBeDefined();
  });

  test("fallback produces payload with all required discount fields", async () => {
    // AI already disabled by beforeEach
    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REDUCE_INVENTORY_RISK,
      executionType: ExecutionType.DISCOUNT_DRAFT,
      context: { inventoryLevel: 30 },
    });

    expect(result.payload).toMatchObject({
      title: expect.any(String),
      discount_type: expect.any(String),
      value: expect.any(Number),
      target_type: expect.any(String),
      starts_at: expect.any(String),
    });
  });

  test("fallback produces payload with all required winback email fields", async () => {
    mockOpportunityFindFirst.mockResolvedValue(WINBACK_OPPORTUNITY);
    // AI already disabled by beforeEach — no need to throw

    const result = await createDraftForOpportunity({
      workspaceId: WORKSPACE_ID,
      opportunityId: OPPORTUNITY_ID,
      operatorIntent: OperatorIntent.REENGAGE_DORMANT,
      executionType: ExecutionType.WINBACK_EMAIL,
      context: { daysSinceLastPurchase: 45 },
    });

    expect(result.payload).toMatchObject({
      subject: expect.any(String),
      body_html: expect.any(String),
      body_text: expect.any(String),
      from_name: expect.any(String),
      from_email: expect.any(String),
      recipient_segment: expect.any(String),
    });
  });
});

// ============================================================================
// TESTS: generateAICopy HELPER
// ============================================================================

describe("generateAICopy helper", () => {
  test("returns fallback output when no API key configured", async () => {
    // AI already disabled by beforeEach
    const input: DiscountCopyInput = {
      workspaceId: WORKSPACE_ID,
      productName: "Test Product",
      discountPercent: 20,
      urgencyLevel: "medium",
    };

    const result = await generateAICopy(discountCopyPrompt, input, WORKSPACE_ID);

    expect(result.rationale).toBeTruthy();
    expect(result.why_now).toBeTruthy();
    expect(result.counterfactual).toBeTruthy();
    expect(result.subject_line).toBeTruthy();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  test("returns fallback output when AI provider throws", async () => {
    enableAIProvider();
    mockAnthropicCreate.mockRejectedValue(new Error("Rate limit exceeded"));

    const input: WinbackEmailInput = {
      workspaceId: WORKSPACE_ID,
      lastPurchaseDate: "2026-01-01",
      daysSinceLastPurchase: 45,
    };

    const result = await generateAICopy(winbackEmailPrompt, input, WORKSPACE_ID);

    expect(result.subject).toBeTruthy();
    expect(result.body).toBeTruthy();
    expect(result.cta).toBeTruthy();
  });

  test("returns fallback output when AI response fails field validation", async () => {
    enableAIProvider();
    // Returns JSON that is missing 'rationale', 'why_now', 'counterfactual'
    mockAnthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            // Missing rationale/why_now/counterfactual — engine will reject
            subject_line: "Some discount",
            body_copy: "Some body",
            cta_text: "Click",
          }),
        },
      ],
      usage: { input_tokens: 40, output_tokens: 40 },
      model: "claude-3-5-sonnet-20241022",
      stop_reason: "end_turn",
    });

    const input: DiscountCopyInput = {
      workspaceId: WORKSPACE_ID,
      productName: "Test Product",
      discountPercent: 15,
      urgencyLevel: "low",
    };

    const result = await generateAICopy(discountCopyPrompt, input, WORKSPACE_ID);

    // Fallback must always include the base required fields
    expect(result.rationale).toBeTruthy();
    expect(result.why_now).toBeTruthy();
    expect(result.counterfactual).toBeTruthy();
  });

  test("logs to ai_generations even on fallback path", async () => {
    // AI already disabled by beforeEach
    const input: OpportunityRationaleInput = {
      workspaceId: WORKSPACE_ID,
      opportunityType: "inventory_clearance",
      operatorIntent: "reduce_inventory_risk",
      eventsSummary: "Inventory dropped",
      timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
    };

    await generateAICopy(opportunityRationalePrompt, input, WORKSPACE_ID);

    expect(mockAiGenerationCreate).toHaveBeenCalled();
    const record = mockAiGenerationCreate.mock.calls[0][0].data;
    expect(record.model).toBe("fallback-template");
    expect(record.workspace_id).toBe(WORKSPACE_ID);
    expect(record.prompt_version).toBe("opportunity-rationale-v1");
  });
});
