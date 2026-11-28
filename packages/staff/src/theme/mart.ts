import Constants from 'expo-constants';
import { Easing, Platform, StyleSheet, type TextStyle } from 'react-native';
import type { TenantContext } from '@kiosk/core';
import { resolveBrandColors } from './brand-colors';
import { setUiFont } from '@kiosk/ui';

/**
 * The shop as a guide map. Cream is the water every screen floats on, the shop's own colour is the land,
 * and four zone colours mark aisles and states.
 */
export const MART = {
  ink: '#16180f',
  inkMuted: '#565a4e',
  /** Darkest quiet tone that still clears 4.5:1 on `paper`. */
  inkQuiet: '#8c8f82',
  /** The ground of every screen: a warm, soft off-white with the faintest green undertone. */
  paper: '#f7f6f0',
  /** Cards and fields: pure white, lifted by a soft shadow. */
  paperElevated: '#ffffff',
  /** Pressed tiles, skeleton bones, quiet wells. */
  paperSunken: '#eceae1',
  /** Hairline dividers and card edges. */
  border: '#e8e6db',
  /** Outlined capsules and fields at rest. */
  borderStrong: '#d4d1c4',
  /** The accent that leads: the counter's amber, so the till and the shop floor read as one product. */
  fallbackPrimary: '#F08A24',
  /** A deeper amber for pressed states and text on the wash. */
  fallbackPrimaryLift: '#D97515',
  fallbackAccent: '#e8650e',
  gold: '#f2c438',
  danger: '#b42318',
  dangerSurface: '#fee4e2',
  success: '#2f7a21',
  successSurface: '#dcf5d0',
  warning: '#7a5a00',
  warningSurface: '#fdf2c4',
  info: '#0b5cab',
  infoSurface: '#d4e9ff',
  /** The soft shadow colour — a warm brown-black, never pure black. */
  shadowTint: '#7A5A2E',
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
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
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
 * The device face — SF Pro on iPhone, Roboto on Android. Soft POS mockups (and that Dribbble
 * shot) are drawn in this native grotesk; a custom geometric face reads as the wrong product.
 * Weight is carried by `WEIGHT` beside the family (Android needs both).
 */
const SYSTEM_FACE = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;

/**
 * The UI voice, changed once at start-up by an app that wants its own typeface.
 *
 * The till reads best in the device's own face; a counter can wear its brand instead. Because `MartText` and every
 * component read these values on each render, mutating them before the first screen paints is enough — no context, no
 * prop drilling, and an app that never calls the setter keeps the system face it always had.
 */
/**
 * The UI voice. DM Sans while the Sande More files are the unlicensed demo build (it watermarks every heading); the four
 * `SandeMore_*` families stay loaded in the shell, so switching back is this table alone.
 */
/**
 * The UI voice: **Sande More**, as asked. Note the files supplied are the DEMO cut, which prints a small "DEMO" glyph
 * after each heading — the licensed build replaces them file for file, with no code change.
 */
export const FONT = {
  regular: 'SandeMore_400Regular',
  medium: 'SandeMore_500Medium',
  semibold: 'SandeMore_500Medium',
  bold: 'SandeMore_700Bold',
  black: 'SandeMore_800ExtraBold',
};

/** Families as they are registered by the shell's `useFonts`. */
export const JAKARTA = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  black: 'PlusJakartaSans_800ExtraBold',
} as const;

export type UiTypeface = 'system' | 'jakarta';

type UiFace = { regular: string; medium: string; semibold: string; bold: string; black: string };

/**
 * Point every MART / UI text style at these registered family names. Call once after `useFonts` resolves,
 * before the first screen paints. Updates both `@kiosk/staff` and `@kiosk/ui` so Banner/Button match MartText.
 */
export function setUiFace(family: UiFace): void {
  setUiFont(family);
  FONT.regular = family.regular;
  FONT.medium = family.medium;
  FONT.semibold = family.semibold;
  FONT.bold = family.bold;
  FONT.black = family.black;
}

/** Called once by an app before its first screen: `jakarta` for the branded counter, `system` for the till. */
export function setUiTypeface(face: UiTypeface): void {
  if (face === 'system') {
    setUiFace({ regular: SYSTEM_FACE, medium: SYSTEM_FACE, semibold: SYSTEM_FACE, bold: SYSTEM_FACE, black: SYSTEM_FACE });
    return;
  }
  setUiFace(JAKARTA);
}

/**
 * The weights, as plain strings rather than `TextStyle['fontWeight']`: a navigator's header style asks for `string`, and
 * the wider union (which admits numbers) is refused there. These five values satisfy both.
 */
export const WEIGHT: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'black', '400' | '500' | '600' | '700' | '800'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '800',
};

/** Same system face for headers. */
export const BRAND = {
  semibold: FONT.semibold,
  bold: FONT.bold,
  black: FONT.black,
} as const;

/**
 * Soft POS scale — matches the food-ordering till shot:
 * screen titles 600, product names 500, prices 600, loud totals 700, meta 400.
 */
export const TYPE = {
  display: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
  },
  hero: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.45,
  },
  heading: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 16.5,
    lineHeight: 21,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    fontFamily: FONT.medium,
    fontWeight: WEIGHT.medium,
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1,
  },
  shelf: {
    // the reference's small caps: tiny, tracked out, and never bold
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.1,
  },
  price: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.35,
  },
} satisfies Record<string, TextStyle>;

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
 * Soft desk-paper lift. Cards use `card`; bars that sit over content use `floating`.
 */
export const SHADOW = {
  card: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  hero: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  floating: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
} as const;

export const HAIRLINE = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: MART.border,
} as const;

export const SPRING = { duration: 400, dampingRatio: 0.62 } as const;
export const SETTLE = { duration: 400, dampingRatio: 1 } as const;

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
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
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
    ? branding.heroBannerUrls.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))
    : [];
  return {
    primary: colors.primary,
    accent: colors.accent,
    gold: MART.gold,
    onPrimary: onFill(colors.primary),
    onAccent: onFill(colors.accent),
    logoUrl: asText(branding.logoUrl),
    displayName: extras?.businessName?.trim() || asText(branding.displayName) || tenant.displayName,
    tagline: extras?.announcement?.trim() || asText(branding.metaTitle),
    description: asText(branding.metaDescription),
    heroBanners: banners,
  };
}

/** A white field on the water that holds a form, a list or a summary. */
export const TILE = {
  backgroundColor: MART.paperElevated,
  borderRadius: RADIUS.lg,
  padding: SPACE.lg,
} as const;
