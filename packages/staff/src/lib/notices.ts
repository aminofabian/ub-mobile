import { APP_JOBS, APP_NAMES, describeSetup, plainHost, webHomeForRole, type StaffApp } from '@kiosk/core';
import type { EntryStage } from './entry';

/**
 * The words on the screens that stop a person between signing in and the app (plan §5.12.4). Plain
 * sentences, one way forward each, no codes and no status numbers.
 */

export type NoticeActionId = 'retry' | 'sign_out' | 'open_web' | 'save_unsent' | 'pair';

export interface NoticeAction {
  id: NoticeActionId;
  label: string;
  primary?: boolean;
}

export interface Notice {
  title: string;
  body: string;
  actions: NoticeAction[];
  /** For the `open_web` action: where on the web this person works. */
  webUrl?: string;
}

export type NoticeStage = Extract<
  EntryStage,
  { name: 'check_failed' | 'shop_off' | 'no_role' | 'wrong_app' | 'branches_failed' | 'no_branch' | 'no_branch_assigned' | 'removed' }
>;

export interface NoticeContext {
  app: StaffApp;
  shopName?: string;
  /** The shop's web address (its host). */
  host?: string;
  pairingEnabled?: boolean;
  /** Sales on this phone that were never sent. */
  unsentCount?: number;
}

/** `https://host/path` for the shop's own address, or undefined when the host is not a plain address. */
export function shopWebUrl(host: string | undefined, path = '/'): string | undefined {
  const clean = plainHost(host);
  if (!clean) return undefined;
  const safePath = /^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/.test(path) ? path : '/';
  return `https://${clean}${safePath}`;
}

/** "Cashier", "Cashier and Stock", "Cashier, Stock and Admin". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const TRY_AGAIN: NoticeAction = { id: 'retry', label: 'Try again', primary: true };
const SIGN_OUT: NoticeAction = { id: 'sign_out', label: 'Sign out' };

export function describeEntryNotice(stage: NoticeStage, context: NoticeContext): Notice {
  const shop = context.shopName?.trim() || 'this shop';
  const host = plainHost(context.host) ?? undefined;

  switch (stage.name) {
    case 'check_failed':
      return {
        title: "Couldn't check your account",
        body: 'Check your connection, then try again.',
        actions: [TRY_AGAIN, SIGN_OUT],
      };

    case 'branches_failed':
      return {
        title: "Couldn't load your branches",
        body: 'Check your connection, then try again.',
        actions: [TRY_AGAIN, SIGN_OUT],
      };

    case 'shop_off':
      return {
        title: `${shop} is switched off right now`,
        body: 'Ask the owner to contact support.',
        actions: [TRY_AGAIN, SIGN_OUT],
      };

    case 'no_role':
      return {
        title: 'Your account has no role yet',
        body: 'Ask your manager to give your account a role, then sign in again.',
        actions: [{ ...SIGN_OUT, primary: true }],
      };

    case 'no_branch_assigned': {
      // The branch is read when the person signs in, so the next step is to sign in again, not to check again.
      const step = describeSetup({ requirement: 'branch', hint: 'assign' }, { web: host });
      return { title: step.title, body: step.body, actions: [{ ...SIGN_OUT, primary: true }] };
    }

    case 'no_branch': {
      const step = describeSetup({ requirement: 'branch', hint: 'none' }, { web: host });
      const webUrl = shopWebUrl(host);
      return {
        title: step.title,
        body: step.body,
        actions: [
          ...(webUrl ? [{ id: 'open_web' as const, label: `Open ${host}` }] : []),
          { id: 'retry', label: 'Check again', primary: true },
          SIGN_OUT,
        ],
        ...(webUrl ? { webUrl } : {}),
      };
    }

    case 'wrong_app': {
      const home = webHomeForRole(stage.user.roleKey);
      const others = stage.fits.filter((app) => app !== context.app).map((app) => APP_NAMES[app]);
      const lines = [
        `The ${APP_NAMES[context.app]} app is for ${APP_JOBS[context.app]}.`,
        `Your role, ${stage.user.roleName}, works in ${home.where} on the web.`,
      ];
      if (others.length > 0) {
        lines.push(`You can use the ${joinNames(others)} app${others.length === 1 ? '' : 's'} instead.`);
      }
      const webUrl = shopWebUrl(host, home.path);
      return {
        title: "This app isn't for your account",
        body: lines.join(' '),
        actions: [...(webUrl ? [{ id: 'open_web' as const, label: `Open ${host}`, primary: true }] : []), SIGN_OUT],
        ...(webUrl ? { webUrl } : {}),
      };
    }

    case 'removed': {
      const unsent = context.unsentCount ?? 0;
      return {
        title: `This phone was removed from ${shop}`,
        body: [
          'It is no longer a till here.',
          unsent > 0
            ? `${unsent === 1 ? '1 sale was' : `${unsent} sales were`} not sent and ${unsent === 1 ? 'is' : 'are'} still on this phone. Save ${unsent === 1 ? 'it' : 'them'} before you go.`
            : '',
          context.pairingEnabled
            ? 'To use it as a till again, pair it with a new code from your manager.'
            : 'Ask your manager if it should work as a till again.',
        ]
          .filter(Boolean)
          .join(' '),
        actions: [
          ...(unsent > 0 ? [{ id: 'save_unsent' as const, label: unsent === 1 ? 'Save the unsent sale' : 'Save the unsent sales', primary: true }] : []),
          ...(context.pairingEnabled ? [{ id: 'pair' as const, label: 'Pair this phone again', primary: unsent === 0 }] : []),
          SIGN_OUT,
        ],
      };
    }
  }
}
