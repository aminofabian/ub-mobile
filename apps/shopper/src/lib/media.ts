/** Category `icon` may be an emoji/key or an HTTPS tile image (Cloudinary). */
export function categoryIconImageUrl(icon: string | null | undefined): string | null {
  const trimmed = icon?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function formatMoney(currency: string, amount: number): string {
  const code = currency.trim() || 'KES';
  const prefix = code === 'KES' ? 'KSh' : code;
  return `${prefix} ${amount.toFixed(2)}`;
}

export function itemCountLabel(count: number | null | undefined): string {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : 0;
  return `${n} ${n === 1 ? 'item' : 'items'}`;
}
