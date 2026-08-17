import { publicApiRequest } from './api-client';

export interface PublicMobileBranding {
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  metaKeywords: string | null;
  heroBannerUrls: string[] | null;
}

export interface PublicMobileDeepLinks {
  shopper: string;
  cashier: string;
  grocery: string;
  admin: string;
  stock: string;
  tenant: string;
  universalShop: string;
  universalApp: string;
}

export interface PublicMobileStoreLinks {
  ios: string | null;
  android: string | null;
}

export interface PublicMobileApp {
  role: string;
  name: string;
  bundleId: string;
  whiteLabel: boolean;
  embeddedTenantSlug: string;
  storeLinks: PublicMobileStoreLinks;
}

export interface PublicMobileConfig {
  tenantId: string;
  slug: string;
  displayName: string;
  tenantHost: string;
  tenantStatus: string;
  storefrontEnabled: boolean;
  apiBaseUrl: string;
  branding: PublicMobileBranding;
  deepLinks: PublicMobileDeepLinks;
  platformStoreLinks: PublicMobileStoreLinks;
  apps: PublicMobileApp[];
}

export async function fetchPublicMobileConfig(
  baseURL: string,
  slug: string
): Promise<PublicMobileConfig> {
  return publicApiRequest<PublicMobileConfig>(
    baseURL,
    'GET',
    `/api/v1/public/businesses/${encodeURIComponent(slug)}/mobile`
  );
}
