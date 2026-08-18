import type { TenantContext } from '@kiosk/core';

export const MART = {
  ink: '#141816',
  inkMuted: '#5c6560',
  inkQuiet: '#8a928c',
  paper: '#f4f5f4',
  paperElevated: '#ffffff',
  border: '#e2e5e2',
  fallbackPrimary: '#0F766E',
  fallbackAccent: '#CE8509',
  radius: 3,
} as const;

export type MartPalette = {
  primary: string;
  accent: string;
  logoUrl: string | null;
  displayName: string;
  tagline: string | null;
  description: string | null;
  heroBanners: string[];
};

function asHex(value: unknown, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function martFromTenant(
  tenant: TenantContext,
  extras?: { announcement?: string | null; businessName?: string | null }
): MartPalette {
  const branding = tenant.branding ?? {};
  const banners = Array.isArray(branding.heroBannerUrls)
    ? branding.heroBannerUrls.filter(
        (url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)
      )
    : [];

  return {
    primary: asHex(branding.primaryColor, MART.fallbackPrimary),
    accent: asHex(branding.accentColor, MART.fallbackAccent),
    logoUrl: asText(branding.logoUrl),
    displayName:
      extras?.businessName?.trim() || asText(branding.displayName) || tenant.displayName,
    tagline: extras?.announcement?.trim() || asText(branding.metaTitle),
    description: asText(branding.metaDescription),
    heroBanners: banners,
  };
}
