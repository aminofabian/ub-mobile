import { cleanDisplayText } from '@kiosk/core';

/**
 * What the server said, made fit to show a person: on one line, cut to length, and nothing at all when it is a web
 * page (a firewall's, a proxy's or a login page's answer) and not words. An empty answer means "say it in the till's
 * own words".
 */
export function serverWords(text: unknown, max = 200): string {
  const clean = cleanDisplayText(text, max);
  return clean.startsWith('<') ? '' : clean;
}
