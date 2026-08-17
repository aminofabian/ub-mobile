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
