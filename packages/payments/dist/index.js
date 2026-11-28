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
  initiateStkPush: () => initiateStkPush,
  pollStkStatus: () => pollStkStatus,
  waitForStk: () => waitForStk
});
module.exports = __toCommonJS(index_exports);
async function initiateStkPush(api, request) {
  const response = await api.post(
    "/api/v1/payments/mpesa/stk/push",
    {
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      description: request.description ?? "POS payment"
    },
    request.idempotencyKey ? { idempotent: true, idempotencyKey: request.idempotencyKey } : { idempotent: true }
  );
  return {
    accepted: response.accepted,
    checkoutRequestId: response.checkoutRequestId,
    message: response.message,
    status: response.accepted ? "pending" : "failed"
  };
}
function readStatus(response) {
  if (response.success) {
    const code = typeof response.gatewayTransactionId === "string" ? response.gatewayTransactionId.trim() : "";
    return {
      status: "completed",
      ...code ? { receiptCode: code } : {},
      ...typeof response.amount === "number" && Number.isFinite(response.amount) ? { amount: response.amount } : {}
    };
  }
  return { status: response.failed ? "failed" : "pending" };
}
async function pollStkStatus(api, checkoutRequestId) {
  const response = await api.get(
    `/api/v1/payments/mpesa/stk/push/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`
  );
  return {
    accepted: true,
    checkoutRequestId,
    message: response.failureReason,
    ...readStatus(response)
  };
}
function sleepFor(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done);
  });
}
function checkWithin(run, ms, signal) {
  return new Promise((resolve, reject) => {
    let over = false;
    const finish = (settle) => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      settle();
    };
    const onAbort = () => finish(() => reject(new Error("The wait was stopped.")));
    const timer = setTimeout(() => finish(() => reject(new Error("The check took too long."))), ms);
    signal?.addEventListener("abort", onAbort);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    run().then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
}
async function waitForStk(api, checkoutRequestId, options = {}) {
  const { intervalMs = 3e3, timeoutMs = 9e4, pollTimeoutMs = 1e4, signal, sleep = sleepFor, now = Date.now } = options;
  const started = now();
  let answered = false;
  while (!signal?.aborted) {
    try {
      const status = await checkWithin(() => pollStkStatus(api, checkoutRequestId), pollTimeoutMs, signal);
      answered = true;
      if (status.status === "completed") {
        return {
          kind: "paid",
          checkoutRequestId,
          receiptCode: status.receiptCode ?? null,
          amount: status.amount ?? null
        };
      }
      if (status.status === "failed") {
        return { kind: "failed", checkoutRequestId, ...status.message ? { reason: status.message } : {} };
      }
    } catch {
    }
    if (signal?.aborted) break;
    if (now() - started + intervalMs >= timeoutMs) {
      return { kind: "unknown", checkoutRequestId, reason: answered ? "timeout" : "no_connection" };
    }
    await sleep(intervalMs, signal);
  }
  return { kind: "unknown", checkoutRequestId, reason: "cancelled" };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initiateStkPush,
  pollStkStatus,
  waitForStk
});
