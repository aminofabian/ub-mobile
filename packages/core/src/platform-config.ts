import Constants from 'expo-constants';
import { DEFAULT_TIMEOUT_MS, getJson } from './tenant-resolve';

/**
 * What the platform says to every app before any shop is open (plan §5.10 row 4): the oldest app version
 * that still works, versions known to be bad, who to contact, and which features the server has switched
 * on. It is read from `GET /api/v1/platform/mobile-schema-version`, which today answers a schema version
 * and a minimum app version; the other fields are optional additions.
 *
 * Every field is optional and read defensively. A server that sends nothing new leaves the app behaving
 * exactly as it did, which is what lets this ship before the server does.
 */

export interface PlatformSupport {
  phone?: string;
  email?: string;
  whatsapp?: string;
  url?: string;
}

export interface PlatformConfig {
  schemaVersion?: number;
  /** The oldest app version that may keep working. Older ones are asked to update. */
  minAppVersion?: string;
  /** Exact versions that are refused even though they are newer than the minimum. */
  blockedVersions: string[];
  support?: PlatformSupport;
  /** Search by name. On unless the server says `false`: the endpoint exists today. */
  directoryEnabled: boolean;
  /** Shop codes. Off unless the server says `true`: there is no by-code route until the server ships one. */
  shopCodesEnabled: boolean;
  /** Pairing a phone to a till with a QR from the manager. Off unless `true`: the server has no such route yet. */
  pairingEnabled: boolean;
  /** The slug of a demo shop for reviewers and the curious. Absent until the server seeds one. */
  demoShop?: string;
  storeLinks?: { ios?: string; android?: string };
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  blockedVersions: [],
  directoryEnabled: true,
  shopCodesEnabled: false,
  pairingEnabled: false,
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_BLOCKED = 50;

function text(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** An address the app may open: https, a plain ASCII host, and no user name in front of the host. */
const WEB_ADDRESS_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#]\S*)?$/i;
/** The update screen sends people to the platform's app in a store, and to nowhere else. */
const STORE_ADDRESS_RE = /^https:\/\/(?:apps\.apple\.com|itunes\.apple\.com|play\.google\.com)(?:[/?#]\S*)?$/i;
/** Letters, digits and . _ % + - only: nothing that could add a subject, a copy or a body to a mailto link. */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

function webAddress(value: unknown): string | undefined {
  const address = text(value, 500);
  return address && WEB_ADDRESS_RE.test(address) ? address : undefined;
}

function storeAddress(value: unknown): string | undefined {
  const address = text(value, 500);
  return address && STORE_ADDRESS_RE.test(address) ? address : undefined;
}

/** "1.2.3" as [1, 2, 3]. A suffix such as "-beta.1" is ignored; null when there is no number at all. */
export function parseVersion(version: string): number[] | null {
  const core = version.trim().split(/[-+]/)[0] ?? '';
  const parts = core.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  return parts.length > 0 && parts.every((part) => Number.isFinite(part)) ? parts : null;
}

/** Negative when `a` is older than `b`, positive when newer, zero when the same. Missing parts count as 0. */
export function compareVersions(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function parseSupport(raw: unknown): PlatformSupport | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const { phone, email, whatsapp, url } = raw as Record<string, unknown>;
  const support: PlatformSupport = {};
  const phoneText = text(phone, 40);
  if (phoneText && /^[+\d][\d\s()-]{5,}$/.test(phoneText)) support.phone = phoneText;
  const emailText = text(email, 120);
  if (emailText && EMAIL_RE.test(emailText)) support.email = emailText;
  const whatsappText = text(whatsapp, 40);
  if (whatsappText && /^[+\d][\d\s()-]{5,}$/.test(whatsappText)) support.whatsapp = whatsappText;
  const link = webAddress(url);
  if (link) support.url = link;
  return Object.keys(support).length > 0 ? support : undefined;
}

/** Reads the answer. Anything that is not understood is left at its default. */
export function parsePlatformConfig(body: unknown): PlatformConfig {
  const config: PlatformConfig = { ...DEFAULT_PLATFORM_CONFIG, blockedVersions: [] };
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return config;
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)) {
    config.schemaVersion = raw.schemaVersion;
  }
  const min = text(raw.minAppVersion, 40);
  if (min && parseVersion(min)) {
    config.minAppVersion = min;
  }
  if (Array.isArray(raw.blockedVersions)) {
    config.blockedVersions = raw.blockedVersions
      .map((entry) => text(entry, 40))
      .filter((entry): entry is string => Boolean(entry) && parseVersion(entry as string) !== null)
      .slice(0, MAX_BLOCKED);
  }
  const support = parseSupport(raw.support);
  if (support) {
    config.support = support;
  }
  config.directoryEnabled = raw.directoryEnabled !== false;
  config.shopCodesEnabled = raw.shopCodesEnabled === true;
  config.pairingEnabled = raw.pairingEnabled === true;
  const demo = text(raw.demoShop, 63)?.toLowerCase();
  if (demo && SLUG_RE.test(demo)) {
    config.demoShop = demo;
  }
  if (raw.storeLinks && typeof raw.storeLinks === 'object' && !Array.isArray(raw.storeLinks)) {
    const { ios, android } = raw.storeLinks as Record<string, unknown>;
    const links = { ...(storeAddress(ios) ? { ios: storeAddress(ios) } : {}), ...(storeAddress(android) ? { android: storeAddress(android) } : {}) };
    if (Object.keys(links).length > 0) {
      config.storeLinks = links;
    }
  }
  return config;
}

/** The platform's answer, or null when it could not be had: offline, an older server, or a page that is not ours. */
export async function fetchPlatformConfig(baseURL: string, options: { timeoutMs?: number } = {}): Promise<PlatformConfig | null> {
  const base = baseURL.replace(/\/+$/, '');
  const fetched = await getJson(`${base}/api/v1/platform/mobile-schema-version`, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (fetched.kind !== 'response' || fetched.status !== 200 || fetched.body === null) {
    return null;
  }
  return parsePlatformConfig(fetched.body);
}

/** This build's own version, from its manifest. Undefined when the build does not say. */
export function getAppVersion(): string | undefined {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version.trim() ? version.trim() : undefined;
}

export type UpdateState =
  | { required: false }
  | { required: true; reason: 'below_minimum' | 'blocked'; minAppVersion?: string; storeUrl?: string };

/**
 * Whether this build must be updated. It is only ever "yes" when both sides are known: an app that does
 * not know its version, or a platform that could not be reached, is left alone rather than locked out.
 */
export function updateStateFor(appVersion: string | undefined, config: PlatformConfig | null, platform: string): UpdateState {
  const current = appVersion ? parseVersion(appVersion) : null;
  if (!current || !config) {
    return { required: false };
  }
  const storeUrl = platform === 'ios' ? config.storeLinks?.ios : config.storeLinks?.android;
  const link = storeUrl ? { storeUrl } : {};

  const blocked = config.blockedVersions.some((entry) => {
    const version = parseVersion(entry);
    return version !== null && compareVersions(current, version) === 0;
  });
  if (blocked) {
    return { required: true, reason: 'blocked', ...(config.minAppVersion ? { minAppVersion: config.minAppVersion } : {}), ...link };
  }
  const minimum = config.minAppVersion ? parseVersion(config.minAppVersion) : null;
  if (minimum && compareVersions(current, minimum) < 0) {
    return { required: true, reason: 'below_minimum', minAppVersion: config.minAppVersion, ...link };
  }
  return { required: false };
}
