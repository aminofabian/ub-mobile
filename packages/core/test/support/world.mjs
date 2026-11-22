// Shared helpers for the tenant-context tests: reset every fake and module cache, build a fake
// network, and simulate an uninstall or an upgrade.
import * as SecureStoreFake from './fakes/expo-secure-store.mjs';
import * as AsyncStorageFake from './fakes/async-storage.mjs';
import * as ConstantsFake from './fakes/expo-constants.mjs';
import * as ReactNativeFake from './fakes/react-native.mjs';

export const secureStore = SecureStoreFake;
export const asyncStore = AsyncStorageFake;

/** Fresh phone: empty keychain, empty app data, a generic (non white-label) build. */
export function freshPhone(extra = {}) {
  SecureStoreFake.__reset();
  AsyncStorageFake.__reset();
  ConstantsFake.__setExtra(extra);
  ReactNativeFake.__resetAlerts();
}

/** The app is reinstalled: app data is gone. The keychain stays, as it does on iOS. */
export function reinstall(extra) {
  AsyncStorageFake.__wipe();
  if (extra) ConstantsFake.__setExtra(extra);
}

export function setBuild(extra) {
  ConstantsFake.__setExtra(extra);
}

/**
 * Installs a fake fetch. routes: array of [matcher, responder]. matcher is a string (substring of
 * the URL) or a RegExp; responder is a Response-like { status, body, headers } or a function of the
 * URL and init returning one (or throwing, to simulate no network).
 */
export function installFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push({ url: href, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
    for (const [matcher, responder] of routes) {
      const hit = typeof matcher === 'string' ? href.includes(matcher) : matcher.test(href);
      if (!hit) continue;
      const out = typeof responder === 'function' ? await responder(href, init) : responder;
      return toResponse(out);
    }
    return toResponse({ status: 404, body: { detail: 'no route in test' } });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function offlineNetwork() {
  return installFetch([
    [
      '',
      () => {
        throw new TypeError('Network request failed');
      },
    ],
  ]);
}

function toResponse({ status = 200, body = {}, headers = {} }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: {
      get: (name) => lower[name.toLowerCase()] ?? null,
      getSetCookie: () => [],
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}
