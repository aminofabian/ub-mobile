import { UnsentSummary, ApiClient } from '@kiosk/core';

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
    /** The shop this request belongs to. Set when it is queued; sales queued before shops were kept apart get it when they are carried over. */
    tenantId?: string;
    /** A line of words about what this is (what was in a sale), for the person who has to find it again. Never sent to the server. */
    label?: string;
    /**
     * What the app knows about this request that the server is never told (who rang a sale, how its M-Pesa payment was
     * confirmed, how old its prices were). Plain values only; what they mean is the app's business, not the queue's.
     */
    facts?: Record<string, string | number | boolean>;
}
interface Outbox {
    enqueue(item: Omit<OutboxItem, 'retries' | 'createdAt'>): Promise<void>;
    pending(): Promise<OutboxItem[]>;
    remove(id: string): Promise<void>;
    markRetry(id: string, error?: string): Promise<void>;
    update(id: string, patch: Partial<OutboxItem>): Promise<void>;
}
interface OutboxChange {
    tenantId: string;
}
/** After this many failed attempts, or a conflict, a sale stops being "waiting" and needs a person. The Conflicts screen lists these. */
declare const ATTENTION_AFTER_RETRIES = 3;
/** The most of a server's answer kept with a queued request: enough to say what went wrong, too little to carry a web page. */
declare const STORED_ERROR_LIMIT = 300;
/**
 * What is kept of a server's answer about a queued request. The queue is one list that is written again whole on every
 * change, and it holds the sales not yet sent, so an answer is never kept at the size a proxy or a login page might send
 * it: a page is not kept at all, only that one came.
 */
declare function storedError(text: string | undefined): string | undefined;
declare function needsAttention(item: OutboxItem): boolean;
/** How long a request counts as being sent right now. Past this the sync engine may send it as well. */
declare const SENDING_LEASE_MS = 60000;
/**
 * Says that a queued request is being sent right now, by the screen that made it. The sync engine leaves it alone until
 * the returned release is called or the lease runs out: a timer tick must not send a sale a second time while the first
 * request is still on its way, because the second one may be the one the server turns down as a duplicate.
 */
declare function holdWhileSending(id: string, now?: () => number): () => void;
/** Whether a request is being sent right now (see `holdWhileSending`). */
declare function isBeingSent(id: string, now?: () => number): boolean;
/** Called after any change to any shop's queue. Returns the unsubscribe. */
declare function subscribeOutbox(listener: (change: OutboxChange) => void): () => void;
/** One shop's queue, whichever shop is active. What a sync engine for that shop uses. */
declare function outboxFor(tenantId: string): Outbox;
/** The active shop's queue. It follows the active shop: each call is for whichever shop is active at that moment. */
declare const outbox: Outbox;
/** How many sales a shop has not sent, and how many of those need a person. Defaults to the active shop. */
declare function summarizeOutbox(tenantId?: string): Promise<UnsentSummary>;
/** Lets every sale that stopped sending by itself try again. Returns how many. */
declare function retryStuck(tenantId?: string): Promise<number>;
/** The most of a server's answer kept with a sale in an export: enough to say what went wrong, too little to carry a web page. */
declare const EXPORT_ERROR_LIMIT = 300;
/** The most of a damaged queue kept in an export. The rest is still on the phone, only not in the copy. */
declare const EXPORT_UNREADABLE_LIMIT = 20000;
/** The start of `text`, cut by characters (never through an emoji), with a note of how much was left out. */
declare function clipText(text: string, limit: number): string;
/**
 * A shop's queue as text, for a person to keep or send to support when a sale will not go through. What a server
 * said about each sale, and what could not be read, are cut to a size a message can carry: the copy goes to a share
 * sheet, and anywhere on it.
 */
declare function exportOutbox(tenantId?: string): Promise<string>;

interface SyncEngineOptions {
    api: ApiClient;
    /**
     * Send for this shop only. Without it the engine sends for whichever shop is active each time it
     * runs, and only that shop's queue is touched.
     */
    tenantId?: string;
    intervalMs?: number;
    maxRetries?: number;
    onConflict?: (item: OutboxItem) => void;
    /** A queued request was taken by the server. `response` is what the server answered. */
    onSynced?: (item: OutboxItem, response?: unknown) => void;
    /** A sale has failed `maxRetries` times and will not be tried again by itself. Called once, when it gets there. */
    onNeedsAttention?: (item: OutboxItem) => void;
}
interface SyncEngine {
    start(): void;
    stop(): void;
    sync(): Promise<void>;
}
declare function createSyncEngine(options: SyncEngineOptions): SyncEngine;
declare const syncEngine: SyncEngine;

/**
 * Sends a queued request again, under the Idempotency-Key it was queued with.
 *
 * The stored key is the point of this function. If the first attempt reached the server but
 * its response was lost, the server already holds the result under that key and returns it
 * instead of recording the operation a second time. A fresh key per replay would defeat that.
 */
declare function replayItem(api: ApiClient, item: OutboxItem): Promise<unknown>;

/**
 * What it means for a queued request that sending it again failed.
 *
 *  - `wait`: nothing is wrong with the request. There was no answer (no connection, a timeout), or the server cannot
 *    take it just now (408, 429, a switched-off shop 423, a session that ended 401, a gateway with nothing behind it
 *    502, 503, 504 or Cloudflare's 520 to 524, which is what a deploy looks like from outside). It is tried again later
 *    and does not use up an attempt: a phone that was offline for an hour has not "failed" five times.
 *  - `setup`: the server needs a step done first (a shift opened, a till approved, a branch assigned). It waits for
 *    that, without using up an attempt.
 *  - `broken`: the server failed (another 5xx), or something in the way answered in its place (a 4xx that is a web
 *    page or nothing, from a firewall, a proxy or a login page), or it could not store the write and said nothing more
 *    (a 400 of type `data-integrity`: what the loser of two requests under one Idempotency-Key is told while the
 *    winner is recorded). Counts as an attempt, so a sale that crashes the server, or a block that does not lift, ends
 *    up in front of a person, and a blip does not. The next try under the same key is answered with the sale the
 *    winner recorded.
 *  - `conflict`: 409. The sale is flagged for a person.
 *  - `refused`: any other 4xx the app itself wrote. The server understood and said no, and asking again cannot change
 *    that, so the sale is flagged for a person at once and is not sent again by itself.
 *
 * It reads the status, never the words: a server's message is whatever it says, and a product called "Conflict" must
 * not turn a failure into one.
 */
type ReplayFailure = 'wait' | 'setup' | 'broken' | 'conflict' | 'refused';
/** The `conflictType` of a sale the server refused. */
declare const REFUSED = "refused";
declare function classifyReplayFailure(error: unknown): ReplayFailure;

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

export { ATTENTION_AFTER_RETRIES, type Cache, EXPORT_ERROR_LIMIT, EXPORT_UNREADABLE_LIMIT, type MobileSchemaVersion, type Outbox, type OutboxChange, type OutboxItem, REFUSED, type ReplayFailure, SENDING_LEASE_MS, STORED_ERROR_LIMIT, type SyncEngine, type SyncEngineOptions, cache, checkMobileSchemaVersion, classifyReplayFailure, clipText, createSyncEngine, exportOutbox, getLocalSchemaVersion, holdWhileSending, isBeingSent, needsAttention, outbox, outboxFor, replayItem, retryStuck, setLocalSchemaVersion, storedError, subscribeOutbox, summarizeOutbox, syncEngine };
