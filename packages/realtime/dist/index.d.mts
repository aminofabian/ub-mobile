import { ApiClient } from '@kiosk/core';

type ConnectionState = 'connecting' | 'open' | 'closed';
interface RealtimeEvent {
    type: string;
    payload: unknown;
}
interface RealtimeClient {
    connect(): Promise<void>;
    disconnect(): void;
    subscribe(event: string, handler: (payload: unknown) => void): () => void;
    onConnectionChange(handler: (state: ConnectionState) => void): () => void;
}
/**
 * Build a WebSocket URL from the HTTP API base the app already uses.
 * Ticket `wsUrl` is often an absolute `ws://localhost:…` from the Java API;
 * concatenating that onto the LAN base produced `…:5050ws:` (invalid port).
 */
declare function buildRealtimeSocketUrl(httpBase: string, ticketWsUrl: string | undefined, ticket: string): string;
/**
 * Channels this client mints a ticket for and subscribes to on open. The server only fans a
 * frame out to a session that has both been granted the channel (the ticket) and sent an explicit
 * `subscribe` for it, so the two lists must agree. A caller that needs more — a till watching the
 * `grocery` channel for counter-invoice frames — passes its own list via {@link RealtimeClientOptions}.
 */
declare const DEFAULT_REALTIME_CHANNELS: readonly ["notifications", "pos", "storefront"];
interface RealtimeClientOptions {
    /** Which channels to request and subscribe to. Defaults to {@link DEFAULT_REALTIME_CHANNELS}. */
    channels?: readonly string[];
}
declare function createRealtimeClient(baseURL: string, api?: ApiClient, options?: RealtimeClientOptions): RealtimeClient;

export { type ConnectionState, DEFAULT_REALTIME_CHANNELS, type RealtimeClient, type RealtimeClientOptions, type RealtimeEvent, buildRealtimeSocketUrl, createRealtimeClient };
