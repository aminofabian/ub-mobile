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
declare function createRealtimeClient(baseURL: string, api?: ApiClient): RealtimeClient;

export { type ConnectionState, type RealtimeClient, type RealtimeEvent, buildRealtimeSocketUrl, createRealtimeClient };
