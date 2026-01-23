/**
 * Action Draft Test Fixtures
 *
 * Sample action drafts for each execution type in different states.
 */

import {
  ExecutionType,
  OperatorIntent,
  ActionDraftState,
  type DiscountDraftPayload,
  type WinbackEmailPayload,
  type PauseProductPayload,
} from '../../server/actions/types';

// ============================================================================
// BASE DRAFT DATA
// ============================================================================

const baseDraft = {
  workspace_id: 'workspace-test-123',
  created_at: new Date('2024-01-15T10:00:00Z'),
  updated_at: new Date('2024-01-15T10:00:00Z'),
};

// ============================================================================
// DISCOUNT DRAFT PAYLOADS
// ============================================================================

export const discountDraftPayloadPercentage: DiscountDraftPayload = {
  title: 'Winter Clearance - 25% Off Coats',
  code: 'WINTER25',
  discount_type: 'percentage',
  value: 25,
  target_type: 'collection',
  target_ids: ['collection-winter-coats'],
  usage_limit: 100,
  customer_segment: 'all_customers',
  starts_at: '2024-01-16T00:00:00Z',
  ends_at: '2024-01-31T23:59:59Z',
  minimum_purchase_amount: 50,
};

export const discountDraftPayloadFixed: DiscountDraftPayload = {
  title: '$10 Off First Purchase',
  code: 'WELCOME10',
  discount_type: 'fixed_amount',
  value: 10,
  target_type: 'entire_order',
  usage_limit: 500,
  customer_segment: 'new_customers',
  starts_at: '2024-01-16T00:00:00Z',
  ends_at: '2024-02-29T23:59:59Z',
  minimum_purchase_amount: 30,
};

export const discountDraftPayloadProduct: DiscountDraftPayload = {
  title: 'Flash Sale - Cool T-Shirts 30% Off',
  code: 'FLASH30',
  discount_type: 'percentage',
  value: 30,
  target_type: 'product',
  target_ids: ['7890123456789', '7890123456790'],
  usage_limit: 50,
  customer_segment: 'email_subscribers',
  starts_at: '2024-01-17T12:00:00Z',
  ends_at: '2024-01-17T18:00:00Z',
};

// ============================================================================
// WINBACK EMAIL PAYLOADS
// ============================================================================

export const winbackEmailPayloadHighValue: WinbackEmailPayload = {
  subject: 'We Miss You! Here\'s 20% Off Your Next Order',
  preview_text: 'Come back and enjoy exclusive savings just for you',
  body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">We Miss You!</h1>
      <p>Hi there,</p>
      <p>It's been a while since your last visit, and we wanted to reach out with something special.</p>
      <p>As one of our valued customers, we're offering you an exclusive <strong>20% discount</strong> on your next purchase.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{shop_url}}?discount={{discount_code}}" style="background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Shop Now</a>
      </div>
      <p>Use code <strong>{{discount_code}}</strong> at checkout.</p>
      <p>We can't wait to see you again!</p>
      <p>Best regards,<br>The Team</p>
    </div>
  `,
  body_text: `
We Miss You!

Hi there,

It's been a while since your last visit, and we wanted to reach out with something special.

As one of our valued customers, we're offering you an exclusive 20% discount on your next purchase.

Use code {{discount_code}} at checkout.

Shop now: {{shop_url}}?discount={{discount_code}}

We can't wait to see you again!

Best regards,
The Team
  `,
  from_name: 'Your Store',
  from_email: 'hello@yourstore.com',
  recipient_segment: 'inactive_90_days_high_value',
  include_discount_code: 'WINBACK20',
};

export const winbackEmailPayloadStandard: WinbackEmailPayload = {
  subject: 'Don\'t Forget About Us! 15% Off Inside',
  preview_text: 'Your favorite products are waiting',
  body_html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Come Back and Save!</h1>
      <p>Hello,</p>
      <p>We noticed you haven't shopped with us in a while.</p>
      <p>Here's a <strong>15% discount</strong> to welcome you back.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{shop_url}}?discount={{discount_code}}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Redeem Offer</a>
      </div>
      <p>Code: <strong>{{discount_code}}</strong></p>
      <p>Cheers,<br>Your Store Team</p>
    </div>
  `,
  body_text: `
Come Back and Save!

Hello,

We noticed you haven't shopped with us in a while.

Here's a 15% discount to welcome you back.

Code: {{discount_code}}

Shop now: {{shop_url}}?discount={{discount_code}}

Cheers,
Your Store Team
  `,
  from_name: 'Your Store',
  from_email: 'hello@yourstore.com',
  recipient_segment: 'inactive_60_days',
  include_discount_code: 'COMEBACK15',
  send_at: '2024-01-18T10:00:00Z',
};

// ============================================================================
// PAUSE PRODUCT PAYLOADS
// ============================================================================

export const pauseProductPayloadStockout: PauseProductPayload = {
  product_ids: ['1234567890123'],
  reason: 'Low inventory - preventing overselling during high-velocity spike. Will restock in 5-7 days.',
  restore_at: '2024-01-22T10:00:00Z',
  notify_customers: true,
  redirect_to_similar: true,
  similar_product_ids: ['1234567890124', '1234567890125'],
};

export const pauseProductPayloadQuality: PauseProductPayload = {
  product_ids: ['2345678901234', '2345678901235'],
  reason: 'Quality control review in progress. Expected resolution within 3 business days.',
  restore_at: '2024-01-18T17:00:00Z',
  notify_customers: false,
  redirect_to_similar: false,
};

export const pauseProductPayloadSeasonal: PauseProductPayload = {
  product_ids: ['3456789012345', '3456789012346', '3456789012347'],
  reason: 'End of season - pausing to prevent further sales before clearance pricing strategy.',
  notify_customers: false,
  redirect_to_similar: false,
};

// ============================================================================
// DISCOUNT DRAFTS
// ============================================================================

export const discountDraftNew = {
  id: 'draft-discount-new-1',
  ...baseDraft,
  opportunity_id: 'opp-inv-clearance-high-1',
  operator_intent: OperatorIntent.REDUCE_INVENTORY_RISK,
  execution_type: ExecutionType.DISCOUNT_DRAFT,
  state: ActionDraftState.DRAFT,
  payload_json: discountDraftPayloadPercentage,
  editable_fields_json: ['title', 'value', 'starts_at', 'ends_at', 'usage_limit'],
};

export const discountDraftEdited = {
  id: 'draft-discount-edited-1',
  ...baseDraft,
  opportunity_id: 'opp-inv-clearance-med-1',
  operator_intent: OperatorIntent.REDUCE_INVENTORY_RISK,
  execution_type: ExecutionType.DISCOUNT_DRAFT,
  state: ActionDraftState.EDITED,
  payload_json: discountDraftPayloadFixed,
  editable_fields_json: ['title', 'value', 'starts_at', 'ends_at', 'usage_limit'],
  updated_at: new Date('2024-01-15T11:30:00Z'),
};

export const discountDraftApproved = {
  id: 'draft-discount-approved-1',
  ...baseDraft,
  opportunity_id: 'opp-inv-clearance-low-1',
  operator_intent: OperatorIntent.REDUCE_INVENTORY_RISK,
  execution_type: ExecutionType.DISCOUNT_DRAFT,
  state: ActionDraftState.APPROVED,
  payload_json: discountDraftPayloadProduct,
  editable_fields_json: ['title', 'value', 'starts_at', 'ends_at', 'usage_limit'],
  updated_at: new Date('2024-01-15T12:00:00Z'),
};

export const discountDraftExecuted = {
  id: 'draft-discount-executed-1',
  ...baseDraft,
  opportunity_id: 'opp-restock-high-1',
  operator_intent: OperatorIntent.REDUCE_INVENTORY_RISK,
  execution_type: ExecutionType.DISCOUNT_DRAFT,
  state: ActionDraftState.EXECUTED,
  payload_json: discountDraftPayloadPercentage,
  editable_fields_json: ['title', 'value', 'starts_at', 'ends_at', 'usage_limit'],
  updated_at: new Date('2024-01-15T13:00:00Z'),
};

export const discountDraftRejected = {
  id: 'draft-discount-rejected-1',
  ...baseDraft,
  opportunity_id: 'opp-inv-clearance-high-1',
  operator_intent: OperatorIntent.REDUCE_INVENTORY_RISK,
  execution_type: ExecutionType.DISCOUNT_DRAFT,
  state: ActionDraftState.REJECTED,
  payload_json: discountDraftPayloadPercentage,
  editable_fields_json: ['title', 'value', 'starts_at', 'ends_at', 'usage_limit'],
  updated_at: new Date('2024-01-15T10:30:00Z'),
};

// ============================================================================
// WINBACK EMAIL DRAFTS
// ============================================================================

export const winbackEmailDraftNew = {
  id: 'draft-winback-new-1',
  ...baseDraft,
  opportunity_id: 'opp-winback-high-1',
  operator_intent: OperatorIntent.REENGAGE_DORMANT,
  execution_type: ExecutionType.WINBACK_EMAIL,
  state: ActionDraftState.DRAFT,
  payload_json: winbackEmailPayloadHighValue,
  editable_fields_json: ['subject', 'preview_text', 'body_html', 'body_text', 'send_at'],
};

export const winbackEmailDraftApproved = {
  id: 'draft-winback-approved-1',
  ...baseDraft,
  opportunity_id: 'opp-winback-med-1',
  operator_intent: OperatorIntent.REENGAGE_DORMANT,
  execution_type: ExecutionType.WINBACK_EMAIL,
  state: ActionDraftState.APPROVED,
  payload_json: winbackEmailPayloadStandard,
  editable_fields_json: ['subject', 'preview_text', 'body_html', 'body_text', 'send_at'],
  updated_at: new Date('2024-01-15T11:00:00Z'),
};

export const winbackEmailDraftExecuted = {
  id: 'draft-winback-executed-1',
  ...baseDraft,
  opportunity_id: 'opp-winback-low-1',
  operator_intent: OperatorIntent.REENGAGE_DORMANT,
  execution_type: ExecutionType.WINBACK_EMAIL,
  state: ActionDraftState.EXECUTED,
  payload_json: winbackEmailPayloadHighValue,
  editable_fields_json: ['subject', 'preview_text', 'body_html', 'body_text', 'send_at'],
  updated_at: new Date('2024-01-15T14:00:00Z'),
};

// ============================================================================
// PAUSE PRODUCT DRAFTS
// ============================================================================

export const pauseProductDraftNew = {
  id: 'draft-pause-new-1',
  ...baseDraft,
  opportunity_id: 'opp-stockout-high-1',
  operator_intent: OperatorIntent.PROTECT_MARGIN,
  execution_type: ExecutionType.PAUSE_PRODUCT,
  state: ActionDraftState.DRAFT,
  payload_json: pauseProductPayloadStockout,
  editable_fields_json: ['reason', 'restore_at', 'notify_customers', 'redirect_to_similar'],
};

export const pauseProductDraftApproved = {
  id: 'draft-pause-approved-1',
  ...baseDraft,
  opportunity_id: 'opp-velocity-high-1',
  operator_intent: OperatorIntent.PROTECT_MARGIN,
  execution_type: ExecutionType.PAUSE_PRODUCT,
  state: ActionDraftState.APPROVED,
  payload_json: pauseProductPayloadQuality,
  editable_fields_json: ['reason', 'restore_at', 'notify_customers', 'redirect_to_similar'],
  updated_at: new Date('2024-01-15T11:15:00Z'),
};

export const pauseProductDraftExecuted = {
  id: 'draft-pause-executed-1',
  ...baseDraft,
  opportunity_id: 'opp-stockout-med-1',
  operator_intent: OperatorIntent.PROTECT_MARGIN,
  execution_type: ExecutionType.PAUSE_PRODUCT,
  state: ActionDraftState.EXECUTED,
  payload_json: pauseProductPayloadSeasonal,
  editable_fields_json: ['reason', 'restore_at', 'notify_customers', 'redirect_to_similar'],
  updated_at: new Date('2024-01-15T15:00:00Z'),
};

// ============================================================================
// DRAFTS BY STATE
// ============================================================================

export const draftsByState = {
  [ActionDraftState.DRAFT]: [
    discountDraftNew,
    winbackEmailDraftNew,
    pauseProductDraftNew,
  ],
  [ActionDraftState.EDITED]: [
    discountDraftEdited,
  ],
  [ActionDraftState.APPROVED]: [
    discountDraftApproved,
    winbackEmailDraftApproved,
    pauseProductDraftApproved,
  ],
  [ActionDraftState.REJECTED]: [
    discountDraftRejected,
  ],
  [ActionDraftState.EXECUTED]: [
    discountDraftExecuted,
    winbackEmailDraftExecuted,
    pauseProductDraftExecuted,
  ],
  [ActionDraftState.FAILED]: [],
};

// ============================================================================
// DRAFTS BY TYPE
// ============================================================================

export const draftsByType = {
  [ExecutionType.DISCOUNT_DRAFT]: [
    discountDraftNew,
    discountDraftEdited,
    discountDraftApproved,
    discountDraftExecuted,
    discountDraftRejected,
  ],
  [ExecutionType.WINBACK_EMAIL]: [
    winbackEmailDraftNew,
    winbackEmailDraftApproved,
    winbackEmailDraftExecuted,
  ],
  [ExecutionType.PAUSE_PRODUCT]: [
    pauseProductDraftNew,
    pauseProductDraftApproved,
    pauseProductDraftExecuted,
  ],
};

// ============================================================================
// ALL DRAFTS
// ============================================================================

export const allDrafts = [
  discountDraftNew,
  discountDraftEdited,
  discountDraftApproved,
  discountDraftExecuted,
  discountDraftRejected,
  winbackEmailDraftNew,
  winbackEmailDraftApproved,
  winbackEmailDraftExecuted,
  pauseProductDraftNew,
  pauseProductDraftApproved,
  pauseProductDraftExecuted,
];
