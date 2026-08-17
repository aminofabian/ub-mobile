import { createApiClient, type ApiClient } from '@kiosk/core';

export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface RealtimeEvent {
  type: string;
  payload: unknown;
}

export interface RealtimeClient {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(event: string, handler: (payload: unknown) => void): () => void;
  onConnectionChange(handler: (state: ConnectionState) => void): () => void;
}

interface TicketResponse {
  ticket: string;
  expiresAt: number;
  wsUrl: string;
}

const DEFAULT_WS_PATH = '/api/v1/realtime';

function httpBaseToWsOrigin(httpBase: string): string {
  return httpBase.trim().replace(/\/+$/, '').replace(/^http/i, 'ws');
}

function websocketPathFromTicket(ticketWsUrl: string | undefined): string {
  const raw = ticketWsUrl?.trim() ?? '';
  if (!raw) return DEFAULT_WS_PATH;
  if (raw.startsWith('/')) {
    return raw.split('?')[0] || DEFAULT_WS_PATH;
  }
  try {
    const abs = /^[a-z][a-z0-9+.-]*:/i.test(raw)
      ? new URL(raw)
      : new URL(raw, 'http://localhost');
    return abs.pathname || DEFAULT_WS_PATH;
  } catch {
    return DEFAULT_WS_PATH;
  }
}

/**
 * Build a WebSocket URL from the HTTP API base the app already uses.
 * Ticket `wsUrl` is often an absolute `ws://localhost:…` from the Java API;
 * concatenating that onto the LAN base produced `…:5050ws:` (invalid port).
 */
export function buildRealtimeSocketUrl(
  httpBase: string,
  ticketWsUrl: string | undefined,
  ticket: string,
): string {
  const origin = httpBaseToWsOrigin(httpBase);
  const path = websocketPathFromTicket(ticketWsUrl);
  const pathPart = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${pathPart}?ticket=${encodeURIComponent(ticket)}`;
}

export function createRealtimeClient(baseURL: string, api?: ApiClient): RealtimeClient {
  const client = api ?? createApiClient({ baseURL });
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let stopped = false;

  const subscribers = new Map<string, Set<(payload: unknown) => void>>();
  const connectionHandlers = new Set<(state: ConnectionState) => void>();

  function emitConnection(state: ConnectionState) {
    connectionHandlers.forEach((h) => h(state));
  }

  function emitEvent(type: string, payload: unknown) {
    subscribers.get(type)?.forEach((h) => h(payload));
    subscribers.get('*')?.forEach((h) => h({ type, payload }));
  }

  async function mintTicket(): Promise<TicketResponse> {
    return client.post<TicketResponse>('/api/v1/realtime/tickets', {
      channels: ['notifications', 'pos', 'storefront'],
    });
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt + Math.random() * 1000);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempt += 1;
      void connectInternal();
    }, delay);
  }

  async function connectInternal() {
    emitConnection('connecting');
    try {
      const ticket = await mintTicket();
      const url = buildRealtimeSocketUrl(baseURL, ticket.wsUrl, ticket.ticket);
      ws?.close();
      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectAttempt = 0;
        emitConnection('open');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as { type?: string; event?: string; payload?: unknown };
          const type = data.type ?? data.event ?? 'message';
          emitEvent(type, data.payload ?? data);
        } catch {
          emitEvent('message', event.data);
        }
      };

      ws.onclose = () => {
        emitConnection('closed');
        if (!stopped) scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      emitConnection('closed');
      scheduleReconnect();
    }
  }

  return {
    async connect() {
      stopped = false;
      await connectInternal();
    },
    disconnect() {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws?.close();
      ws = null;
      emitConnection('closed');
    },
    subscribe(event, handler) {
      if (!subscribers.has(event)) {
        subscribers.set(event, new Set());
      }
      subscribers.get(event)!.add(handler);
      return () => subscribers.get(event)?.delete(handler);
    },
    onConnectionChange(handler) {
      connectionHandlers.add(handler);
      return () => connectionHandlers.delete(handler);
    },
  };
}
