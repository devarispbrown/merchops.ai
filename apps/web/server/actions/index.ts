/**
 * MerchOps Actions - Central Export
 * Single entry point for all action system functionality
 */

// Types
export * from "./types";

// Draft Management
export { createDraftForOpportunity } from "./drafts/create";
export { updateDraft, getDraftForEdit } from "./drafts/edit";
export { approveDraft, rejectDraft } from "./drafts/approve";

// Execution Engine
export { executeAction, getExecutionStatus, listExecutions } from "./execution-engine";

// Rollback System
export {
  rollbackExecution,
  getRollbackHistory,
  rollbackMultipleExecutions,
} from "./rollback";

// Executors (for direct use if needed)
export { executeDiscount, rollbackDiscount } from "./execute/discount";
export { executePauseProduct, rollbackPauseProduct } from "./execute/pause-product";
export { executeEmail, rollbackEmail } from "./execute/email";
