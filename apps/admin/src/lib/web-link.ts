import { plainHost } from '@kiosk/core';

/**
 * Where the shop's web pages live, for the jobs the phone leaves to the web. The phone and the web do not share a
 * sign-in yet, so these open the page and the web asks the owner to sign in there (a one-time hand-over is the owner's
 * decision, plan §7.4). The paths are the web app's own page folders.
 */
export type WebArea = 'overview' | 'orders' | 'stock' | 'credit' | 'receive' | 'team' | 'settings';

const PATHS: Record<WebArea, string> = {
  overview: '/overview',
  orders: '/storefront/web-orders',
  stock: '/inventory',
  credit: '/credits',
  receive: '/purchasing',
  team: '/users',
  settings: '/settings',
};

/** `https://<the shop's address>/<page>`, or null when the shop's address is not a plain web address (a test host with a port, say). */
export function webUrl(host: unknown, area: WebArea): string | null {
  const name = plainHost(host);
  return name !== null && !name.includes(':') ? `https://${name}${PATHS[area]}` : null;
}
