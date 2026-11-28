"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  DEFAULT_REALTIME_CHANNELS: () => DEFAULT_REALTIME_CHANNELS,
  buildRealtimeSocketUrl: () => buildRealtimeSocketUrl,
  createRealtimeClient: () => createRealtimeClient
});
module.exports = __toCommonJS(index_exports);
var import_core = require("@kiosk/core");
var DEFAULT_WS_PATH = "/api/v1/realtime";
function httpBaseToWsOrigin(httpBase) {
  return httpBase.trim().replace(/\/+$/, "").replace(/^http/i, "ws");
}
function websocketPathFromTicket(ticketWsUrl) {
  const raw = ticketWsUrl?.trim() ?? "";
  if (!raw) return DEFAULT_WS_PATH;
  if (raw.startsWith("/")) {
    return raw.split("?")[0] || DEFAULT_WS_PATH;
  }
  try {
    const abs = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? new URL(raw) : new URL(raw, "http://localhost");
    return abs.pathname || DEFAULT_WS_PATH;
  } catch {
    return DEFAULT_WS_PATH;
  }
}
function buildRealtimeSocketUrl(httpBase, ticketWsUrl, ticket) {
  const origin = httpBaseToWsOrigin(httpBase);
  const path = websocketPathFromTicket(ticketWsUrl);
  const pathPart = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${pathPart}?ticket=${encodeURIComponent(ticket)}`;
}
var DEFAULT_REALTIME_CHANNELS = ["notifications", "pos", "storefront"];
function createRealtimeClient(baseURL, api, options) {
  const client = api ?? (0, import_core.createApiClient)({ baseURL });
  const channels = options?.channels ?? DEFAULT_REALTIME_CHANNELS;
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempt = 0;
  let stopped = false;
  const subscribers = /* @__PURE__ */ new Map();
  const connectionHandlers = /* @__PURE__ */ new Set();
  function emitConnection(state) {
    connectionHandlers.forEach((h) => h(state));
  }
  function emitEvent(type, payload) {
    subscribers.get(type)?.forEach((h) => h(payload));
    subscribers.get("*")?.forEach((h) => h({ type, payload }));
  }
  async function mintTicket() {
    return client.post("/api/v1/realtime/tickets", {
      channels: [...channels]
    });
  }
  function send(frame) {
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify(frame));
      } catch {
      }
    }
  }
  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    const delay = Math.min(3e4, 1e3 * 2 ** reconnectAttempt + Math.random() * 1e3);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectAttempt += 1;
      void connectInternal();
    }, delay);
  }
  async function connectInternal() {
    emitConnection("connecting");
    try {
      const ticket = await mintTicket();
      const url = buildRealtimeSocketUrl(baseURL, ticket.wsUrl, ticket.ticket);
      ws?.close();
      ws = new WebSocket(url);
      ws.onopen = () => {
        reconnectAttempt = 0;
        for (const channel of channels) {
          send({ op: "subscribe", channel });
        }
        emitConnection("open");
      };
      ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(String(event.data));
          const type = frame.type ?? frame.event ?? "message";
          if (type === "ping") {
            send({ op: "pong" });
            return;
          }
          emitEvent(type, frame.data ?? frame.payload ?? frame);
        } catch {
          emitEvent("message", event.data);
        }
      };
      ws.onclose = () => {
        emitConnection("closed");
        if (!stopped) scheduleReconnect();
      };
      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      emitConnection("closed");
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
      emitConnection("closed");
    },
    subscribe(event, handler) {
      if (!subscribers.has(event)) {
        subscribers.set(event, /* @__PURE__ */ new Set());
      }
      subscribers.get(event).add(handler);
      return () => subscribers.get(event)?.delete(handler);
    },
    onConnectionChange(handler) {
      connectionHandlers.add(handler);
      return () => connectionHandlers.delete(handler);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_REALTIME_CHANNELS,
  buildRealtimeSocketUrl,
  createRealtimeClient
});
