/**
 * Event System - Public API
 *
 * Main exports for the event ingestion and computation system.
 */

// Types
export * from './types';

// Event creation
export {
  createEvent,
  createEventsBatch,
  eventExists,
  generateDedupeKey,
  generateSpecificDedupeKey,
} from './create';

// Event computation
export {
  computeInventoryThresholdEvents,
  computeOutOfStockEvents,
  computeBackInStockEvents,
} from './compute/inventory';

export {
  computeVelocitySpikeEvents,
  calculateProductVelocity,
} from './compute/velocity';

export {
  computeCustomerInactivityEvents,
  getCustomerInactivityData,
  getInactivitySummary,
} from './compute/customer';
