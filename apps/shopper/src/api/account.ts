import { apiRequest } from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';

const client = { baseURL: API_BASE_URL };

export type MeProfile = {
  id?: string;
  name?: string;
  email?: string;
  status?: string;
};

export type ShopperBalances = {
  walletBalance?: number | string | null;
  balanceOwed?: number | string | null;
  creditLimit?: number | string | null;
  creditAvailable?: number | string | null;
  loyaltyPoints?: number;
};

export type ShopperPickupOrder = {
  id: string;
  orderCode?: string;
  status?: string;
  grandTotal?: number | string | null;
  currency?: string;
  catalogBranchName?: string;
  createdAt?: string;
};

export type ShopperLedgerLine = {
  occurredAt?: string;
  kind?: string;
  memo?: string;
  debit?: number | string | null;
  credit?: number | string | null;
};

export type ShopperHub = {
  email: string;
  linkedStorefrontProfile: boolean;
  customerDirectoryName?: string;
  balances?: ShopperBalances;
  pickupOrders?: ShopperPickupOrder[];
  pickupOrdersTotal?: number;
  recentLedgerLines?: ShopperLedgerLine[];
  ledgerLinesTotal?: number;
  ledgerTruncated?: boolean;
  loyaltyKesPerPoint?: number | string | null;
  tabPhone?: string | null;
};

export async function fetchMe(): Promise<MeProfile> {
  return apiRequest<MeProfile>(client, 'GET', '/api/v1/me');
}

export async function fetchShopperHub(page = 0, size = 20): Promise<ShopperHub> {
  return apiRequest<ShopperHub>(
    client,
    'GET',
    `/api/v1/me/shopper?page=${page}&size=${size}`
  );
}
