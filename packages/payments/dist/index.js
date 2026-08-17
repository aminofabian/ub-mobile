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
  pollUntilComplete: () => pollUntilComplete
});
module.exports = __toCommonJS(index_exports);
async function initiateStkPush(api, request) {
  const response = await api.post("/api/v1/payments/mpesa/stk/push", {
    phoneNumber: request.phoneNumber,
    amount: request.amount,
    description: request.description ?? "POS payment"
  }, { idempotent: true });
  return {
    accepted: response.accepted,
    checkoutRequestId: response.checkoutRequestId,
    message: response.message,
    status: response.accepted ? "pending" : "failed"
  };
}
async function pollStkStatus(api, checkoutRequestId) {
  const response = await api.get(
    `/api/v1/payments/mpesa/stk/push/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`
  );
  let status = "pending";
  if (response.success) status = "completed";
  else if (response.failed) status = "failed";
  return {
    accepted: true,
    checkoutRequestId,
    message: response.failureReason,
    status
  };
}
async function pollUntilComplete(api, checkoutRequestId, options = {}) {
  const { intervalMs = 3e3, timeoutMs = 12e4 } = options;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await pollStkStatus(api, checkoutRequestId);
    if (status.status !== "pending") {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return {
    accepted: true,
    checkoutRequestId,
    message: "Payment timed out",
    status: "failed"
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  initiateStkPush,
  pollStkStatus,
  pollUntilComplete
});
