/** Kenyan mobile helpers — same rules as the website customer tab. */

export function kenyanMobileDigits(raw: string): string {
  return raw.trim().replace(/\D/g, '');
}

function local10FromDigits(digits: string): string | null {
  if (/^254[17]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^0[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return `0${digits}`;
  return null;
}

function networkFromNdc(ndc: number): KenyanNetwork | null {
  if (!Number.isFinite(ndc)) return null;
  if (ndc === 747) return 'JTL';
  if (ndc >= 700 && ndc <= 729) return 'SAFARICOM';
  if (ndc >= 740 && ndc <= 743) return 'SAFARICOM';
  if (ndc >= 790 && ndc <= 799) return 'SAFARICOM';
  if (ndc >= 110 && ndc <= 119) return 'SAFARICOM';
  if (ndc >= 140 && ndc <= 143) return 'SAFARICOM';
  if (ndc >= 180 && ndc <= 182) return 'SAFARICOM';
  if (ndc >= 730 && ndc <= 739) return 'AIRTEL';
  if (ndc >= 750 && ndc <= 756) return 'AIRTEL';
  if (ndc >= 785 && ndc <= 789) return 'AIRTEL';
  if (ndc >= 100 && ndc <= 102) return 'AIRTEL';
  if (ndc >= 770 && ndc <= 779) return 'TELKOM';
  if (ndc >= 763 && ndc <= 766) return 'EQUITEL';
  return null;
}

export function looksLikeKenyanMobile(raw: string): boolean {
  const local = local10FromDigits(kenyanMobileDigits(raw));
  if (!local) return false;
  if (local.startsWith('07')) return true;
  return networkFromNdc(Number.parseInt(local.slice(1, 4), 10)) != null;
}

export function toKenyanLocal07(raw: string): string | null {
  const local = local10FromDigits(kenyanMobileDigits(raw));
  if (!local) return null;
  if (local.startsWith('07')) return local;
  return networkFromNdc(Number.parseInt(local.slice(1, 4), 10)) ? local : null;
}

export function formatPhoneDisplay(raw: string): string {
  const local = toKenyanLocal07(raw) || kenyanMobileDigits(raw);
  if (local.length === 10 && (local.startsWith('07') || local.startsWith('01'))) {
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return raw.trim();
}

export type KenyanNetwork = 'SAFARICOM' | 'AIRTEL' | 'TELKOM' | 'EQUITEL' | 'JTL';

/**
 * Safaricom: 070x, 071x, 072x, 0740–0743, 079x, 0110–0119, 0140–0143, 0180–0182
 * Airtel: 073x, 0750–0756, 0785–0789, 0100–0102
 * Telkom: 0770–0779
 * Equitel: 0763–0766
 * Faiba (JTL): 0747
 */
export function detectKenyanNetwork(raw: string): KenyanNetwork | null {
  const local = toKenyanLocal07(raw);
  if (!local) return null;
  return networkFromNdc(Number.parseInt(local.slice(1, 4), 10));
}

export const KENYAN_NETWORKS: { id: KenyanNetwork; label: string; short: string }[] = [
  { id: 'SAFARICOM', label: 'Safaricom', short: 'Saf' },
  { id: 'AIRTEL', label: 'Airtel', short: 'Air' },
  { id: 'TELKOM', label: 'Telkom', short: 'Tel' },
  { id: 'EQUITEL', label: 'Equitel', short: 'Equ' },
  { id: 'JTL', label: 'Faiba', short: 'Faiba' },
];

export function sameNumber(a: string, b: string): boolean {
  return (toKenyanLocal07(a) || kenyanMobileDigits(a)) === (toKenyanLocal07(b) || kenyanMobileDigits(b));
}
