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

/**
 * Channels this client mints a ticket for and subscribes to on open. The server only fans a
 * frame out to a session that has both been granted the channel (the ticket) and sent an explicit
 * `subscribe` for it, so the two lists must agree. A caller that needs more — a till watching the
 * `grocery` channel for counter-invoice frames — passes its own list via {@link RealtimeClientOptions}.
 */
export const DEFAULT_REALTIME_CHANNELS = ['notifications', 'pos', 'storefront'] as const;

export interface RealtimeClientOptions {
  /** Which channels to request and subscribe to. Defaults to {@link DEFAULT_REALTIME_CHANNELS}. */
  channels?: readonly string[];
}

export function createRealtimeClient(
  baseURL: string,
  api?: ApiClient,
  options?: RealtimeClientOptions,
): RealtimeClient {
  const client = api ?? createApiClient({ baseURL });
  const channels = options?.channels ?? DEFAULT_REALTIME_CHANNELS;
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
      channels: [...channels],
    });
  }

  function send(frame: Record<string, unknown>) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(frame));
      } catch {
        // A socket that drops mid-send will reconnect; the subscribe replays on the next open.
      }
    }
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
        // The server fans a channel's frames out only to sessions that have asked for it. The ticket
        // granted these channels; now claim each one, or nothing but user-targeted frames arrives.
        for (const channel of channels) {
          send({ op: 'subscribe', channel });
        }
        emitConnection('open');
      };

      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data)) as {
            type?: string;
            event?: string;
            payload?: unknown;
            data?: unknown;
          };
          const type = frame.type ?? frame.event ?? 'message';
          // The heartbeat keeps the socket alive: a ping unanswered for ~40s is closed by the server.
          if (type === 'ping') {
            send({ op: 'pong' });
            return;
          }
          // Server frames carry the body in `data`; older shapes used `payload`. Fall back to the
          // whole frame so a subscriber still gets something it can read.
          emitEvent(type, frame.data ?? frame.payload ?? frame);
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
