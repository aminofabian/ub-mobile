// src/index.ts
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
export {
  initiateStkPush,
  pollStkStatus,
  waitForStk
};
