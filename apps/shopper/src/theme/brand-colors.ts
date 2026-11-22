/**
 * Which colours the Shopper wears.
 *
 * A white-label build is one shop's app. It wears the colours baked into it at build time
 * (`extra.themeColors`, from that shop's profile). The CMS record behind a shipped binary can be stale,
 * still holding the platform's default green, so it never repaints that build.
 *
 * The generic build has no baked colours. It wears the CMS colours of whichever shop was picked.
 *
 * Either way, a missing or malformed colour falls back to the app's own tokens.
 *
 * No imports, so node can run this file's test directly.
 */

export type BrandColors = { primary: string; accent: string };

function asHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

export function resolveBrandColors(input: {
  /** `extra.isWhiteLabel` from the build's manifest. */
  whiteLabel: boolean;
  /** `extra.themeColors` from the build's manifest. */
  baked?: { primary?: unknown; accent?: unknown } | null;
  /** The chosen shop's CMS branding. */
  cms?: { primaryColor?: unknown; accentColor?: unknown } | null;
  fallback: BrandColors;
}): BrandColors {
  const { whiteLabel, baked, cms, fallback } = input;
  if (whiteLabel) {
    return {
      primary: asHex(baked?.primary, fallback.primary),
      accent: asHex(baked?.accent, fallback.accent),
    };
  }
  return {
    primary: asHex(cms?.primaryColor, fallback.primary),
    accent: asHex(cms?.accentColor, fallback.accent),
  };
}
