function randomHex(byteCount: number): string {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  let result = '';
  for (let i = 0; i < byteCount; i++) {
    result += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return result;
}

export function generateIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${randomHex(8)}`;
}

export interface IdempotencyOptions {
  /** Send an Idempotency-Key, minting a fresh one unless `idempotencyKey` is given. */
  idempotent?: boolean;
  /**
   * Send exactly this key. Use it whenever the same operation can be sent more than once
   * (a queued sale, a retry): the server recognises the key and returns the first result
   * instead of doing the work again. Implies `idempotent`.
   */
  idempotencyKey?: string;
}

/** The key a request should carry, or undefined when it is not an idempotent request. */
export function resolveIdempotencyKey(options: IdempotencyOptions = {}): string | undefined {
  if (options.idempotencyKey) return options.idempotencyKey;
  return options.idempotent ? generateIdempotencyKey() : undefined;
}
