/**
 * AI Generation Engine - Test Suite
 *
 * Tests AI generation with Anthropic SDK, retry logic, fallback behavior, and audit logging.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { generateAI, generateAndLog, getTokenStats, getGenerationHistory } from "../generate";
import {
  opportunityRationalePrompt,
  type OpportunityRationaleInput,
} from "@merchops/shared/prompts";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const mockCreate = vi.fn();

  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
    static APIError = class extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    };
  }

  return {
    default: MockAnthropic,
  };
});

// Mock Prisma client
const mockPrismaCreate = vi.fn();
const mockPrismaFindMany = vi.fn();

const mockPrisma = {
  aiGeneration: {
    create: mockPrismaCreate,
    findMany: mockPrismaFindMany,
  },
} as unknown as PrismaClient;

describe("AI Generation with Anthropic SDK", () => {
  const testInput: OpportunityRationaleInput = {
    workspaceId: "test-workspace-id",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Product inventory dropped below threshold",
    storeContext: {
      productName: "Winter Jacket",
      currentInventory: 12,
    },
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaCreate.mockResolvedValue({
      id: "test-generation-id",
      created_at: new Date(),
    });
    mockPrismaFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("uses fallback when AI is disabled (no API key)", async () => {
    // When ANTHROPIC_API_KEY is not set, AI_ENABLED should be false
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    expect(result.output.rationale).toBeTruthy();
    expect(result.output.why_now).toBeTruthy();
    expect(result.output.counterfactual).toBeTruthy();
    expect(result.metadata.model).toBe("fallback-template");
    expect(result.metadata.used_fallback).toBe(true);
    expect(result.metadata.tokens).toBe(0);
  });

  test("fallback output includes required fields", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    expect(result.output).toHaveProperty("rationale");
    expect(result.output).toHaveProperty("why_now");
    expect(result.output).toHaveProperty("counterfactual");
    expect(typeof result.output.rationale).toBe("string");
    expect(typeof result.output.why_now).toBe("string");
    expect(typeof result.output.counterfactual).toBe("string");
  });

  test("fallback uses provided store context", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    expect(result.output.rationale).toContain("Winter Jacket");
    expect(result.output.rationale).toContain("12");
  });

  test("fallback never invents metrics", async () => {
    const inputWithoutContext: OpportunityRationaleInput = {
      ...testInput,
      storeContext: undefined,
    };

    const result = await generateAI(opportunityRationalePrompt, inputWithoutContext, mockPrisma);

    // Should not contain large numbers we didn't provide
    expect(result.output.rationale).not.toMatch(/\$\d{3,}/);
    expect(result.output.rationale).not.toMatch(/\d{3,} units/);
  });

  test("tracks latency in metadata", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    expect(result.metadata.latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof result.metadata.latency_ms).toBe("number");
  });
});

describe("AI Generation Audit Logging", () => {
  const testInput: OpportunityRationaleInput = {
    workspaceId: "test-workspace-id",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Product inventory dropped below threshold",
    storeContext: {
      productName: "Winter Jacket",
      currentInventory: 12,
    },
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaCreate.mockResolvedValue({
      id: "test-generation-id",
      created_at: new Date(),
    });
  });

  test("logs AI generation to audit table", async () => {
    await generateAndLog(opportunityRationalePrompt, testInput, mockPrisma);

    expect(mockPrismaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspace_id: "test-workspace-id",
        prompt_version: "opportunity-rationale-v1",
        model: expect.any(String),
        tokens: expect.any(Number),
        latency_ms: expect.any(Number),
        inputs_json: expect.any(Object),
        outputs_json: expect.any(Object),
      }),
    });
  });

  test("logs include full input and output", async () => {
    await generateAndLog(opportunityRationalePrompt, testInput, mockPrisma);

    const logCall = mockPrismaCreate.mock.calls[0][0];
    expect(logCall.data.inputs_json).toMatchObject({
      workspaceId: "test-workspace-id",
      opportunityType: "inventory_clearance",
    });

    expect(logCall.data.outputs_json).toHaveProperty("rationale");
    expect(logCall.data.outputs_json).toHaveProperty("why_now");
    expect(logCall.data.outputs_json).toHaveProperty("counterfactual");
  });

  test("returns output after logging", async () => {
    const output = await generateAndLog(opportunityRationalePrompt, testInput, mockPrisma);

    expect(output.rationale).toBeTruthy();
    expect(output.why_now).toBeTruthy();
    expect(output.counterfactual).toBeTruthy();
  });

  test("does not fail operation if logging fails", async () => {
    mockPrismaCreate.mockRejectedValue(new Error("Database connection failed"));

    // Should still return output even if logging fails
    await expect(
      generateAndLog(opportunityRationalePrompt, testInput, mockPrisma)
    ).resolves.toBeTruthy();
  });
});

describe("Token Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calculates token statistics correctly", async () => {
    const mockGenerations = [
      {
        id: "1",
        workspace_id: "test-workspace",
        prompt_version: "opportunity-rationale-v1",
        inputs_json: {},
        outputs_json: {},
        model: "claude-3-5-sonnet-20241022",
        tokens: 500,
        latency_ms: 1200,
        created_at: new Date(),
      },
      {
        id: "2",
        workspace_id: "test-workspace",
        prompt_version: "discount-copy-v1",
        inputs_json: {},
        outputs_json: {},
        model: "claude-3-5-sonnet-20241022",
        tokens: 300,
        latency_ms: 800,
        created_at: new Date(),
      },
      {
        id: "3",
        workspace_id: "test-workspace",
        prompt_version: "opportunity-rationale-v1",
        inputs_json: {},
        outputs_json: {},
        model: "fallback-template",
        tokens: 0,
        latency_ms: 10,
        created_at: new Date(),
      },
    ];

    mockPrismaFindMany.mockResolvedValue(mockGenerations);

    const stats = await getTokenStats("test-workspace", mockPrisma);

    expect(stats.total_tokens).toBe(800);
    expect(stats.total_generations).toBe(3);
    expect(stats.avg_tokens_per_generation).toBeCloseTo(266.67, 1);
    expect(stats.avg_latency_ms).toBeCloseTo(670, 1);
    expect(stats.fallback_rate).toBeCloseTo(0.333, 2);
  });

  test("handles empty generation history", async () => {
    mockPrismaFindMany.mockResolvedValue([]);

    const stats = await getTokenStats("test-workspace", mockPrisma);

    expect(stats.total_tokens).toBe(0);
    expect(stats.total_generations).toBe(0);
    expect(stats.avg_tokens_per_generation).toBe(0);
    expect(stats.avg_latency_ms).toBe(0);
    expect(stats.fallback_rate).toBe(0);
  });

  test("filters by time window when provided", async () => {
    const timeWindow = {
      start: new Date("2026-01-01"),
      end: new Date("2026-01-31"),
    };

    await getTokenStats("test-workspace", mockPrisma, timeWindow);

    expect(mockPrismaFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspace_id: "test-workspace",
        created_at: {
          gte: timeWindow.start,
          lte: timeWindow.end,
        },
      }),
    });
  });
});

describe("Generation History", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retrieves generation history", async () => {
    const mockGenerations = [
      {
        id: "1",
        workspace_id: "test-workspace",
        prompt_version: "opportunity-rationale-v1",
        inputs_json: { test: "input" },
        outputs_json: { test: "output" },
        model: "claude-3-5-sonnet-20241022",
        tokens: 500,
        latency_ms: 1200,
        created_at: new Date(),
      },
    ];

    mockPrismaFindMany.mockResolvedValue(mockGenerations);

    const history = await getGenerationHistory("test-workspace", mockPrisma);

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("1");
    expect(history[0].prompt_version).toBe("opportunity-rationale-v1");
  });

  test("filters by prompt version when provided", async () => {
    await getGenerationHistory("test-workspace", mockPrisma, {
      promptVersion: "opportunity-rationale-v1",
    });

    expect(mockPrismaFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspace_id: "test-workspace",
        prompt_version: "opportunity-rationale-v1",
      }),
      orderBy: { created_at: "desc" },
      take: 100,
      skip: 0,
    });
  });

  test("supports pagination", async () => {
    await getGenerationHistory("test-workspace", mockPrisma, {
      limit: 50,
      offset: 100,
    });

    expect(mockPrismaFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspace_id: "test-workspace",
      }),
      orderBy: { created_at: "desc" },
      take: 50,
      skip: 100,
    });
  });

  test("defaults to 100 records without limit", async () => {
    await getGenerationHistory("test-workspace", mockPrisma);

    expect(mockPrismaFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        workspace_id: "test-workspace",
      }),
      orderBy: { created_at: "desc" },
      take: 100,
      skip: 0,
    });
  });
});

describe("Safety and Validation", () => {
  const testInput: OpportunityRationaleInput = {
    workspaceId: "test-workspace-id",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Product inventory dropped below threshold",
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaCreate.mockResolvedValue({
      id: "test-generation-id",
      created_at: new Date(),
    });
  });

  test("fallback never uses prohibited phrases", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    const allText =
      result.output.rationale + " " + result.output.why_now + " " + result.output.counterfactual;

    const prohibitedPhrases = [
      /will definitely/gi,
      /guaranteed to/gi,
      /100% certain/gi,
      /proven to/gi,
      /always results in/gi,
    ];

    prohibitedPhrases.forEach((phrase) => {
      expect(allText).not.toMatch(phrase);
    });
  });

  test("fallback includes uncertainty language", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    const allText =
      result.output.rationale + " " + result.output.why_now + " " + result.output.counterfactual;

    // Should include at least some uncertainty language
    const uncertaintyPatterns = [
      /likely/gi,
      /may/gi,
      /suggest/gi,
      /based on/gi,
      /appropriate/gi,
    ];

    const hasUncertainty = uncertaintyPatterns.some((pattern) => pattern.test(allText));
    expect(hasUncertainty).toBe(true);
  });

  test("all outputs have required fields", async () => {
    const result = await generateAI(opportunityRationalePrompt, testInput, mockPrisma);

    expect(result.output.rationale).toBeTruthy();
    expect(result.output.why_now).toBeTruthy();
    expect(result.output.counterfactual).toBeTruthy();
    expect(result.output.rationale.length).toBeGreaterThan(0);
    expect(result.output.why_now.length).toBeGreaterThan(0);
    expect(result.output.counterfactual.length).toBeGreaterThan(0);
  });
});
