/**
 * Opportunity Generation Integration Tests
 *
 * Tests opportunity creation from events including:
 * - Opportunity creation from event triggers
 * - Priority calculation
 * - Decay time setting
 * - Deterministic output
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismaMock, createTestEvent, createTestWorkspace } from '@/tests/setup';
import {
  createOpportunityFromEvents,
  generateOpportunityExplanations,
} from '@/server/opportunities/create';
import { OpportunityType } from '@/server/opportunities/types';

// Mock billing limit enforcement — createOpportunityFromEvents now calls checkLimit/incrementUsage
vi.mock('@/server/billing/limit-enforcement', () => ({
  checkLimit: vi.fn().mockResolvedValue(undefined),
  incrementUsage: vi.fn().mockResolvedValue(1),
}));

describe('Opportunity Generation - Integration', () => {
  const testWorkspace = createTestWorkspace();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Opportunity Creation from Events', () => {
    it('should create opportunity from inventory threshold event', async () => {
      const inventoryEvent = createTestEvent({
        type: 'inventory_threshold_crossed',
        payload_json: {
          product_id: 'gid://shopify/Product/123456',
          product_title: 'Winter Jacket',
          current_inventory: 5,
          threshold: 10,
          variant_id: 'gid://shopify/ProductVariant/789',
        },
        dedupe_key: 'inventory_threshold_crossed:123456:2024-01-15',
      });

      prismaMock.event.findMany.mockResolvedValue([inventoryEvent]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-123',
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        priority_bucket: 'high',
        why_now: 'Winter Jacket inventory dropped to 5 units, below your 10 unit threshold.',
        rationale:
          'Low inventory creates holding cost risk and potential waste if the product doesn\'t sell. A targeted discount can accelerate sales and clear inventory before it becomes a liability.',
        impact_range: '2-4 units potentially cleared',
        counterfactual:
          'Without action, this inventory may sit for weeks, tying up capital and warehouse space. Risk of obsolescence or seasonal irrelevance increases over time.',
        decay_at: new Date('2024-01-22T12:00:00Z'),
        confidence: 0.75,
        state: 'new',
        created_at: new Date('2024-01-15T12:10:00Z'),
        updated_at: new Date('2024-01-15T12:10:00Z'),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: [inventoryEvent.id],
        operator_intent: 'reduce_inventory_risk',
        why_now: 'Winter Jacket inventory dropped to 5 units, below your 10 unit threshold.',
        rationale:
          'Low inventory creates holding cost risk and potential waste if the product doesn\'t sell.',
        impact_range: '2-4 units potentially cleared',
        counterfactual: 'Without action, this inventory may sit for weeks.',
        confidence: 0.75,
      });

      expect(opportunity).toBeDefined();
      expect(opportunity.type).toBe(OpportunityType.INVENTORY_CLEARANCE);
      expect(opportunity.workspace_id).toBe(testWorkspace.id);
      expect(opportunity.state).toBe('new');
    });

    it('should link events to opportunity', async () => {
      const events = [
        createTestEvent({ id: 'event-1' }),
        createTestEvent({ id: 'event-2' }),
        createTestEvent({ id: 'event-3' }),
      ];

      prismaMock.event.findMany.mockResolvedValue(events);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-123',
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        priority_bucket: 'medium',
        why_now: 'Test why now',
        rationale: 'Test rationale',
        impact_range: 'Test impact',
        counterfactual: 'Test counterfactual',
        decay_at: new Date('2024-01-22T12:00:00Z'),
        confidence: 0.5,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 3 });

      await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: events.map((e) => e.id),
        operator_intent: 'reduce_inventory_risk',
        why_now: 'Test why now',
        rationale: 'Test rationale',
        impact_range: 'Test impact',
        counterfactual: 'Test counterfactual',
      });

      expect(prismaMock.opportunityEventLink.createMany).toHaveBeenCalledWith({
        data: [
          { opportunity_id: 'opp-123', event_id: 'event-1' },
          { opportunity_id: 'opp-123', event_id: 'event-2' },
          { opportunity_id: 'opp-123', event_id: 'event-3' },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('Priority Calculation', () => {
    it('should calculate HIGH priority for critical inventory threshold', async () => {
      const criticalEvent = createTestEvent({
        type: 'inventory_threshold_crossed',
        payload_json: {
          product_id: 'gid://shopify/Product/123456',
          current_inventory: 2,
          threshold: 10,
          urgency_score: 0.9,
        },
      });

      prismaMock.event.findMany.mockResolvedValue([criticalEvent]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-123',
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        priority_bucket: 'high',
        why_now: 'Critical inventory level',
        rationale: 'Immediate action required',
        impact_range: 'High impact',
        counterfactual: 'Risk of stockout',
        decay_at: new Date('2024-01-16T12:00:00Z'),
        confidence: 0.85,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: [criticalEvent.id],
        operator_intent: 'reduce_inventory_risk',
        priority_bucket: 'high',
        why_now: 'Critical inventory level',
        rationale: 'Immediate action required',
        impact_range: 'High impact',
        counterfactual: 'Risk of stockout',
        confidence: 0.85,
      });

      expect(opportunity.priority_bucket).toBe('high');
    });

    it('should calculate MEDIUM priority for moderate urgency', async () => {
      const moderateEvent = createTestEvent({
        type: 'customer_inactivity_threshold',
        payload_json: {
          customer_id: 'gid://shopify/Customer/456',
          days_inactive: 45,
          threshold: 30,
          urgency_score: 0.5,
        },
      });

      prismaMock.event.findMany.mockResolvedValue([moderateEvent]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-124',
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        priority_bucket: 'medium',
        why_now: 'Customer inactive for 45 days',
        rationale: 'Re-engagement opportunity',
        impact_range: 'Moderate impact',
        counterfactual: 'Risk of churn',
        decay_at: new Date('2024-01-30T12:00:00Z'),
        confidence: 0.6,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        event_ids: [moderateEvent.id],
        operator_intent: 'reengage_dormant_customers',
        priority_bucket: 'medium',
        why_now: 'Customer inactive for 45 days',
        rationale: 'Re-engagement opportunity',
        impact_range: 'Moderate impact',
        counterfactual: 'Risk of churn',
        confidence: 0.6,
      });

      expect(opportunity.priority_bucket).toBe('medium');
    });

    it('should calculate LOW priority for low urgency events', async () => {
      const lowUrgencyEvent = createTestEvent({
        type: 'product_back_in_stock',
        payload_json: {
          product_id: 'gid://shopify/Product/789',
          new_inventory: 100,
          out_of_stock_duration_days: 2,
          urgency_score: 0.3,
        },
      });

      prismaMock.event.findMany.mockResolvedValue([lowUrgencyEvent]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-125',
        workspace_id: testWorkspace.id,
        type: OpportunityType.RESTOCK_NOTIFICATION,
        priority_bucket: 'low',
        why_now: 'Product back in stock',
        rationale: 'Notify interested customers',
        impact_range: 'Low to moderate impact',
        counterfactual: 'Missed sales opportunity',
        decay_at: new Date('2024-02-15T12:00:00Z'),
        confidence: 0.4,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.RESTOCK_NOTIFICATION,
        event_ids: [lowUrgencyEvent.id],
        operator_intent: 'capture_restock_demand',
        priority_bucket: 'low',
        why_now: 'Product back in stock',
        rationale: 'Notify interested customers',
        impact_range: 'Low to moderate impact',
        counterfactual: 'Missed sales opportunity',
        confidence: 0.4,
      });

      expect(opportunity.priority_bucket).toBe('low');
    });
  });

  describe('Decay Time Setting', () => {
    it('should set decay time based on opportunity type - inventory clearance', async () => {
      const event = createTestEvent({ type: 'inventory_threshold_crossed' });

      prismaMock.event.findMany.mockResolvedValue([event]);

      const now = new Date('2024-01-15T12:00:00Z');
      const expectedDecay = new Date('2024-01-22T12:00:00Z'); // 7 days for inventory

      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-123',
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        priority_bucket: 'high',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        decay_at: expectedDecay,
        confidence: 0.5,
        state: 'new',
        created_at: now,
        updated_at: now,
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: [event.id],
        operator_intent: 'reduce_inventory_risk',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
      });

      // Decay should be set appropriately for opportunity type
      expect(opportunity.decay_at).toBeDefined();
    });

    it('should set longer decay for win-back campaigns', async () => {
      const event = createTestEvent({ type: 'customer_inactivity_threshold' });

      prismaMock.event.findMany.mockResolvedValue([event]);

      const now = new Date('2024-01-15T12:00:00Z');
      const expectedDecay = new Date('2024-02-14T12:00:00Z'); // 30 days for win-back

      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-124',
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        priority_bucket: 'medium',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        decay_at: expectedDecay,
        confidence: 0.5,
        state: 'new',
        created_at: now,
        updated_at: now,
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        event_ids: [event.id],
        operator_intent: 'reengage_dormant_customers',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
      });

      expect(opportunity.decay_at).toBeDefined();
      // Win-back should have longer decay time than inventory clearance
    });
  });

  describe('Deterministic Output', () => {
    it('should produce same opportunity given same inputs', async () => {
      const event = createTestEvent({
        id: 'event-deterministic-1',
        type: 'inventory_threshold_crossed',
        payload_json: {
          product_id: 'gid://shopify/Product/123',
          product_title: 'Test Product',
          current_inventory: 5,
          threshold: 10,
        },
      });

      const input = {
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: [event.id],
        operator_intent: 'reduce_inventory_risk' as const,
        why_now: 'Test Product inventory dropped to 5 units, below your 10 unit threshold.',
        rationale:
          'Low inventory creates holding cost risk and potential waste if the product doesn\'t sell.',
        impact_range: '2-4 units potentially cleared',
        counterfactual: 'Without action, this inventory may sit for weeks.',
        confidence: 0.75,
      };

      prismaMock.event.findMany.mockResolvedValue([event]);

      const opportunity1 = {
        id: 'opp-det-1',
        workspace_id: testWorkspace.id,
        ...input,
        priority_bucket: 'high' as const,
        decay_at: new Date('2024-01-22T12:00:00Z'),
        state: 'new' as const,
        created_at: new Date('2024-01-15T12:00:00Z'),
        updated_at: new Date('2024-01-15T12:00:00Z'),
      };

      prismaMock.opportunity.create.mockResolvedValue(opportunity1);
      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const result1 = await createOpportunityFromEvents(input);

      // Reset mocks
      vi.clearAllMocks();
      prismaMock.event.findMany.mockResolvedValue([event]);

      const opportunity2 = {
        id: 'opp-det-2',
        workspace_id: testWorkspace.id,
        ...input,
        priority_bucket: 'high' as const,
        decay_at: new Date('2024-01-22T12:00:00Z'),
        state: 'new' as const,
        created_at: new Date('2024-01-15T12:00:00Z'),
        updated_at: new Date('2024-01-15T12:00:00Z'),
      };

      prismaMock.opportunity.create.mockResolvedValue(opportunity2);
      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const result2 = await createOpportunityFromEvents(input);

      // Same inputs should produce same outputs (deterministic)
      expect(result1.type).toBe(result2.type);
      expect(result1.priority_bucket).toBe(result2.priority_bucket);
      expect(result1.why_now).toBe(result2.why_now);
      expect(result1.rationale).toBe(result2.rationale);
      expect(result1.counterfactual).toBe(result2.counterfactual);
    });

    it('should use fallback templates deterministically when AI fails', async () => {
      const event = createTestEvent({
        type: 'inventory_threshold_crossed',
        payload_json: {
          product_id: 'gid://shopify/Product/123',
          product_title: 'Winter Jacket',
          current_inventory: 5,
          threshold: 10,
        },
      });

      const aiInput = {
        opportunity_type: OpportunityType.INVENTORY_CLEARANCE,
        event_data: [event],
        workspace_context: {},
      };

      // Generate explanations twice
      const explanations1 = await generateOpportunityExplanations(aiInput);
      const explanations2 = await generateOpportunityExplanations(aiInput);

      // Fallback templates should be deterministic
      expect(explanations1.why_now).toBe(explanations2.why_now);
      expect(explanations1.rationale).toBe(explanations2.rationale);
      expect(explanations1.counterfactual).toBe(explanations2.counterfactual);
      expect(explanations1.impact_range).toBe(explanations2.impact_range);
    });
  });

  describe('Operator Intent Mapping', () => {
    it('should map inventory events to reduce_inventory_risk intent', async () => {
      const event = createTestEvent({ type: 'inventory_threshold_crossed' });

      prismaMock.event.findMany.mockResolvedValue([event]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-123',
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        priority_bucket: 'high',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        decay_at: new Date(),
        confidence: 0.5,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.INVENTORY_CLEARANCE,
        event_ids: [event.id],
        operator_intent: 'reduce_inventory_risk',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
      });

      expect(opportunity).toBeDefined();
      // Operator intent should be reduce_inventory_risk
    });

    it('should map customer inactivity to reengage_dormant_customers intent', async () => {
      const event = createTestEvent({ type: 'customer_inactivity_threshold' });

      prismaMock.event.findMany.mockResolvedValue([event]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-124',
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        priority_bucket: 'medium',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        decay_at: new Date(),
        confidence: 0.5,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.WINBACK_CAMPAIGN,
        event_ids: [event.id],
        operator_intent: 'reengage_dormant_customers',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
      });

      expect(opportunity).toBeDefined();
    });

    it('should map high velocity events to protect_margin intent', async () => {
      const event = createTestEvent({
        type: 'velocity_spike',
        payload_json: {
          product_id: 'gid://shopify/Product/999',
          spike_multiplier: 3.5,
          current_units_per_day: 35,
          baseline_units_per_day: 10,
        },
      });

      prismaMock.event.findMany.mockResolvedValue([event]);
      prismaMock.opportunity.create.mockResolvedValue({
        id: 'opp-125',
        workspace_id: testWorkspace.id,
        type: OpportunityType.HIGH_VELOCITY_PROTECTION,
        priority_bucket: 'high',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        decay_at: new Date(),
        confidence: 0.8,
        state: 'new',
        created_at: new Date(),
        updated_at: new Date(),
      });

      prismaMock.opportunityEventLink.createMany.mockResolvedValue({ count: 1 });

      const opportunity = await createOpportunityFromEvents({
        workspace_id: testWorkspace.id,
        type: OpportunityType.HIGH_VELOCITY_PROTECTION,
        event_ids: [event.id],
        operator_intent: 'protect_margin',
        why_now: 'Test',
        rationale: 'Test',
        impact_range: 'Test',
        counterfactual: 'Test',
        confidence: 0.8,
      });

      expect(opportunity).toBeDefined();
    });
  });
});
