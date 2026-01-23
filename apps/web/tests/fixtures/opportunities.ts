/**
 * Opportunity Test Fixtures
 *
 * Sample opportunities for different types, states, and priority buckets.
 */

import {
  OpportunityState,
  PriorityBucket,
  OperatorIntent,
  OpportunityType,
} from '../../server/opportunities/types';

// ============================================================================
// BASE OPPORTUNITY DATA
// ============================================================================

const baseOpportunity = {
  workspace_id: 'workspace-test-123',
  confidence: 0.85,
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
};

// ============================================================================
// INVENTORY CLEARANCE OPPORTUNITIES
// ============================================================================

export const inventoryClearanceHighPriority = {
  id: 'opp-inv-clearance-high-1',
  ...baseOpportunity,
  type: OpportunityType.INVENTORY_CLEARANCE,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.new,
  why_now: 'Seasonal inventory for winter apparel must be cleared within 2 weeks before spring collection arrives. Current warehouse capacity is at 92%.',
  rationale: 'Your winter coat inventory (47 units across 3 SKUs) has shown declining velocity over the past 14 days while storage costs are $4.50/unit/week. A strategic discount now prevents deeper markdowns later.',
  impact_range: '35-47 units cleared, $840-$1,410 revenue recovered',
  counterfactual: 'Without action, these units will require 40-60% markdowns in 3-4 weeks to clear, reducing margin from $30/unit to $12/unit.',
  decay_at: new Date('2024-01-18T10:00:00Z'),
  event_ids: ['evt-inv-threshold-1', 'evt-inv-threshold-2'],
};

export const inventoryClearanceMediumPriority = {
  id: 'opp-inv-clearance-med-1',
  ...baseOpportunity,
  type: OpportunityType.INVENTORY_CLEARANCE,
  priority_bucket: PriorityBucket.medium,
  state: OpportunityState.viewed,
  why_now: 'Product "Vintage Denim Jacket" has 23 units sitting for 45 days with only 2 sales in the last 30 days.',
  rationale: 'This SKU has a historically slow turnover rate (0.8 units/week) but maintains a 45% margin. A modest discount can accelerate movement without significant margin erosion.',
  impact_range: '12-18 units cleared, $480-$720 revenue',
  counterfactual: 'These units will continue to occupy shelf space and incur holding costs of $2.10/unit/week, costing $276 over the next 12 weeks.',
  decay_at: new Date('2024-01-22T10:00:00Z'),
  confidence: 0.72,
  event_ids: ['evt-inv-threshold-3'],
};

export const inventoryClearanceLowPriority = {
  id: 'opp-inv-clearance-low-1',
  ...baseOpportunity,
  type: OpportunityType.INVENTORY_CLEARANCE,
  priority_bucket: PriorityBucket.low,
  state: OpportunityState.dismissed,
  why_now: 'Accessory items have accumulated to 56 units across multiple low-value SKUs.',
  rationale: 'These accessories (belts, scarves) have average unit value of $15 and slow but steady sales. Bundling or small discounts could improve turnover.',
  impact_range: '20-30 units cleared, $240-$360 revenue',
  counterfactual: 'Items will eventually sell at full price over 8-12 weeks, but will continue to incur storage and handling costs.',
  decay_at: new Date('2024-01-25T10:00:00Z'),
  confidence: 0.65,
  event_ids: ['evt-inv-threshold-4', 'evt-inv-threshold-5'],
};

// ============================================================================
// STOCKOUT PREVENTION OPPORTUNITIES
// ============================================================================

export const stockoutPreventionHighPriority = {
  id: 'opp-stockout-high-1',
  ...baseOpportunity,
  type: OpportunityType.STOCKOUT_PREVENTION,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.approved,
  why_now: 'Your bestseller "Classic White Sneakers" is selling at 8.5 units/day with only 12 units remaining. At current velocity, stockout expected in 1.4 days.',
  rationale: 'This product accounts for 18% of monthly revenue and has a 3-week restock lead time. Pausing sales now prevents backorders and maintains customer satisfaction.',
  impact_range: 'Prevent 15-25 customer service contacts, maintain 95% fulfillment rate',
  counterfactual: 'Without pausing, you will oversell by 40-60 units during restock period, requiring refunds, apology emails, and likely negative reviews.',
  decay_at: new Date('2024-01-16T18:00:00Z'),
  confidence: 0.92,
  event_ids: ['evt-velocity-spike-1', 'evt-inv-threshold-6'],
};

export const stockoutPreventionMediumPriority = {
  id: 'opp-stockout-med-1',
  ...baseOpportunity,
  type: OpportunityType.STOCKOUT_PREVENTION,
  priority_bucket: PriorityBucket.medium,
  state: OpportunityState.executed,
  why_now: 'Limited edition "Artist Series Mug" has 8 units left with 1.5 units/day velocity.',
  rationale: 'This is a discontinued item that cannot be restocked. Pausing before stockout allows you to preserve units for VIP customers or special promotions.',
  impact_range: 'Preserve 5-8 units for strategic allocation',
  counterfactual: 'Remaining units will sell randomly over 5-6 days, missing opportunity to maximize value through targeted VIP offers.',
  decay_at: new Date('2024-01-20T10:00:00Z'),
  confidence: 0.78,
  event_ids: ['evt-inv-threshold-7'],
};

// ============================================================================
// RESTOCK NOTIFICATION OPPORTUNITIES
// ============================================================================

export const restockNotificationHighPriority = {
  id: 'opp-restock-high-1',
  ...baseOpportunity,
  type: OpportunityType.RESTOCK_NOTIFICATION,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.new,
  why_now: '"Premium Yoga Mat" back in stock after 12-day stockout. 23 customers inquired during outage, indicating pent-up demand.',
  rationale: 'This product has 89% conversion rate for restock emails within 48 hours. Immediate notification capitalizes on demand momentum before customers purchase alternatives.',
  impact_range: '15-20 sales from restock email, $450-$600 revenue',
  counterfactual: 'Without prompt notification, 60-70% of interested customers will have purchased from competitors or lost interest, resulting in 9-14 lost sales.',
  decay_at: new Date('2024-01-16T10:00:00Z'),
  confidence: 0.88,
  event_ids: ['evt-back-in-stock-1'],
};

export const restockNotificationMediumPriority = {
  id: 'opp-restock-med-1',
  ...baseOpportunity,
  type: OpportunityType.RESTOCK_NOTIFICATION,
  priority_bucket: PriorityBucket.medium,
  state: OpportunityState.resolved,
  why_now: '"Ceramic Planter Set" restocked after 5-day outage.',
  rationale: 'While this product had shorter stockout period, it maintains strong search traffic (45 visitors/day to product page) indicating sustained interest.',
  impact_range: '8-12 sales from restock email, $240-$360 revenue',
  counterfactual: 'Organic discovery will drive sales over 5-7 days, but proactive email could compress that timeline and capture 30-40% more early sales.',
  decay_at: new Date('2024-01-17T10:00:00Z'),
  confidence: 0.71,
  event_ids: ['evt-back-in-stock-2'],
};

// ============================================================================
// WINBACK CAMPAIGN OPPORTUNITIES
// ============================================================================

export const winbackCampaignHighPriority = {
  id: 'opp-winback-high-1',
  ...baseOpportunity,
  type: OpportunityType.WINBACK_CAMPAIGN,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.new,
  why_now: '12 high-value customers (avg. LTV $340) have crossed 90-day inactivity threshold today. Historical data shows 90-day mark is critical inflection point.',
  rationale: 'These customers previously purchased every 45-60 days and collectively represent $4,080 in historical revenue. Personalized winback at 90 days has 28% reactivation rate vs. 9% at 120+ days.',
  impact_range: '3-4 reactivated customers, $340-$510 recovered revenue',
  counterfactual: 'Without intervention, 85% of these customers will not return. Each day of delay reduces reactivation probability by approximately 1.2%.',
  decay_at: new Date('2024-01-22T10:00:00Z'),
  confidence: 0.81,
  event_ids: ['evt-cust-inactive-1', 'evt-cust-inactive-2', 'evt-cust-inactive-3'],
};

export const winbackCampaignMediumPriority = {
  id: 'opp-winback-med-1',
  ...baseOpportunity,
  type: OpportunityType.WINBACK_CAMPAIGN,
  priority_bucket: PriorityBucket.medium,
  state: OpportunityState.approved,
  why_now: '28 customers who made 2-3 purchases have hit 60-day inactivity threshold.',
  rationale: 'These repeat customers showed engagement but have not yet formed strong purchase habits. A well-timed discount can restart their buying cycle.',
  impact_range: '5-8 reactivated customers, $250-$400 recovered revenue',
  counterfactual: 'Most of these customers will drift to 90+ days inactive, where reactivation becomes significantly harder and more expensive.',
  decay_at: new Date('2024-01-29T10:00:00Z'),
  confidence: 0.68,
  event_ids: ['evt-cust-inactive-4', 'evt-cust-inactive-5'],
};

export const winbackCampaignLowPriority = {
  id: 'opp-winback-low-1',
  ...baseOpportunity,
  type: OpportunityType.WINBACK_CAMPAIGN,
  priority_bucket: PriorityBucket.low,
  state: OpportunityState.expired,
  why_now: '45 single-purchase customers have reached 30-day inactivity.',
  rationale: 'These customers made small initial purchases (avg. $28) and may respond to a gentle nudge with a modest incentive.',
  impact_range: '7-12 second purchases, $196-$336 revenue',
  counterfactual: '70-80% of single-purchase customers never return. Even modest reactivation success builds customer base for future campaigns.',
  decay_at: new Date('2024-01-10T10:00:00Z'),
  confidence: 0.54,
  event_ids: ['evt-cust-inactive-6'],
};

// ============================================================================
// HIGH VELOCITY PROTECTION OPPORTUNITIES
// ============================================================================

export const highVelocityProtectionHighPriority = {
  id: 'opp-velocity-high-1',
  ...baseOpportunity,
  type: OpportunityType.HIGH_VELOCITY_PROTECTION,
  priority_bucket: PriorityBucket.high,
  state: OpportunityState.new,
  why_now: '"Limited Edition Print" experiencing 4.2x normal velocity spike (12 units/day vs. baseline 2.8) with 18 units remaining. Viral social media post detected.',
  rationale: 'Current inventory will deplete in 1.5 days at spike velocity vs. 6.4 days at baseline. Pausing allows you to assess whether to restock, adjust pricing, or preserve for strategic sale.',
  impact_range: 'Prevent premature stockout, enable strategic pricing decision worth $180-$360',
  counterfactual: 'Inventory depletes before you can capitalize on increased demand through higher pricing or rush reorder. Lost margin opportunity of 25-40%.',
  decay_at: new Date('2024-01-16T22:00:00Z'),
  confidence: 0.87,
  event_ids: ['evt-velocity-spike-2'],
};

export const highVelocityProtectionMediumPriority = {
  id: 'opp-velocity-med-1',
  ...baseOpportunity,
  type: OpportunityType.HIGH_VELOCITY_PROTECTION,
  priority_bucket: PriorityBucket.medium,
  state: OpportunityState.viewed,
  why_now: '"Handmade Leather Wallet" selling at 2.1x baseline velocity due to influencer mention.',
  rationale: 'This is a handmade item with limited production capacity. Current spike may exceed your ability to restock quickly.',
  impact_range: 'Preserve 8-12 units for quality control and customer satisfaction',
  counterfactual: 'Over-committing during spike may force you to rush production, potentially compromising quality and brand reputation.',
  decay_at: new Date('2024-01-17T10:00:00Z'),
  confidence: 0.73,
  event_ids: ['evt-velocity-spike-3'],
};

// ============================================================================
// OPPORTUNITIES BY STATE
// ============================================================================

export const opportunitiesByState = {
  [OpportunityState.new]: [
    inventoryClearanceHighPriority,
    restockNotificationHighPriority,
    winbackCampaignHighPriority,
    highVelocityProtectionHighPriority,
  ],
  [OpportunityState.viewed]: [
    inventoryClearanceMediumPriority,
    highVelocityProtectionMediumPriority,
  ],
  [OpportunityState.approved]: [
    stockoutPreventionHighPriority,
    winbackCampaignMediumPriority,
  ],
  [OpportunityState.executed]: [
    stockoutPreventionMediumPriority,
  ],
  [OpportunityState.resolved]: [
    restockNotificationMediumPriority,
  ],
  [OpportunityState.dismissed]: [
    inventoryClearanceLowPriority,
  ],
  [OpportunityState.expired]: [
    winbackCampaignLowPriority,
  ],
};

// ============================================================================
// OPPORTUNITIES BY PRIORITY
// ============================================================================

export const opportunitiesByPriority = {
  [PriorityBucket.high]: [
    inventoryClearanceHighPriority,
    stockoutPreventionHighPriority,
    restockNotificationHighPriority,
    winbackCampaignHighPriority,
    highVelocityProtectionHighPriority,
  ],
  [PriorityBucket.medium]: [
    inventoryClearanceMediumPriority,
    stockoutPreventionMediumPriority,
    restockNotificationMediumPriority,
    winbackCampaignMediumPriority,
    highVelocityProtectionMediumPriority,
  ],
  [PriorityBucket.low]: [
    inventoryClearanceLowPriority,
    winbackCampaignLowPriority,
  ],
};

// ============================================================================
// OPPORTUNITIES BY TYPE
// ============================================================================

export const opportunitiesByType = {
  [OpportunityType.INVENTORY_CLEARANCE]: [
    inventoryClearanceHighPriority,
    inventoryClearanceMediumPriority,
    inventoryClearanceLowPriority,
  ],
  [OpportunityType.STOCKOUT_PREVENTION]: [
    stockoutPreventionHighPriority,
    stockoutPreventionMediumPriority,
  ],
  [OpportunityType.RESTOCK_NOTIFICATION]: [
    restockNotificationHighPriority,
    restockNotificationMediumPriority,
  ],
  [OpportunityType.WINBACK_CAMPAIGN]: [
    winbackCampaignHighPriority,
    winbackCampaignMediumPriority,
    winbackCampaignLowPriority,
  ],
  [OpportunityType.HIGH_VELOCITY_PROTECTION]: [
    highVelocityProtectionHighPriority,
    highVelocityProtectionMediumPriority,
  ],
};

// ============================================================================
// ALL OPPORTUNITIES
// ============================================================================

export const allOpportunities = [
  inventoryClearanceHighPriority,
  inventoryClearanceMediumPriority,
  inventoryClearanceLowPriority,
  stockoutPreventionHighPriority,
  stockoutPreventionMediumPriority,
  restockNotificationHighPriority,
  restockNotificationMediumPriority,
  winbackCampaignHighPriority,
  winbackCampaignMediumPriority,
  winbackCampaignLowPriority,
  highVelocityProtectionHighPriority,
  highVelocityProtectionMediumPriority,
];
