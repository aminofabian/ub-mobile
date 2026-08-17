/** Matches frontend `ub.access` / Java `ub.refresh` cookie names. */
const ACCESS_COOKIE = 'ub.access';
const REFRESH_COOKIE = 'ub.refresh';

export const NATIVE_KIOSK_CLIENT_HEADER = 'X-Kiosk-Client';
export const NATIVE_KIOSK_CLIENT_VALUE = 'native';

export type AuthTokenPayload = {
  accessToken?: string;
  refreshToken?: string;
  access_token?: string;
  refresh_token?: string;
};

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Split concatenated Set-Cookie header values without breaking Expires dates. */
export function readSetCookieLines(headers: Headers): string[] {
  const withGet = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGet.getSetCookie === 'function') {
    return withGet.getSetCookie();
  }
  const combined = headers.get('set-cookie');
  if (!combined) {
    return [];
  }
  return combined.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
}

function cookieNameValue(setCookieLine: string, name: string): string | null {
  const first = setCookieLine.trim().split(';')[0] ?? '';
  const eq = first.indexOf('=');
  if (eq <= 0) {
    return null;
  }
  if (first.slice(0, eq).trim() !== name) {
    return null;
  }
  const raw = first.slice(eq + 1).trim();
  return raw ? decodeCookieValue(raw) : null;
}

export function readCookieFromSetCookie(headers: Headers, name: string): string {
  for (const line of readSetCookieLines(headers)) {
    const value = cookieNameValue(line, name);
    if (value) {
      return value;
    }
  }
  return '';
}

export function readAuthTokens(
  payload: AuthTokenPayload,
  headers: Headers
): { accessToken: string; refreshToken: string } {
  const access =
    payload.accessToken?.trim() ||
    payload.access_token?.trim() ||
    readCookieFromSetCookie(headers, ACCESS_COOKIE);
  const refresh =
    payload.refreshToken?.trim() ||
    payload.refresh_token?.trim() ||
    readCookieFromSetCookie(headers, REFRESH_COOKIE);
  return { accessToken: access, refreshToken: refresh };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PIN login only accepts a real branch UUID; omit placeholders like "default". */
export function pinLoginBranchId(branchId: string | undefined): string | undefined {
  const trimmed = branchId?.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
