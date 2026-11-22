import Constants from 'expo-constants';
import { Easing, Platform, type TextStyle } from 'react-native';
import type { TenantContext } from '@kiosk/core';
import { resolveBrandColors } from './brand-colors';

export const MART = {
  ink: '#141816',
  inkMuted: '#525b56',
  /** Darkest quiet grey that still clears 4.5:1 on `paper`. */
  inkQuiet: '#66706a',
  paper: '#f2f3f2',
  paperElevated: '#ffffff',
  paperSunken: '#e9ebe9',
  border: '#dfe3df',
  borderStrong: '#c9cfc9',
  fallbackPrimary: '#164715',
  fallbackAccent: '#fd800e',
  gold: '#fbad00',
  danger: '#b42318',
  dangerSurface: '#fef3f2',
  success: '#067647',
  successSurface: '#ecfdf3',
  warning: '#b54708',
  warningSurface: '#fff7ed',
  radius: 4,
} as const;

/**
 * Palmart's world is a printed grocery flyer: tight corners, ruled edges,
 * one paper stack. Radii stay small on purpose — pills are only ever status.
 */
export const RADIUS = {
  sm: 2,
  md: 4,
  lg: 6,
  pill: 999,
} as const;

/** 4pt grid. Page gutter is SPACE.lg; grid gap is SPACE.sm. */
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

export const GUTTER = SPACE.lg;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

/**
 * Six steps, each with an obvious size and weight jump. `display` and `title`
 * carry the serif flyer voice; everything below is the platform sans so long
 * product names and Swahili copy stay legible at small sizes.
 */
export const TYPE = {
  display: {
    fontFamily: SERIF,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: SERIF,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  /** Shelf-edge labels: counts, prices on tiles, aisle names. */
  shelf: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
} satisfies Record<string, TextStyle>;

/**
 * Elevation is declared once per surface. Cards resting on paper get `ruled`
 * (hairline, no shadow); only surfaces that genuinely float get `lifted`.
 */
export const ELEVATION = {
  ruled: {
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  lifted: {
    backgroundColor: MART.paperElevated,
    shadowColor: '#0b110e',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

/** Durations express distance; exits are faster than entrances. */
export const MOTION = {
  feedback: 130,
  state: 220,
  view: 340,
  entrance: 640,
  exit: 240,
  /** Confident arrival, no bounce. */
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: Easing.bezier(0.7, 0, 0.84, 0),
} as const;

/** Two-digit alpha suffix for a brand hex, for wash fills and hairlines. */
export function tint(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${byte}`;
}

/**
 * Secondary text on a brand-coloured surface. Plain grey and low-alpha white
 * both fail contrast at body sizes, so these keep the hue and stay legible.
 */
export const ON_BRAND = {
  primary: '#ffffff',
  /** Lowest alpha that still clears 4.5:1 on the brand green. Do not go dimmer for text. */
  secondary: 'rgba(255,255,255,0.88)',
  hairline: 'rgba(255,255,255,0.24)',
  wash: 'rgba(255,255,255,0.14)',
} as const;

export type MartPalette = {
  primary: string;
  accent: string;
  gold: string;
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
    logoUrl: asText(branding.logoUrl),
    displayName:
      extras?.businessName?.trim() || asText(branding.displayName) || tenant.displayName,
    tagline: extras?.announcement?.trim() || asText(branding.metaTitle),
    description: asText(branding.metaDescription),
    heroBanners: banners,
  };
}
