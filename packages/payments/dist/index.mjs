// src/index.ts
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
export {
  initiateStkPush,
  pollStkStatus,
  pollUntilComplete
};
