/** Category `icon` may be an emoji/key or an HTTPS tile image (Cloudinary). */
export function categoryIconImageUrl(icon: string | null | undefined): string | null {
  const trimmed = icon?.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export function formatMoney(currency: string, amount: number): string {
  const code = currency.trim() || 'KES';
  const prefix = code === 'KES' ? 'KSh' : code;
  const body = amount.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${prefix} ${body}`;
}

export function moneyFromUnknown(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function itemCountLabel(count: number | null | undefined): string {
  const n = typeof count === 'number' && Number.isFinite(count) ? count : 0;
  return `${n} ${n === 1 ? 'item' : 'items'}`;
}
