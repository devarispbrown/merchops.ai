/**
 * Unit Tests: Payload Schema Validation
 * MerchOps Beta MVP
 *
 * Tests:
 * - Discount payload validation
 * - Email payload validation
 * - Product pause payload validation
 * - Invalid payloads rejected
 * - Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import {
  DiscountDraftPayloadSchema,
  WinbackEmailPayloadSchema,
  PauseProductPayloadSchema,
  getPayloadSchema,
  ExecutionType,
} from '@/server/actions/types';

describe('Payload Schema Validation', () => {
  describe('Discount Draft Payload', () => {
    it('should validate valid discount payload', () => {
      const validPayload = {
        title: 'Winter Clearance Sale',
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        target_ids: ['gid://shopify/Product/123'],
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Winter Clearance Sale');
        expect(result.data.value).toBe(25);
      }
    });

    it('should validate discount with all optional fields', () => {
      const validPayload = {
        title: 'Limited Time Offer',
        code: 'SAVE20',
        discount_type: 'fixed_amount',
        value: 10,
        target_type: 'entire_order',
        usage_limit: 100,
        customer_segment: 'vip_customers',
        starts_at: '2024-12-01T00:00:00Z',
        ends_at: '2024-12-31T23:59:59Z',
        minimum_purchase_amount: 50,
      };

      const result = DiscountDraftPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject discount with missing title', () => {
      const invalidPayload = {
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with empty title', () => {
      const invalidPayload = {
        title: '',
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with title exceeding max length', () => {
      const invalidPayload = {
        title: 'x'.repeat(256),
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with invalid discount_type', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'free_shipping',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with zero value', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: 0,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with negative value', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: -10,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with invalid target_type', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: 25,
        target_type: 'category',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with invalid date format', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01',
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with negative usage_limit', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
        usage_limit: -5,
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject discount with negative minimum_purchase_amount', () => {
      const invalidPayload = {
        title: 'Sale',
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
        minimum_purchase_amount: -10,
      };

      const result = DiscountDraftPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Winback Email Payload', () => {
    it('should validate valid email payload', () => {
      const validPayload = {
        subject: 'We miss you!',
        body_html: '<p>Come back and shop with us</p>',
        body_text: 'Come back and shop with us',
        from_name: 'MerchOps Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_30_days',
      };

      const result = WinbackEmailPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate email with all optional fields', () => {
      const validPayload = {
        subject: 'Special offer just for you',
        preview_text: 'Open to see your exclusive discount',
        body_html: '<p>Here is your discount</p>',
        body_text: 'Here is your discount',
        from_name: 'MerchOps Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant_60_days',
        include_discount_code: 'WELCOME_BACK',
        send_at: '2024-12-01T09:00:00Z',
      };

      const result = WinbackEmailPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject email with missing subject', () => {
      const invalidPayload = {
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with empty subject', () => {
      const invalidPayload = {
        subject: '',
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with subject exceeding max length', () => {
      const invalidPayload = {
        subject: 'x'.repeat(256),
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with preview_text exceeding max length', () => {
      const invalidPayload = {
        subject: 'Welcome back',
        preview_text: 'x'.repeat(151),
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with missing body_html', () => {
      const invalidPayload = {
        subject: 'Welcome back',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with missing body_text', () => {
      const invalidPayload = {
        subject: 'Welcome back',
        body_html: '<p>Come back</p>',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with invalid from_email', () => {
      const invalidPayload = {
        subject: 'Welcome back',
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'not-an-email',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject email with invalid send_at format', () => {
      const invalidPayload = {
        subject: 'Welcome back',
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
        send_at: '2024-12-01',
      };

      const result = WinbackEmailPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('Pause Product Payload', () => {
    it('should validate valid pause payload', () => {
      const validPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'Low inventory - preventing stockout',
      };

      const result = PauseProductPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate pause with all optional fields', () => {
      const validPayload = {
        product_ids: ['gid://shopify/Product/123', 'gid://shopify/Product/456'],
        reason: 'Temporary supplier issue',
        restore_at: '2024-12-15T00:00:00Z',
        notify_customers: true,
        redirect_to_similar: true,
        similar_product_ids: ['gid://shopify/Product/789'],
      };

      const result = PauseProductPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject pause with empty product_ids array', () => {
      const invalidPayload = {
        product_ids: [],
        reason: 'Low inventory',
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject pause with missing product_ids', () => {
      const invalidPayload = {
        reason: 'Low inventory',
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject pause with missing reason', () => {
      const invalidPayload = {
        product_ids: ['gid://shopify/Product/123'],
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject pause with empty reason', () => {
      const invalidPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: '',
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject pause with reason exceeding max length', () => {
      const invalidPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'x'.repeat(501),
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject pause with invalid restore_at format', () => {
      const invalidPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'Low inventory',
        restore_at: '2024-12-15',
      };

      const result = PauseProductPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should default notify_customers to false if not provided', () => {
      const validPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'Low inventory',
      };

      const result = PauseProductPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notify_customers).toBe(false);
      }
    });

    it('should default redirect_to_similar to false if not provided', () => {
      const validPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'Low inventory',
      };

      const result = PauseProductPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.redirect_to_similar).toBe(false);
      }
    });
  });

  describe('Schema Helper Functions', () => {
    it('should return correct schema for discount_draft', () => {
      const schema = getPayloadSchema(ExecutionType.DISCOUNT_DRAFT);
      expect(schema).toBe(DiscountDraftPayloadSchema);
    });

    it('should return correct schema for winback_email_draft', () => {
      const schema = getPayloadSchema(ExecutionType.WINBACK_EMAIL);
      expect(schema).toBe(WinbackEmailPayloadSchema);
    });

    it('should return correct schema for pause_product', () => {
      const schema = getPayloadSchema(ExecutionType.PAUSE_PRODUCT);
      expect(schema).toBe(PauseProductPayloadSchema);
    });

    it('should throw error for unknown execution type', () => {
      expect(() => {
        getPayloadSchema('unknown_type' as ExecutionType);
      }).toThrow('Unknown execution type: unknown_type');
    });
  });

  describe('Edge Cases', () => {
    it('should handle discount with exactly max title length', () => {
      const validPayload = {
        title: 'x'.repeat(255),
        discount_type: 'percentage',
        value: 25,
        target_type: 'product',
        starts_at: '2024-12-01T00:00:00Z',
      };

      const result = DiscountDraftPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should handle email with exactly max preview_text length', () => {
      const validPayload = {
        subject: 'Welcome back',
        preview_text: 'x'.repeat(150),
        body_html: '<p>Come back</p>',
        body_text: 'Come back',
        from_name: 'Store',
        from_email: 'store@example.com',
        recipient_segment: 'dormant',
      };

      const result = WinbackEmailPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should handle pause with exactly max reason length', () => {
      const validPayload = {
        product_ids: ['gid://shopify/Product/123'],
        reason: 'x'.repeat(500),
      };

      const result = PauseProductPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should handle discount with minimum_purchase_amount of 0', () => {
      const validPayload = {
        title: 'Free shipping',
        discount_type: 'percentage',
        value: 10,
        target_type: 'entire_order',
        starts_at: '2024-12-01T00:00:00Z',
        minimum_purchase_amount: 0,
      };

      const result = DiscountDraftPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });
});
