import type { KplcMonthSpend, KplcStats, KplcToken } from '../api/services';
import { moneyFromUnknown } from './media';

function monthKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  if (!year || !month) return null;
  return `${year}-${month}`;
}

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 15, 12));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function statsFromTokens(tokens: KplcToken[]): KplcStats {
  const buckets = new Map<string, KplcMonthSpend>();
  let allTimeAmount = 0;
  let allTimeCount = 0;
  for (const token of tokens) {
    if (!token.purchasedAt) continue;
    const key = monthKey(token.purchasedAt);
    if (!key) continue;
    const amount = moneyFromUnknown(token.amount);
    const units = moneyFromUnknown(token.units);
    const current = buckets.get(key) ?? {
      yearMonth: key,
      label: monthLabel(key),
      amount: 0,
      units: 0,
      tokenCount: 0,
    };
    buckets.set(key, {
      ...current,
      amount: moneyFromUnknown(current.amount) + amount,
      units: moneyFromUnknown(current.units) + units,
      tokenCount: current.tokenCount + 1,
    });
    allTimeAmount += amount;
    allTimeCount += 1;
  }
  const months = [...buckets.values()].sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1));
  const nowKey = monthKey(new Date().toISOString());
  const thisMonth = months.find((m) => m.yearMonth === nowKey);
  return {
    thisMonthAmount: thisMonth ? moneyFromUnknown(thisMonth.amount) : 0,
    thisMonthUnits: thisMonth ? moneyFromUnknown(thisMonth.units) : 0,
    thisMonthCount: thisMonth?.tokenCount ?? 0,
    allTimeAmount,
    allTimeCount,
    months,
  };
}

export function resolveKplcStats(tokens: KplcToken[], api?: KplcStats | null): KplcStats | null {
  if (api && ((api.months?.length ?? 0) > 0 || Number(api.allTimeCount) > 0)) {
    return api;
  }
  if (tokens.length === 0) return null;
  return statsFromTokens(tokens);
}

export function formatRelativeTokenTime(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date unknown';
  const diffMs = nowMs - date.getTime();
  if (diffMs < 45_000) return 'Just now';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.round(diffMs / 86_400_000);
  if (days < 45) return days === 1 ? '1 day ago' : `${days} days ago`;
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTokenNo(raw: string): string {
  const digits = raw.replace(/\s/g, '');
  if (digits.length < 8) return raw;
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatMeterDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return raw;
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export {
  estimateKplcFromHint,
  estimateKplcLive,
  estimateRemainingUnits,
  formatKplcClock,
  formatKplcTimeLeft,
  kplcEstimateCopy,
  resolveKplcEmptyAt,
  resolveKplcEstimate,
  type KplcLiveEstimate,
} from './kplc-estimate';
