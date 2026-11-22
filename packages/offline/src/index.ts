import { registerUnsentProbe } from '@kiosk/core';
import { summarizeOutbox } from './outbox';

export * from './outbox';
export * from './sync';
export * from './replay';
export * from './cache';
export * from './schema-version';
export { createSyncEngine } from './sync';

// Core asks this before it lets the person leave a shop: does it still hold sales that were never sent?
registerUnsentProbe((tenantId) => summarizeOutbox(tenantId));
