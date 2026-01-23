/**
 * MerchOps Shared Types
 *
 * Centralized type definitions for the entire MerchOps application.
 * All types are strictly typed with comprehensive JSDoc documentation.
 */

// Workspace types
export type {
  Workspace,
  WorkspaceWithUser,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
} from './workspace';

// User types
export type {
  User,
  UserSession,
  CreateUserInput,
  UpdateUserInput,
  PublicUserProfile,
} from './user';

// Shopify types
export type {
  ShopifyConnection,
  ShopifyConnectionStatus,
  ShopifyWebhookTopic,
  ShopifyWebhookBase,
  ShopifyOrderWebhook,
  ShopifyProductWebhook,
  ShopifyInventoryWebhook,
  ShopifyCustomerWebhook,
  ShopifyAppUninstalledWebhook,
  ShopifyWebhookPayload,
  ShopifyWebhookRequest,
  ShopifyApiResponse,
  ShopifyOAuthInit,
  ShopifyOAuthCallback,
  ShopifyAccessTokenResponse,
} from './shopify';

// Event types
export {
  EventType,
  EventSource,
} from './event';

export type {
  Event,
  EventPayload,
  InventoryThresholdCrossedPayload,
  ProductOutOfStockPayload,
  ProductBackInStockPayload,
  VelocitySpikePayload,
  CustomerInactivityThresholdPayload,
  OrderCreatedPayload,
  OrderPaidPayload,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  CreateEventInput,
  EventQueryFilters,
  EventWithOpportunities,
} from './event';

// Opportunity types
export {
  OpportunityType,
  PriorityBucket,
  OpportunityState,
} from './opportunity';

export type {
  Opportunity,
  ImpactRange,
  ConfidenceScore,
  OpportunityWithEvents,
  OpportunityWithDrafts,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  OpportunityQueryFilters,
  OpportunitySummary,
} from './opportunity';

// Action types
export {
  OperatorIntent,
  ExecutionType,
  ActionDraftState,
} from './action';

export type {
  ActionDraft,
  DiscountDraftPayload,
  WinbackEmailDraftPayload,
  ProductStatusPayload,
  DraftPayload,
  EditableFields,
  CreateActionDraftInput,
  UpdateActionDraftInput,
  ApproveActionDraftInput,
  ActionDraftWithOpportunity,
  ActionDraftQueryFilters,
} from './action';

// Execution types
export {
  ExecutionStatus,
  ExecutionErrorCode,
} from './execution';

export type {
  Execution,
  RetryConfig,
  ProviderResponse,
  ExecutionWithDraft,
  ExecutionWithOpportunity,
  CreateExecutionInput,
  UpdateExecutionInput,
  ExecutionQueryFilters,
  ExecutionStats,
  ExecutionTimelineEvent,
} from './execution';

// Outcome types
export {
  OutcomeType,
  EvidenceType,
} from './outcome';

export type {
  Outcome,
  MetricComparison,
  OutcomeEvidence,
  OutcomeWithExecution,
  OutcomeWithAction,
  CreateOutcomeInput,
  OverrideOutcomeInput,
  OutcomeQueryFilters,
  OutcomeStatsByIntent,
  IntentConfidenceUpdate,
} from './outcome';

// API types
export {
  ApiErrorCode,
} from './api';

export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  CursorPaginatedResponse,
  CursorPaginationParams,
  ValidationError,
  BatchOperationResponse,
  HealthCheckResponse,
  WebhookDeliveryStatus,
  RateLimitInfo,
  ExportJobStatus,
} from './api';
