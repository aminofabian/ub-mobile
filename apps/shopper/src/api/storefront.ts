import { publicApiRequest } from '@kiosk/core';
import { phase_15_storefront_public } from '@kiosk/types';
import { API_BASE_URL } from '../lib/config';

// Generated types
type StorefrontResponse =
  phase_15_storefront_public.components['schemas']['PublicStorefrontResponse'] & {
    deliveryAreas?: PublicDeliveryArea[];
  };

export type PublicDeliveryArea = {
  id: string;
  name: string;
  active: boolean;
};
type CategoryListResponse =
  phase_15_storefront_public.components['schemas']['PublicCategoryListResponse'];
type CatalogListResponse =
  phase_15_storefront_public.components['schemas']['PublicCatalogListResponse'];
type ProductDetailResponse =
  phase_15_storefront_public.components['schemas']['PublicCatalogItemDetailResponse'];
type CartResponse = phase_15_storefront_public.components['schemas']['PublicCartResponse'];
type UpsertCartLineRequest =
  phase_15_storefront_public.components['schemas']['PublicUpsertCartLineRequest'];

// Manual types for checkout/payment endpoints not yet in OpenAPI spec
export interface CheckoutRequest {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}

export interface CheckoutResponse {
  orderId: string;
  status: string;
  grandTotal: number;
  currency: string;
  catalogBranchName?: string;
  createdAt: string;
}

export interface DisplayInstructions {
  configId: string;
  type: string;
  label: string;
  instructions: string;
  tillNumber?: string;
}

export interface OnlinePaymentMethod {
  configId: string;
  gatewayType: string;
  label: string;
  displayName: string;
}

export interface CheckoutPaymentOptions {
  manual: DisplayInstructions[];
  online: OnlinePaymentMethod[];
}

export interface StkPushRequest {
  phoneNumber?: string;
  configId?: string;
}

export interface StkPushResponse {
  accepted: boolean;
  gatewayType: string;
  checkoutRequestId: string;
  message: string;
}

export interface PaymentStatusResponse {
  orderStatus: string;
  paid: boolean;
  paymentFailed: boolean;
  checkoutRequestId?: string;
  failureReason?: string;
}

export async function fetchStorefront(slug: string): Promise<StorefrontResponse> {
  return publicApiRequest<StorefrontResponse>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/storefront`
  );
}

export async function fetchCategories(slug: string): Promise<CategoryListResponse> {
  return publicApiRequest<CategoryListResponse>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/catalog/categories`
  );
}

export type CatalogType = {
  id: string;
  label: string;
  icon?: string | null;
  itemCount?: number;
};

export type AirtimeConfig = {
  available: boolean;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  quickAmounts?: number[];
  reason?: string | null;
};

export async function fetchCatalogTypes(slug: string): Promise<{ types: CatalogType[] }> {
  return publicApiRequest<{ types: CatalogType[] }>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/catalog/types`
  );
}

export async function fetchAirtimeConfig(slug: string): Promise<AirtimeConfig | null> {
  try {
    return await publicApiRequest<AirtimeConfig>(
      API_BASE_URL,
      'GET',
      `/api/v1/public/businesses/${slug}/airtime`
    );
  } catch {
    return null;
  }
}

export async function fetchItems(
  slug: string,
  options: {
    categoryId?: string;
    typeId?: string;
    cursor?: string;
    limit?: number;
    search?: string;
  } = {}
): Promise<CatalogListResponse & { totalCount?: number | null }> {
  const params: string[] = [];
  if (options.categoryId) params.push(`categoryId=${encodeURIComponent(options.categoryId)}`);
  if (options.typeId) params.push(`typeId=${encodeURIComponent(options.typeId)}`);
  if (options.cursor) params.push(`cursor=${encodeURIComponent(options.cursor)}`);
  if (options.limit) params.push(`limit=${encodeURIComponent(String(options.limit))}`);
  if (options.search) params.push(`q=${encodeURIComponent(options.search)}`);

  const query = params.length ? `?${params.join('&')}` : '';
  const path = `/api/v1/public/businesses/${slug}/catalog/items${query}`;

  return publicApiRequest<CatalogListResponse>(API_BASE_URL, 'GET', path);
}

export async function fetchProduct(slug: string, itemId: string): Promise<ProductDetailResponse> {
  return publicApiRequest<ProductDetailResponse>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/catalog/items/${itemId}`
  );
}

export async function createCart(slug: string): Promise<CartResponse> {
  return publicApiRequest<CartResponse>(
    API_BASE_URL,
    'POST',
    `/api/v1/public/businesses/${slug}/carts`
  );
}

export async function addCartLine(
  slug: string,
  cartId: string,
  line: UpsertCartLineRequest
): Promise<CartResponse> {
  return publicApiRequest<CartResponse>(
    API_BASE_URL,
    'POST',
    `/api/v1/public/businesses/${slug}/carts/${cartId}/lines`,
    { body: line }
  );
}

export async function getCart(slug: string, cartId: string): Promise<CartResponse> {
  return publicApiRequest<CartResponse>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/carts/${cartId}`
  );
}

export async function submitCheckout(
  slug: string,
  cartId: string,
  request: CheckoutRequest
): Promise<CheckoutResponse> {
  return publicApiRequest<CheckoutResponse>(
    API_BASE_URL,
    'POST',
    `/api/v1/public/businesses/${slug}/carts/${cartId}/checkout`,
    { body: request }
  );
}

export async function fetchPaymentOptions(slug: string): Promise<CheckoutPaymentOptions> {
  return publicApiRequest<CheckoutPaymentOptions>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/payments/checkout-options`
  );
}

export async function initiateStkPush(
  slug: string,
  orderId: string,
  request: StkPushRequest
): Promise<StkPushResponse> {
  return publicApiRequest<StkPushResponse>(
    API_BASE_URL,
    'POST',
    `/api/v1/public/businesses/${slug}/orders/${orderId}/stk-push`,
    { body: request }
  );
}

export async function fetchPaymentStatus(
  slug: string,
  orderId: string
): Promise<PaymentStatusResponse> {
  return publicApiRequest<PaymentStatusResponse>(
    API_BASE_URL,
    'GET',
    `/api/v1/public/businesses/${slug}/orders/${orderId}/payment-status`
  );
}
