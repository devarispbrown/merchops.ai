/**
 * MerchOps AI Prompt System - Test Suite
 *
 * Tests prompt fallbacks, validation, and generation logic.
 */

import {
  opportunityRationalePrompt,
  discountCopyPrompt,
  winbackEmailPrompt,
  getPrompt,
  getLatestVersion,
  isValidPromptVersion,
  listPromptVersions,
  type OpportunityRationaleInput,
  type DiscountCopyInput,
  type WinbackEmailInput,
} from "@merchops/shared/prompts";
import {
  generateOpportunityRationaleFallback,
  generateDiscountCopyFallback,
  generateWinbackEmailFallback,
  validateOutput,
  sanitizeOutput,
  calculateImpactRange,
} from "../fallbacks";

describe("Prompt Registry", () => {
  test("lists all prompt versions", () => {
    const versions = listPromptVersions();
    expect(versions).toContain("opportunity-rationale-v1");
    expect(versions).toContain("discount-copy-v1");
    expect(versions).toContain("winback-email-v1");
  });

  test("validates prompt versions", () => {
    expect(isValidPromptVersion("opportunity-rationale-v1")).toBe(true);
    expect(isValidPromptVersion("invalid-prompt")).toBe(false);
  });

  test("gets prompt by version", () => {
    const prompt = getPrompt("opportunity-rationale-v1");
    expect(prompt).toBe(opportunityRationalePrompt);
  });

  test("throws on invalid version", () => {
    expect(() => getPrompt("invalid-version")).toThrow();
  });

  test("gets latest version for prompt family", () => {
    const latest = getLatestVersion("opportunity-rationale");
    expect(latest).toBe("opportunity-rationale-v1");
  });

  test("returns null for unknown prompt family", () => {
    const latest = getLatestVersion("unknown-prompt");
    expect(latest).toBeNull();
  });
});

describe("Opportunity Rationale Prompt", () => {
  const baseInput: OpportunityRationaleInput = {
    workspaceId: "test-workspace",
    opportunityType: "inventory_clearance",
    operatorIntent: "reduce_inventory_risk",
    eventsSummary: "Inventory threshold crossed",
    timeWindow: {
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    },
  };

  test("generates valid fallback output", () => {
    const output = opportunityRationalePrompt.fallbackGenerator(baseInput);

    expect(output.rationale).toBeTruthy();
    expect(output.why_now).toBeTruthy();
    expect(output.counterfactual).toBeTruthy();
    expect(output.confidence_note).toBeTruthy();
  });

  test("never invents metrics", () => {
    const output = opportunityRationalePrompt.fallbackGenerator(baseInput);

    // Should not contain large numbers we didn't provide
    expect(output.rationale).not.toMatch(/\$\d{3,}/);
    expect(output.rationale).not.toMatch(/\d{3,} units/);
  });

  test("uses provided store context", () => {
    const input: OpportunityRationaleInput = {
      ...baseInput,
      storeContext: {
        productName: "Winter Jacket",
        currentInventory: 12,
      },
    };

    const output = opportunityRationalePrompt.fallbackGenerator(input);

    expect(output.rationale).toContain("Winter Jacket");
    expect(output.rationale).toContain("12");
  });

  test("customizes by operator intent", () => {
    const inventoryIntent = opportunityRationalePrompt.fallbackGenerator({
      ...baseInput,
      operatorIntent: "reduce_inventory_risk",
    });

    const reengageIntent = opportunityRationalePrompt.fallbackGenerator({
      ...baseInput,
      operatorIntent: "reengage_dormant_customers",
    });

    expect(inventoryIntent.rationale).not.toBe(reengageIntent.rationale);
  });

  test("generates impact range when appropriate", () => {
    const input: OpportunityRationaleInput = {
      ...baseInput,
      storeContext: {
        productName: "Test Product",
        currentInventory: 20,
      },
    };

    const output = opportunityRationalePrompt.fallbackGenerator(input);
    expect(output.impact_range).toBeTruthy();
    expect(output.impact_range).toMatch(/\d+-\d+ units/);
  });
});

describe("Discount Copy Prompt", () => {
  const baseInput: DiscountCopyInput = {
    workspaceId: "test-workspace",
    productName: "Test Product",
    discountPercent: 20,
    urgencyLevel: "medium",
  };

  test("generates valid fallback output", () => {
    const output = discountCopyPrompt.fallbackGenerator(baseInput);

    expect(output.rationale).toBeTruthy();
    expect(output.why_now).toBeTruthy();
    expect(output.counterfactual).toBeTruthy();
    expect(output.subject_line).toBeTruthy();
    expect(output.body_copy).toBeTruthy();
    expect(output.cta_text).toBeTruthy();
  });

  test("subject line under 50 characters", () => {
    const output = discountCopyPrompt.fallbackGenerator(baseInput);
    expect(output.subject_line.length).toBeLessThanOrEqual(50);
  });

  test("never uses manipulative language", () => {
    const output = discountCopyPrompt.fallbackGenerator(baseInput);

    const manipulativePatterns = [
      /urgent!*/gi,
      /hurry!*/gi,
      /act now!*/gi,
      /last chance!*/gi,
      /don't miss out!*/gi,
    ];

    manipulativePatterns.forEach((pattern) => {
      expect(output.subject_line).not.toMatch(pattern);
      expect(output.body_copy).not.toMatch(pattern);
    });
  });

  test("includes discount percentage", () => {
    const output = discountCopyPrompt.fallbackGenerator(baseInput);

    expect(output.subject_line).toContain("20%");
    expect(output.body_copy).toContain("20%");
  });

  test("includes product name", () => {
    const output = discountCopyPrompt.fallbackGenerator(baseInput);

    expect(output.subject_line).toContain("Test Product");
    expect(output.body_copy).toContain("Test Product");
  });

  test("includes inventory when low", () => {
    const input: DiscountCopyInput = {
      ...baseInput,
      inventoryRemaining: 5,
    };

    const output = discountCopyPrompt.fallbackGenerator(input);
    expect(output.body_copy).toContain("5 units");
  });

  test("includes expiry date when provided", () => {
    const input: DiscountCopyInput = {
      ...baseInput,
      expiryDate: "2026-02-01",
    };

    const output = discountCopyPrompt.fallbackGenerator(input);
    expect(output.body_copy).toContain("2026-02-01");
  });
});

describe("Win-back Email Prompt", () => {
  const baseInput: WinbackEmailInput = {
    workspaceId: "test-workspace",
    lastPurchaseDate: "2025-10-01",
    daysSinceLastPurchase: 90,
  };

  test("generates valid fallback output", () => {
    const output = winbackEmailPrompt.fallbackGenerator(baseInput);

    expect(output.rationale).toBeTruthy();
    expect(output.why_now).toBeTruthy();
    expect(output.counterfactual).toBeTruthy();
    expect(output.subject).toBeTruthy();
    expect(output.body).toBeTruthy();
    expect(output.cta).toBeTruthy();
  });

  test("never guilt-trips customer", () => {
    const output = winbackEmailPrompt.fallbackGenerator(baseInput);

    const guiltPatterns = [
      /we miss you!*/gi,
      /where did you go/gi,
      /come back/gi,
      /don't leave us/gi,
    ];

    guiltPatterns.forEach((pattern) => {
      expect(output.subject).not.toMatch(pattern);
      expect(output.body).not.toMatch(pattern);
    });
  });

  test("uses customer name when provided", () => {
    const input: WinbackEmailInput = {
      ...baseInput,
      customerName: "Sarah",
    };

    const output = winbackEmailPrompt.fallbackGenerator(input);
    expect(output.body).toContain("Sarah");
  });

  test("uses generic greeting without name", () => {
    const output = winbackEmailPrompt.fallbackGenerator(baseInput);
    expect(output.body).toContain("Hi there");
  });

  test("includes previous purchase category", () => {
    const input: WinbackEmailInput = {
      ...baseInput,
      previousPurchaseCategory: "Winter Apparel",
    };

    const output = winbackEmailPrompt.fallbackGenerator(input);
    expect(output.body).toContain("Winter Apparel");
    expect(output.subject).toContain("Winter Apparel");
  });

  test("includes incentive when provided", () => {
    const input: WinbackEmailInput = {
      ...baseInput,
      incentivePercent: 15,
    };

    const output = winbackEmailPrompt.fallbackGenerator(input);
    expect(output.subject).toContain("15%");
    expect(output.body).toContain("15%");
  });

  test("includes recommended products", () => {
    const input: WinbackEmailInput = {
      ...baseInput,
      recommendedProducts: ["Product A", "Product B", "Product C"],
    };

    const output = winbackEmailPrompt.fallbackGenerator(input);
    expect(output.body).toContain("Product A");
    expect(output.body).toContain("Product B");
  });

  test("tracks personalization notes", () => {
    const input: WinbackEmailInput = {
      ...baseInput,
      customerName: "Sarah",
      previousPurchaseCategory: "Winter Apparel",
      incentivePercent: 15,
    };

    const output = winbackEmailPrompt.fallbackGenerator(input);
    expect(output.personalization_notes).toContain("customer name");
    expect(output.personalization_notes).toContain("purchase category");
    expect(output.personalization_notes).toContain("incentive");
  });
});

describe("Fallback Utilities", () => {
  test("validateOutput accepts valid output", () => {
    const output = {
      rationale: "Valid rationale",
      why_now: "Valid why now",
      counterfactual: "Valid counterfactual",
    };

    expect(validateOutput(output)).toBe(true);
  });

  test("validateOutput rejects missing rationale", () => {
    const output = {
      rationale: "",
      why_now: "Valid",
      counterfactual: "Valid",
    };

    expect(validateOutput(output)).toBe(false);
  });

  test("validateOutput rejects missing why_now", () => {
    const output = {
      rationale: "Valid",
      why_now: "",
      counterfactual: "Valid",
    };

    expect(validateOutput(output)).toBe(false);
  });

  test("validateOutput rejects missing counterfactual", () => {
    const output = {
      rationale: "Valid",
      why_now: "Valid",
      counterfactual: "",
    };

    expect(validateOutput(output)).toBe(false);
  });

  test("sanitizeOutput removes prohibited phrases", () => {
    const text =
      "This will definitely work and is guaranteed to increase sales! Act now or you'll miss out!";

    const sanitized = sanitizeOutput(text);

    expect(sanitized).toContain("[REMOVED]");
    expect(sanitized).not.toContain("will definitely");
    expect(sanitized).not.toContain("guaranteed to");
  });

  test("sanitizeOutput preserves clean text", () => {
    const text = "This approach likely helps based on recent data.";
    const sanitized = sanitizeOutput(text);

    expect(sanitized).toBe(text);
  });

  test("calculateImpactRange generates safe ranges", () => {
    const range = calculateImpactRange(100, 0.5);

    expect(range).toMatch(/\d+-\d+/);
    const [lower, upper] = range.split("-").map(Number);

    expect(lower).toBeLessThanOrEqual(100);
    expect(upper).toBeGreaterThanOrEqual(100);
  });

  test("calculateImpactRange handles small numbers", () => {
    const range = calculateImpactRange(5, 0.5);

    const [lower] = range.split("-").map(Number);
    expect(lower).toBeGreaterThanOrEqual(1); // Never goes below 1
  });
});

describe("Prompt Template Structure", () => {
  test("all prompts have version field", () => {
    expect(opportunityRationalePrompt.version).toBeTruthy();
    expect(discountCopyPrompt.version).toBeTruthy();
    expect(winbackEmailPrompt.version).toBeTruthy();
  });

  test("all prompts have system prompt", () => {
    expect(opportunityRationalePrompt.systemPrompt).toBeTruthy();
    expect(discountCopyPrompt.systemPrompt).toBeTruthy();
    expect(winbackEmailPrompt.systemPrompt).toBeTruthy();
  });

  test("all prompts have user prompt template", () => {
    expect(typeof opportunityRationalePrompt.userPromptTemplate).toBe("function");
    expect(typeof discountCopyPrompt.userPromptTemplate).toBe("function");
    expect(typeof winbackEmailPrompt.userPromptTemplate).toBe("function");
  });

  test("all prompts have fallback generator", () => {
    expect(typeof opportunityRationalePrompt.fallbackGenerator).toBe("function");
    expect(typeof discountCopyPrompt.fallbackGenerator).toBe("function");
    expect(typeof winbackEmailPrompt.fallbackGenerator).toBe("function");
  });

  test("all prompts have output schema", () => {
    expect(opportunityRationalePrompt.outputSchema).toBeTruthy();
    expect(discountCopyPrompt.outputSchema).toBeTruthy();
    expect(winbackEmailPrompt.outputSchema).toBeTruthy();
  });

  test("all output schemas require core fields", () => {
    expect(opportunityRationalePrompt.outputSchema.required).toContain("rationale");
    expect(opportunityRationalePrompt.outputSchema.required).toContain("why_now");
    expect(opportunityRationalePrompt.outputSchema.required).toContain("counterfactual");
  });
});

describe("Safety Guarantees", () => {
  test("opportunity rationale never invents large numbers", () => {
    const inputs: OpportunityRationaleInput[] = [
      {
        workspaceId: "test",
        opportunityType: "test",
        operatorIntent: "reduce_inventory_risk",
        eventsSummary: "test",
        timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
      },
      {
        workspaceId: "test",
        opportunityType: "test",
        operatorIntent: "reengage_dormant_customers",
        eventsSummary: "test",
        timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
      },
      {
        workspaceId: "test",
        opportunityType: "test",
        operatorIntent: "protect_margin",
        eventsSummary: "test",
        timeWindow: { startDate: "2026-01-01", endDate: "2026-01-15" },
      },
    ];

    inputs.forEach((input) => {
      const output = opportunityRationalePrompt.fallbackGenerator(input);

      // Should not contain large arbitrary numbers
      const largeNumbers = output.rationale.match(/\d{4,}/g) || [];
      expect(largeNumbers.length).toBe(0);
    });
  });

  test("discount copy never uses dark patterns", () => {
    const input: DiscountCopyInput = {
      workspaceId: "test",
      productName: "Test",
      discountPercent: 50,
      urgencyLevel: "high", // Even with high urgency, no dark patterns
    };

    const output = discountCopyPrompt.fallbackGenerator(input);

    const darkPatterns = [
      /urgent!+/gi,
      /act now!+/gi,
      /limited time!+/gi,
      /don't miss!+/gi,
      /only \d+ left!+/gi,
    ];

    const allText = output.subject_line + " " + output.body_copy + " " + output.cta_text;

    darkPatterns.forEach((pattern) => {
      expect(allText).not.toMatch(pattern);
    });
  });

  test("winback email never guilt-trips", () => {
    const inputs: WinbackEmailInput[] = [
      {
        workspaceId: "test",
        lastPurchaseDate: "2025-01-01",
        daysSinceLastPurchase: 365, // Very long dormancy
      },
      {
        workspaceId: "test",
        lastPurchaseDate: "2025-10-01",
        daysSinceLastPurchase: 90,
      },
    ];

    inputs.forEach((input) => {
      const output = winbackEmailPrompt.fallbackGenerator(input);

      const guiltPhrases = [
        /miss you/gi,
        /come back/gi,
        /where.*go/gi,
        /leave.*us/gi,
        /without you/gi,
      ];

      const allText = output.subject + " " + output.body;

      guiltPhrases.forEach((phrase) => {
        expect(allText).not.toMatch(phrase);
      });
    });
  });
});
