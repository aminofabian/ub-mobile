import type { ApiClient } from '@kiosk/core';

// ---- Record shapes (mirror frontend/lib/api.ts) ----

export type SupplierRecord = {
  id: string;
  name: string;
  code: string | null;
  supplierType: string;
  status: string;
  notes: string | null;
  deletedAt?: string | null;
};

/** Response from GET /api/v1/suppliers/{id}/item-links */
export type SupplierItemLinkRecord = {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  barcode?: string | null;
  thumbnailUrl?: string | null;
  currentStock?: number | string | null;
  primary: boolean;
  supplierSku?: string | null;
  defaultCostPrice?: number | string | null;
  lastCostPrice?: number | string | null;
  catalogBuyingPrice?: number | string | null;
  reorderLevel?: number | string | null;
  packSize?: number | string | null;
  packUnit?: string | null;
  active: boolean;
  variantOfItemId?: string | null;
  parentItemName?: string | null;
  variantName?: string | null;
  /** Catalog department (item type) of the linked item. */
  itemTypeId?: string | null;
};

export type PurchaseOrderLine = {
  id: string;
  sortOrder: number;
  itemId: string;
  itemName?: string | null;
  qtyOrdered: number | string;
  qtyReceived: number | string;
  unitEstimatedCost: number | string;
};

export type PurchaseOrderDetail = {
  id: string;
  supplierId: string;
  branchId: string;
  poNumber: string;
  expectedDate: string;
  status: string;
  notes: string | null;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderListRow = {
  id: string;
  supplierId: string;
  branchId: string;
  poNumber: string;
  expectedDate: string;
  status: string;
  lineCount: number;
  totalOrdered: number | string;
  totalReceived: number | string;
};

export type GoodsReceiptResult = {
  goodsReceiptId: string;
  grniAmount: number | string;
  lineCount: number;
};

export type GrnSupplierInvoiceResult = {
  supplierInvoiceId: string;
  invoiceNumber: string;
  journalEntryId: string;
  grandTotal: number | string;
};

type ItemsPageResult<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
};

const PURCHASE_ORDERS = '/api/v1/purchasing/path-a/purchase-orders';
const GOODS_RECEIPTS = '/api/v1/purchasing/path-a/goods-receipts';

function enc(value: string): string {
  return encodeURIComponent(value.trim());
}

// ---- Suppliers ----

export async function fetchSuppliers(
  api: ApiClient,
  opts?: { itemTypeIds?: readonly string[] }
): Promise<SupplierRecord[]> {
  const parts = ['page=0', 'size=100'];
  if (opts?.itemTypeIds !== undefined) {
    for (const id of opts.itemTypeIds) {
      const trimmed = id?.trim();
      if (trimmed) parts.push(`itemTypeIds=${encodeURIComponent(trimmed)}`);
    }
    if (opts.itemTypeIds.length === 0) {
      parts.push('itemTypeIds=');
    }
  }
  const page = await api.get<ItemsPageResult<SupplierRecord>>(
    `/api/v1/suppliers?${parts.join('&')}`
  );
  return page.content;
}

export async function fetchSupplierItemLinks(
  api: ApiClient,
  supplierId: string,
  opts?: { branchId?: string | null }
): Promise<SupplierItemLinkRecord[]> {
  const branchId = opts?.branchId?.trim();
  const q =
    branchId != null && branchId !== ''
      ? `?branchId=${encodeURIComponent(branchId)}`
      : '';
  return api.get<SupplierItemLinkRecord[]>(
    `/api/v1/suppliers/${enc(supplierId)}/item-links${q}`
  );
}

// ---- Purchase orders ----

export async function fetchPurchaseOrders(
  api: ApiClient,
  opts?: { supplierId?: string; status?: string }
): Promise<PurchaseOrderListRow[]> {
  const params: string[] = [];
  const supplierId = opts?.supplierId?.trim();
  const status = opts?.status?.trim();
  if (supplierId) params.push(`supplierId=${encodeURIComponent(supplierId)}`);
  if (status) params.push(`status=${encodeURIComponent(status)}`);
  const qs = params.length ? `?${params.join('&')}` : '';
  return api.get<PurchaseOrderListRow[]>(`${PURCHASE_ORDERS}${qs}`);
}

export async function fetchPurchaseOrder(
  api: ApiClient,
  purchaseOrderId: string
): Promise<PurchaseOrderDetail> {
  return api.get<PurchaseOrderDetail>(`${PURCHASE_ORDERS}/${enc(purchaseOrderId)}`);
}

export async function createPurchaseOrder(
  api: ApiClient,
  body: {
    supplierId: string;
    branchId: string;
    expectedDate?: string | null;
    poNumber?: string | null;
    notes?: string | null;
  }
): Promise<PurchaseOrderDetail> {
  return api.post<PurchaseOrderDetail>(PURCHASE_ORDERS, body);
}

export async function addPurchaseOrderLine(
  api: ApiClient,
  purchaseOrderId: string,
  body: { itemId: string; qtyOrdered: number | string; unitEstimatedCost: number | string }
): Promise<PurchaseOrderLine> {
  return api.post<PurchaseOrderLine>(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/lines`,
    body
  );
}

export async function sendPurchaseOrder(
  api: ApiClient,
  purchaseOrderId: string
): Promise<PurchaseOrderDetail> {
  return api.post<PurchaseOrderDetail>(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/send`,
    {}
  );
}

export async function sendPurchaseOrderToSupplier(
  api: ApiClient,
  purchaseOrderId: string
): Promise<PurchaseOrderDetail> {
  return api.post<PurchaseOrderDetail>(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/send-to-supplier`,
    {}
  );
}

export async function cancelPurchaseOrder(
  api: ApiClient,
  purchaseOrderId: string
): Promise<PurchaseOrderDetail> {
  return api.post<PurchaseOrderDetail>(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/cancel`,
    {}
  );
}

// ---- Goods receipt ----

export async function postGoodsReceipt(
  api: ApiClient,
  body: {
    purchaseOrderId: string;
    branchId: string;
    receivedAt: string;
    notes?: string | null;
    lines: { purchaseOrderLineId: string; qtyReceived: number }[];
  },
  /**
   * The key the server remembers this receipt by. Without one a new key is made for every call, so a second call is a
   * second receipt; a screen that may send the same receipt again passes the one key for the whole attempt.
   */
  opts?: { idempotencyKey?: string }
): Promise<GoodsReceiptResult> {
  return api.post<GoodsReceiptResult>(GOODS_RECEIPTS, body, {
    idempotent: true,
    ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
  });
}

export async function postGrnSupplierInvoice(
  api: ApiClient,
  goodsReceiptId: string,
  body: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string | null;
    lines: { itemId: string; qty: number; unitCost: number; lineTotal: number }[];
  },
  /** The key the server remembers this invoice by; see `postGoodsReceipt`. */
  opts?: { idempotencyKey?: string }
): Promise<GrnSupplierInvoiceResult> {
  return api.post<GrnSupplierInvoiceResult>(
    `${GOODS_RECEIPTS}/${enc(goodsReceiptId)}/supplier-invoice`,
    body,
    { idempotent: true, ...(opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}) }
  );
}
