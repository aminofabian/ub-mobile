import Constants from 'expo-constants';
import { Easing, Platform, type TextStyle } from 'react-native';
import type { TenantContext } from '@kiosk/core';
import { resolveBrandColors } from './brand-colors';

/**
 * The shop as a guide map. Cream is the water every screen floats on, the shop's own colour is the land,
 * and four zone colours mark aisles and states. Colour is flat: no shadows, no gradients. Separation
 * comes from colour meeting colour along a curved coast (see `components/Coast.tsx`).
 */
export const MART = {
  // A clean, minimal palette: near-black ink on a soft off-white ground, white cards, hairline dividers.
  // Green is kept only as a small accent (active states, the primary button), not as a fill.
  ink: '#1c1d1b',
  inkMuted: '#5b5f58',
  /** Darkest quiet tone that still clears 4.5:1 on `paper`. */
  inkQuiet: '#8a8d85',
  /** The ground of every screen: a soft, almost-white off-white. */
  paper: '#faf8f3',
  /** Cards and fields: pure white, set apart by a hairline, not a shadow. */
  paperElevated: '#ffffff',
  /** Pressed tiles, skeleton bones, quiet wells. */
  paperSunken: '#f0ede6',
  /** Hairline dividers and card edges. */
  border: '#ece8e0',
  /** Outlined capsules and fields at rest. */
  borderStrong: '#d8d3c9',
  fallbackPrimary: '#164715',
  fallbackAccent: '#fd800e',
  gold: '#f5e211',
  danger: '#a8281b',
  dangerSurface: '#ffd5cd',
  success: '#2f6b12',
  successSurface: '#d9f0c6',
  warning: '#7a5a00',
  warningSurface: '#fbf3a0',
  info: '#0b5cab',
  infoSurface: '#cfe8ff',
  radius: 16,
} as const;

/** The map's zone colours. Each aisle keeps one; ink is the only text colour that sits on them. */
export const ZONE = {
  sun: '#f5e211',
  coral: '#ff705d',
  pond: '#2ba0ff',
  lilac: '#ebc1ff',
  leaf: '#8ed462',
} as const;

const ZONE_ORDER = [ZONE.leaf, ZONE.sun, ZONE.coral, ZONE.pond, ZONE.lilac] as const;

/** The same aisle is always the same colour, on every screen and after every reload. */
export function zoneFor(key: string | null | undefined): string {
  const text = key ?? '';
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return ZONE_ORDER[hash % ZONE_ORDER.length];
}

/** Lobes are round. Tiles take `lg`, wells `md`, small marks `sm`; every control is a capsule (`pill`). */
export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
  pill: 999,
} as const;

/** 4pt grid. Page gutter is GUTTER; grid gap is SPACE.sm. */
export const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const GUTTER = SPACE.xl;

/**
 * One grotesk. A custom face carries its weight in the family name, so styles pick a `FONT` and never
 * set `fontWeight` (Android would fake the bold).
 */
export const FONT = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  black: 'Poppins_800ExtraBold',
} as const;

/**
 * Poppins is a rounded geometric sans, so it reads cleaner with a little more air and less negative
 * tracking than a grotesk. Headings lead in bold, not ultra-black; the number is what carries weight.
 */
export const TYPE = {
  display: {
    fontFamily: FONT.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: FONT.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  heading: {
    fontFamily: FONT.semibold,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    fontFamily: FONT.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  /** Small all-caps eyebrows, counts, status words. */
  shelf: {
    fontFamily: FONT.semibold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  /** Prices, wherever they appear. */
  price: {
    fontFamily: FONT.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
} satisfies Record<string, TextStyle>;

/**
 * Nothing casts a shadow. A tile is a white field on the water; a bar that floats over moving content
 * is cream with an ink outline.
 */
export const ELEVATION = {
  ruled: {
    backgroundColor: MART.paperElevated,
  },
  lifted: {
    backgroundColor: MART.paper,
    borderWidth: 1.5,
    borderColor: MART.ink,
  },
} as const;

/**
 * The two lifts the owner screens use, so depth stays consistent instead of being hand-tuned per card.
 * `card` is a white tile resting on the water; `hero` is the filled-green lead figure, lifted higher in
 * its own colour. One place to change if the whole app should sit flatter or deeper.
 */
export const SHADOW = {
  // The clean look declares elevation once — a hairline border — so these carry nothing. A 1px border
  // under a soft shadow is the "ghost card"; the border alone is the separation. Kept as empty objects
  // so the many `...SHADOW.card` spreads stay valid without touching every call site.
  card: {},
  hero: {},
} as const;

/** A hairline card edge, used instead of a shadow for separation in the clean look. */
export const HAIRLINE = {
  borderWidth: 1,
  borderColor: MART.border,
} as const;

/** Everything that moves takes 0.4s and overshoots once before it settles (Reanimated `withSpring`). */
export const SPRING = { duration: 400, dampingRatio: 0.62 } as const;
/** The same move with no overshoot, for things that must not wobble: sheets closing, totals. */
export const SETTLE = { duration: 400, dampingRatio: 1 } as const;

/** Timings for the built-in `Animated` API, where a spring is not available. */
export const MOTION = {
  feedback: 130,
  state: 220,
  view: 400,
  entrance: 400,
  exit: 220,
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: Easing.bezier(0.7, 0, 0.84, 0),
} as const;

/** Two-digit alpha suffix for a hex colour. */
export function tint(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${byte}`;
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export type OnFill = {
  /** Text and icons. */
  primary: string;
  /** Supporting text. Still clears 4.5:1. */
  secondary: string;
  hairline: string;
  wash: string;
};

const ON_DARK: OnFill = {
  primary: '#fffdf6',
  secondary: 'rgba(255,253,246,0.88)',
  hairline: 'rgba(255,253,246,0.28)',
  wash: 'rgba(255,253,246,0.16)',
};

const ON_LIGHT: OnFill = {
  primary: MART.ink,
  secondary: 'rgba(44,46,42,0.86)',
  hairline: 'rgba(44,46,42,0.24)',
  wash: 'rgba(44,46,42,0.1)',
};

/**
 * What to write with on a filled area. A shop picks its own colours, so this is worked out from the fill:
 * ink where ink clears 4.5:1, cream otherwise.
 */
export function onFill(hex: string): OnFill {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return ON_DARK;
  const inkContrast = (luminance(hex) + 0.05) / (luminance(MART.ink) + 0.05);
  return inkContrast >= 4.5 ? ON_LIGHT : ON_DARK;
}

/** Text on the fallback brand green. Prefer `onFill(colour)` wherever the fill is a shop's colour. */
export const ON_BRAND = ON_DARK;

export type MartPalette = {
  primary: string;
  accent: string;
  gold: string;
  /** What to write with on `primary` and on `accent`. */
  onPrimary: OnFill;
  onAccent: OnFill;
  logoUrl: string | null;
  displayName: string;
  tagline: string | null;
  description: string | null;
  heroBanners: string[];
};

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** What a white-label build carries in its manifest: the shop's own colours, baked in at build time. */
function bakedBrand(): {
  whiteLabel: boolean;
  baked: { primary?: unknown; accent?: unknown } | null;
} {
  const extra = Constants.expoConfig?.extra as
    | { isWhiteLabel?: boolean; themeColors?: { primary?: unknown; accent?: unknown } }
    | undefined;
  return { whiteLabel: Boolean(extra?.isWhiteLabel), baked: extra?.themeColors ?? null };
}

export function martFromTenant(
  tenant: TenantContext,
  extras?: { announcement?: string | null; businessName?: string | null }
): MartPalette {
  const branding = tenant.branding ?? {};
  const colors = resolveBrandColors({
    ...bakedBrand(),
    cms: { primaryColor: branding.primaryColor, accentColor: branding.accentColor },
    fallback: { primary: MART.fallbackPrimary, accent: MART.fallbackAccent },
  });
  const banners = Array.isArray(branding.heroBannerUrls)
    ? branding.heroBannerUrls.filter(
        (url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)
      )
    : [];

  return {
    // A white-label build wears its baked colours: its CMS record can be stale and still ship the
    // platform green. The generic build wears the chosen shop's CMS colours.
    primary: colors.primary,
    accent: colors.accent,
    gold: MART.gold,
    onPrimary: onFill(colors.primary),
    onAccent: onFill(colors.accent),
    logoUrl: asText(branding.logoUrl),
    displayName:
      extras?.businessName?.trim() || asText(branding.displayName) || tenant.displayName,
    tagline: extras?.announcement?.trim() || asText(branding.metaTitle),
    description: asText(branding.metaDescription),
    heroBanners: banners,
  };
}

/** A white field on the water that holds a form, a list or a summary. Rows inside it part with `MART.border`. */
export const TILE = {
  backgroundColor: MART.paperElevated,
  borderRadius: RADIUS.lg,
  padding: SPACE.lg,
} as const;
