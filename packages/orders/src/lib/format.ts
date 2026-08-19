export function toNum(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** "KES 1,250.50" — manual grouping so it works on any Hermes build. */
export function formatMoney(amount: number): string {
  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, cents] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}KES ${grouped}.${cents}`;
}

export function formatQty(value: number | string | null | undefined): string {
  const n = toNum(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
