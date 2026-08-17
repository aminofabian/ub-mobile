import { ApiClient } from '@kiosk/core';

interface OutboxItem {
    id: string;
    method: string;
    path: string;
    body: unknown;
    idempotencyKey: string;
    retries: number;
    createdAt: string;
    lastError?: string;
    conflictType?: string;
}
interface Outbox {
    enqueue(item: Omit<OutboxItem, 'retries' | 'createdAt'>): Promise<void>;
    pending(): Promise<OutboxItem[]>;
    remove(id: string): Promise<void>;
    markRetry(id: string, error?: string): Promise<void>;
    update(id: string, patch: Partial<OutboxItem>): Promise<void>;
}
declare const outbox: Outbox;

interface SyncEngineOptions {
    api: ApiClient;
    intervalMs?: number;
    maxRetries?: number;
    onConflict?: (item: OutboxItem) => void;
    onSynced?: (item: OutboxItem) => void;
}
interface SyncEngine {
    start(): void;
    stop(): void;
    sync(): Promise<void>;
}
declare function createSyncEngine(options: SyncEngineOptions): SyncEngine;
declare const syncEngine: SyncEngine;

interface Cache {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T): Promise<void>;
    remove(key: string): Promise<void>;
    clear(): Promise<void>;
}
declare const cache: Cache;
declare function getLocalSchemaVersion(): Promise<number>;
declare function setLocalSchemaVersion(version: number): Promise<void>;

interface MobileSchemaVersion {
    schemaVersion: number;
    minAppVersion: string;
    breakingChangeAt?: string;
}
declare function checkMobileSchemaVersion(baseURL: string): Promise<MobileSchemaVersion | null>;

export { type Cache, type MobileSchemaVersion, type Outbox, type OutboxItem, type SyncEngine, type SyncEngineOptions, cache, checkMobileSchemaVersion, createSyncEngine, getLocalSchemaVersion, outbox, setLocalSchemaVersion, syncEngine };
