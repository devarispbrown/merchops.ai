/**
 * API Client Verification Script
 * Run this to verify all API endpoints are properly typed and accessible
 */

import { OperatorIntent, ExecutionType } from '@prisma/client';

import {
  getConfidenceScores,
} from './confidence';
import {
  listDrafts,
  getDraft,
  createDraft,
  updateDraft,
  approveDraft,
} from './drafts';
import {
  listExecutions,
  getExecution,
} from './executions';
import {
  listOpportunities,
  getOpportunity,
  dismissOpportunity,
  viewOpportunity,
} from './opportunities';
import {
  listOutcomes,
  getOutcome,
} from './outcomes';
import {
  getConnectionStatus,
  initiateConnection,
  disconnect,
} from './shopify';
import type {
  OpportunityListParams,
  DraftListParams,
  ExecutionListParams,
  CreateDraftRequest,
  UpdateDraftRequest,
  ApproveDraftRequest,
  InitiateConnectionRequest,
} from './types';

/**
 * Verification test suite
 * This is NOT meant to be run - it's a compile-time check
 * If this file compiles, all API functions are properly typed
 */
export async function verifyApiClient() {
  // Opportunities
  const opportunitiesParams: OpportunityListParams = {
    filters: { state: ['new'], priority_bucket: ['high'] },
    page: 1,
    limit: 20
  };
  const _opportunities = await listOpportunities(opportunitiesParams);
  const _opportunity = await getOpportunity('opp_123');
  await dismissOpportunity('opp_123');
  await viewOpportunity('opp_123');

  // Drafts
  const draftsParams: DraftListParams = {
    filters: { state: ['draft'] },
    page: 1
  };
  const _drafts = await listDrafts(draftsParams);
  const _draft = await getDraft('draft_123');

  const createDraftRequest: CreateDraftRequest = {
    opportunityId: 'opp_123',
    operatorIntent: OperatorIntent.reduce_inventory_risk,
    executionType: ExecutionType.discount_draft,
  };
  const _newDraft = await createDraft(createDraftRequest);

  const updateDraftRequest: UpdateDraftRequest = {
    updates: { title: 'Updated' }
  };
  const _updatedDraft = await updateDraft('draft_123', updateDraftRequest);

  const approveDraftRequest: ApproveDraftRequest = {
    confirmation: true
  };
  const _approvedDraft = await approveDraft('draft_123', approveDraftRequest);

  // Executions
  const executionsParams: ExecutionListParams = {
    filters: { status: ['succeeded'] }
  };
  const _executions = await listExecutions(executionsParams);
  const _execution = await getExecution('exec_123');

  // Outcomes
  const _outcomes = await listOutcomes();
  const _outcome = await getOutcome('exec_123');

  // Shopify
  const _connection = await getConnectionStatus();
  const connectionRequest: InitiateConnectionRequest = {
    shop: 'mystore.myshopify.com'
  };
  const _connectionResponse = await initiateConnection(connectionRequest);
  await disconnect();

  // Confidence
  const _confidence = await getConfidenceScores();

  // Type assertions to verify return types
  const _opportunitiesCheck: typeof _opportunities = {
    data: [],
    pagination: { page: 1, limit: 20, total: 0, hasMore: false }
  };

  const _opportunityCheck: typeof _opportunity = {
    id: '',
    workspace_id: '',
    type: '',
    priority_bucket: 'high',
    why_now: '',
    rationale: '',
    impact_range: '',
    counterfactual: '',
    decay_at: null,
    confidence: 0,
    state: 'new',
    created_at: '',
    updated_at: '',
    event_ids: [],
    draft_count: 0,
    events: [],
    drafts: []
  };

  // Type checking verification complete
  // console.log('API Client verification passed!');
}

// Export verification function
export default verifyApiClient;
