import type { StoreHit, StoreSnapshot } from '@kiosk/core';

/**
 * What a shop looks like in a list. A search row, a remembered shop and a shop that was just looked up
 * reach the screen in three shapes; the screen draws all of them from this one.
 *
 * No imports but types, so node can run this file's test directly.
 */
export interface StoreCardView {
  /** A key for a list: the shop's id when it is known, otherwise its short name. */
  key: string;
  slug: string;
  name: string;
  /** One capital letter, for the tile that stands in for a logo the shop does not have. */
  monogram: string;
  logoUrl: string | null;
  /** Where the shop lives on the web, for example "acme.kiosk.ke". */
  address: string;
  /** The shop's own colour when it sent a valid one. */
  color: string | null;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function monogramOf(name: string, fallback = ''): string {
  const letter = Array.from(name.trim())[0] ?? Array.from(fallback.trim())[0] ?? '';
  return letter ? letter.toUpperCase() : '#';
}

function safeColor(value: unknown): string | null {
  return typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : null;
}

/** A logo is loaded from an address the shop's owner chose, so it must at least be a secure one. */
function safeLogo(value: unknown): string | null {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim()) ? value.trim() : null;
}

/** A directory row. `hostSuffix` is the platform's own domain, used when the shop has no address of its own. */
export function cardFromHit(hit: StoreHit, hostSuffix: string): StoreCardView {
  const suffix = hostSuffix.trim().replace(/^\./, '');
  return {
    key: hit.slug,
    slug: hit.slug,
    name: hit.name,
    monogram: monogramOf(hit.name, hit.slug),
    logoUrl: safeLogo(hit.logoUrl),
    address: hit.host ?? (suffix ? `${hit.slug}.${suffix}` : hit.slug),
    color: null,
  };
}

/** A shop the phone has looked up or remembered. */
export function cardFromStore(store: StoreSnapshot, hostSuffix: string): StoreCardView {
  const suffix = hostSuffix.trim().replace(/^\./, '');
  const branding = store.branding ?? {};
  const name = store.displayName?.trim() || store.slug;
  return {
    key: store.businessId || store.slug,
    slug: store.slug,
    name,
    monogram: monogramOf(name, store.slug),
    logoUrl: safeLogo(branding.logoUrl),
    address: store.host?.trim() || (suffix ? `${store.slug}.${suffix}` : store.slug),
    color: safeColor(branding.primaryColor),
  };
}

/** sRGB relative luminance of "#rgb" or "#rrggbb", 0 (black) to 1 (white). Null when it is not a colour. */
function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  const digits = match[1]!.length === 3 ? match[1]!.replace(/./g, (c) => c + c) : match[1]!;
  const channel = (offset: number) => {
    const value = parseInt(digits.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * The letter colour for a tile painted in a shop's own colour: white where white is readable (4.5 to 1,
 * the usual bar for text), the dark ink everywhere else. A colour that is not a colour gets white, which
 * is what the platform's green tile uses.
 */
export function readableTextOn(background: string, light = '#ffffff', dark = '#141816'): string {
  const level = luminance(background);
  if (level === null) {
    return light;
  }
  return 1.05 / (level + 0.05) >= 4.5 ? light : dark;
}
