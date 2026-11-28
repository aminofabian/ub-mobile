import type { ApiClient } from './create-api-client';

/** The shop's credit rules, as the business record holds them. */
export type CreditTabsSettings = {
  /** A customer must prove their number before the shop will open a tab for them. Off unless the owner says so. */
  requirePhoneVerificationForNewTabCustomers: boolean;
  allowCashierTabClearance: boolean;
  allowCashierSearchCustomersByName: boolean;
};

const DEFAULTS: CreditTabsSettings = {
  requirePhoneVerificationForNewTabCustomers: false,
  allowCashierTabClearance: false,
  allowCashierSearchCustomersByName: false,
};

function flags(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** The credit settings inside a business record, with the server's own defaults where a field is missing. */
export function readCreditTabsSettings(business: unknown): CreditTabsSettings {
  const inventory = flags(flags(business).inventory);
  const creditTabs = flags(inventory.creditTabs);
  return {
    requirePhoneVerificationForNewTabCustomers:
      typeof creditTabs.requirePhoneVerificationForNewTabCustomers === 'boolean'
        ? creditTabs.requirePhoneVerificationForNewTabCustomers
        : DEFAULTS.requirePhoneVerificationForNewTabCustomers,
    allowCashierTabClearance:
      typeof creditTabs.allowCashierTabClearance === 'boolean'
        ? creditTabs.allowCashierTabClearance
        : DEFAULTS.allowCashierTabClearance,
    allowCashierSearchCustomersByName:
      typeof creditTabs.allowCashierSearchCustomersByName === 'boolean'
        ? creditTabs.allowCashierSearchCustomersByName
        : DEFAULTS.allowCashierSearchCustomersByName,
  };
}

export async function fetchCreditTabsSettings(api: ApiClient): Promise<CreditTabsSettings> {
  return readCreditTabsSettings(await api.get<unknown>('/api/v1/businesses/me'));
}

/**
 * Sets whether a customer must prove their number before a tab opens for them.
 *
 * The patch is nested the way the business record holds it (`inventory.creditTabs`), and only this one field is sent, so a
 * setting someone else is changing at the same time is left alone. Answers with the settings as the server now holds them.
 */
export async function setRequirePhoneVerification(api: ApiClient, required: boolean): Promise<CreditTabsSettings> {
  const answer = await api.patch<unknown>('/api/v1/businesses/me', {
    inventory: { creditTabs: { requirePhoneVerificationForNewTabCustomers: required } },
  });
  return readCreditTabsSettings(answer);
}
