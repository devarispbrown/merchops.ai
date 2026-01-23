/**
 * Unit Tests: AI Fallback Templates
 * MerchOps Beta MVP
 *
 * Tests:
 * - Fallback templates generate valid output
 * - Templates include why_now
 * - Templates include counterfactual
 * - No hallucinated metrics
 * - Safe, calm language (no hype)
 */

import { describe, it, expect } from 'vitest';
import {
  generateOpportunityRationaleFallback,
  generateDiscountCopyFallback,
  generateWinbackEmailFallback,
  sanitizeOutput,
  validateOutput,
  calculateImpactRange,
} from '@/server/ai/fallbacks';

describe('AI Fallback Templates', () => {
  describe('Opportunity Rationale Fallback', () => {
    it('should generate valid output with all required fields', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Winter Jacket',
          currentInventory: 15,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.rationale).toBeDefined();
      expect(output.why_now).toBeDefined();
      expect(output.counterfactual).toBeDefined();
      expect(output.rationale.length).toBeGreaterThan(0);
      expect(output.why_now.length).toBeGreaterThan(0);
      expect(output.counterfactual.length).toBeGreaterThan(0);
    });

    it('should include why_now explanation', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Winter Jacket',
          currentInventory: 15,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.why_now).toContain('recently');
      expect(output.why_now.toLowerCase()).not.toContain('urgent');
      expect(output.why_now.toLowerCase()).not.toContain('hurry');
    });

    it('should include counterfactual reasoning', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Winter Jacket',
          currentInventory: 15,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.counterfactual).toContain('Without');
      expect(output.counterfactual.length).toBeGreaterThan(20);
    });

    it('should generate impact_range when inventory data is available', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Winter Jacket',
          currentInventory: 20,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.impact_range).toBeDefined();
      expect(output.impact_range).toMatch(/\d+-\d+ units/);
    });

    it('should handle reduce_inventory_risk intent', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Test Product',
          currentInventory: 10,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.rationale).toContain('Test Product');
      expect(output.rationale).toContain('10 units');
      expect(output.why_now).toContain('Inventory');
    });

    it('should handle reengage_dormant_customers intent', () => {
      const input = {
        opportunityType: 'winback_campaign',
        operatorIntent: 'reengage_dormant_customers',
        storeContext: {
          customerSegmentSize: 150,
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.rationale).toContain('150 customers');
      expect(output.rationale).toContain('reduced activity');
      expect(output.counterfactual).toContain('dormant');
      expect(output.impact_range).toMatch(/\d+-\d+ potential re-engagements/);
    });

    it('should handle protect_margin intent', () => {
      const input = {
        opportunityType: 'high_velocity_protection',
        operatorIntent: 'protect_margin',
        storeContext: {
          productName: 'Bestseller Item',
        },
      };

      const output = generateOpportunityRationaleFallback(input);

      expect(output.rationale).toContain('Bestseller Item');
      expect(output.rationale).toContain('strong performance');
      expect(output.why_now).toContain('velocity');
    });

    it('should not hallucinate metrics when context is missing', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {},
      };

      const output = generateOpportunityRationaleFallback(input);

      // Should not contain specific numbers when data not provided
      expect(output.rationale).not.toMatch(/\d+ units remaining/);
      expect(output.rationale).toBeDefined();
      expect(output.rationale.length).toBeGreaterThan(0);
    });

    it('should pass validation', () => {
      const input = {
        opportunityType: 'inventory_clearance',
        operatorIntent: 'reduce_inventory_risk',
        storeContext: {
          productName: 'Test Product',
          currentInventory: 10,
        },
      };

      const output = generateOpportunityRationaleFallback(input);
      const isValid = validateOutput(output);

      expect(isValid).toBe(true);
    });
  });

  describe('Discount Copy Fallback', () => {
    it('should generate valid discount copy with all required fields', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
        inventoryRemaining: 15,
        expiryDate: '2024-12-31',
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.rationale).toBeDefined();
      expect(output.why_now).toBeDefined();
      expect(output.counterfactual).toBeDefined();
      expect(output.subject_line).toBeDefined();
      expect(output.body_copy).toBeDefined();
      expect(output.cta_text).toBeDefined();
    });

    it('should include why_now in discount copy', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
        inventoryRemaining: 15,
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.why_now.length).toBeGreaterThan(0);
      expect(output.why_now).toContain('inventory');
    });

    it('should include counterfactual in discount copy', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.counterfactual).toContain('Without this discount');
    });

    it('should not use manipulative language', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
        inventoryRemaining: 5,
      };

      const output = generateDiscountCopyFallback(input);

      // Should not contain urgency manipulation
      expect(output.body_copy.toLowerCase()).not.toContain('hurry');
      expect(output.body_copy.toLowerCase()).not.toContain('act now');
      expect(output.body_copy.toLowerCase()).not.toContain('don\'t miss');
      expect(output.body_copy.toLowerCase()).not.toContain('last chance');
    });

    it('should include inventory information when available', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
        inventoryRemaining: 8,
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.body_copy).toContain('8 units');
    });

    it('should include expiry date when provided', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
        expiryDate: '2024-12-31',
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.body_copy).toContain('2024-12-31');
    });

    it('should generate subject line within length limit', () => {
      const input = {
        productName: 'Very Long Product Name That Should Be Truncated',
        discountPercent: 25,
      };

      const output = generateDiscountCopyFallback(input);

      expect(output.subject_line.length).toBeLessThanOrEqual(50);
    });

    it('should pass validation', () => {
      const input = {
        productName: 'Winter Jacket',
        discountPercent: 25,
      };

      const output = generateDiscountCopyFallback(input);
      const isValid = validateOutput(output);

      expect(isValid).toBe(true);
    });
  });

  describe('Winback Email Fallback', () => {
    it('should generate valid winback email with all required fields', () => {
      const input = {
        customerName: 'John',
        daysSinceLastPurchase: 45,
        recommendedProducts: ['Product A', 'Product B'],
        previousPurchaseCategory: 'Electronics',
        incentivePercent: 15,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.rationale).toBeDefined();
      expect(output.why_now).toBeDefined();
      expect(output.counterfactual).toBeDefined();
      expect(output.subject).toBeDefined();
      expect(output.body).toBeDefined();
      expect(output.cta).toBeDefined();
      expect(output.personalization_notes).toBeDefined();
    });

    it('should include why_now in winback email', () => {
      const input = {
        daysSinceLastPurchase: 60,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.why_now).toContain('60 days');
      expect(output.why_now).toContain('inactivity');
    });

    it('should include counterfactual in winback email', () => {
      const input = {
        daysSinceLastPurchase: 60,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.counterfactual).toContain('Without outreach');
      expect(output.counterfactual).toContain('dormant');
    });

    it('should personalize with customer name when available', () => {
      const input = {
        customerName: 'Sarah',
        daysSinceLastPurchase: 45,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body).toContain('Hi Sarah');
      expect(output.personalization_notes).toContain('customer name');
    });

    it('should use generic greeting when name not available', () => {
      const input = {
        daysSinceLastPurchase: 45,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body).toContain('Hi there');
    });

    it('should include previous purchase category when available', () => {
      const input = {
        daysSinceLastPurchase: 45,
        previousPurchaseCategory: 'Home & Garden',
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body).toContain('Home & Garden');
      expect(output.personalization_notes).toContain('previous purchase category');
    });

    it('should include recommended products when available', () => {
      const input = {
        daysSinceLastPurchase: 45,
        recommendedProducts: ['Product A', 'Product B', 'Product C'],
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body).toContain('Product A');
      expect(output.body).toContain('Product B');
      expect(output.personalization_notes).toContain('product recommendations');
    });

    it('should include incentive when available', () => {
      const input = {
        daysSinceLastPurchase: 45,
        incentivePercent: 20,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body).toContain('20%');
      expect(output.subject).toContain('20%');
      expect(output.personalization_notes).toContain('incentive');
    });

    it('should not use manipulative language', () => {
      const input = {
        daysSinceLastPurchase: 45,
        incentivePercent: 20,
      };

      const output = generateWinbackEmailFallback(input);

      expect(output.body.toLowerCase()).not.toContain('hurry');
      expect(output.body.toLowerCase()).not.toContain('urgent');
      expect(output.body.toLowerCase()).not.toContain('last chance');
    });

    it('should pass validation', () => {
      const input = {
        daysSinceLastPurchase: 45,
      };

      const output = generateWinbackEmailFallback(input);
      const isValid = validateOutput(output);

      expect(isValid).toBe(true);
    });
  });

  describe('Output Sanitization', () => {
    it('should remove "will definitely" phrases', () => {
      const text = 'This will definitely increase sales';
      const sanitized = sanitizeOutput(text);
      expect(sanitized).toContain('[REMOVED]');
      expect(sanitized).not.toContain('will definitely');
    });

    it('should remove "guaranteed to" phrases', () => {
      const text = 'This is guaranteed to work';
      const sanitized = sanitizeOutput(text);
      expect(sanitized).toContain('[REMOVED]');
      expect(sanitized).not.toContain('guaranteed to');
    });

    it('should remove "urgent!" phrases', () => {
      const text = 'Urgent! Act now!';
      const sanitized = sanitizeOutput(text);
      expect(sanitized).toContain('[REMOVED]');
      expect(sanitized).not.toContain('urgent');
    });

    it('should remove multiple prohibited phrases', () => {
      const text = 'Urgent! This is guaranteed to work! Don\'t miss out!';
      const sanitized = sanitizeOutput(text);
      expect(sanitized.match(/\[REMOVED\]/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('should leave clean text unchanged', () => {
      const text = 'This discount may help increase sales based on recent data';
      const sanitized = sanitizeOutput(text);
      expect(sanitized).toBe(text);
    });
  });

  describe('Output Validation', () => {
    it('should pass validation for complete output', () => {
      const output = {
        rationale: 'This is a rationale',
        why_now: 'This is why now',
        counterfactual: 'This is the counterfactual',
      };

      expect(validateOutput(output)).toBe(true);
    });

    it('should fail validation for missing rationale', () => {
      const output = {
        rationale: '',
        why_now: 'This is why now',
        counterfactual: 'This is the counterfactual',
      };

      expect(validateOutput(output)).toBe(false);
    });

    it('should fail validation for missing why_now', () => {
      const output = {
        rationale: 'This is a rationale',
        why_now: '',
        counterfactual: 'This is the counterfactual',
      };

      expect(validateOutput(output)).toBe(false);
    });

    it('should fail validation for missing counterfactual', () => {
      const output = {
        rationale: 'This is a rationale',
        why_now: 'This is why now',
        counterfactual: '',
      };

      expect(validateOutput(output)).toBe(false);
    });
  });

  describe('Impact Range Calculation', () => {
    it('should calculate safe impact range', () => {
      const range = calculateImpactRange(100, 0.5);
      expect(range).toMatch(/\d+-\d+/);

      const [lower, upper] = range.split('-').map(Number);
      expect(lower).toBeGreaterThan(0);
      expect(upper).toBeGreaterThan(lower);
    });

    it('should not go below 1 for lower bound', () => {
      const range = calculateImpactRange(2, 0.3);
      const [lower] = range.split('-').map(Number);
      expect(lower).toBeGreaterThanOrEqual(1);
    });

    it('should scale with confidence', () => {
      const range1 = calculateImpactRange(100, 0.3);
      const range2 = calculateImpactRange(100, 0.7);

      const [, upper1] = range1.split('-').map(Number);
      const [, upper2] = range2.split('-').map(Number);

      expect(upper2).toBeGreaterThan(upper1);
    });

    it('should handle default confidence', () => {
      const range = calculateImpactRange(100);
      expect(range).toMatch(/\d+-\d+/);
    });
  });
});
