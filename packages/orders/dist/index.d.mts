import { ApiClient } from '@kiosk/core';
import * as react_jsx_runtime from 'react/jsx-runtime';

type SupplierRecord = {
    id: string;
    name: string;
    code: string | null;
    supplierType: string;
    status: string;
    notes: string | null;
    deletedAt?: string | null;
};
/** Response from GET /api/v1/suppliers/{id}/item-links */
type SupplierItemLinkRecord = {
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
type PurchaseOrderLine = {
    id: string;
    sortOrder: number;
    itemId: string;
    itemName?: string | null;
    qtyOrdered: number | string;
    qtyReceived: number | string;
    unitEstimatedCost: number | string;
};
type PurchaseOrderDetail = {
    id: string;
    supplierId: string;
    branchId: string;
    poNumber: string;
    expectedDate: string;
    status: string;
    notes: string | null;
    lines: PurchaseOrderLine[];
};
type PurchaseOrderListRow = {
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
type GoodsReceiptResult = {
    goodsReceiptId: string;
    grniAmount: number | string;
    lineCount: number;
};
type GrnSupplierInvoiceResult = {
    supplierInvoiceId: string;
    invoiceNumber: string;
    journalEntryId: string;
    grandTotal: number | string;
};
declare function fetchSuppliers(api: ApiClient, opts?: {
    itemTypeIds?: readonly string[];
}): Promise<SupplierRecord[]>;
declare function fetchSupplierItemLinks(api: ApiClient, supplierId: string, opts?: {
    branchId?: string | null;
}): Promise<SupplierItemLinkRecord[]>;
declare function fetchPurchaseOrders(api: ApiClient, opts?: {
    supplierId?: string;
    status?: string;
}): Promise<PurchaseOrderListRow[]>;
declare function fetchPurchaseOrder(api: ApiClient, purchaseOrderId: string): Promise<PurchaseOrderDetail>;
declare function createPurchaseOrder(api: ApiClient, body: {
    supplierId: string;
    branchId: string;
    expectedDate?: string | null;
    poNumber?: string | null;
    notes?: string | null;
}): Promise<PurchaseOrderDetail>;
declare function addPurchaseOrderLine(api: ApiClient, purchaseOrderId: string, body: {
    itemId: string;
    qtyOrdered: number | string;
    unitEstimatedCost: number | string;
}): Promise<PurchaseOrderLine>;
declare function sendPurchaseOrder(api: ApiClient, purchaseOrderId: string): Promise<PurchaseOrderDetail>;
declare function sendPurchaseOrderToSupplier(api: ApiClient, purchaseOrderId: string): Promise<PurchaseOrderDetail>;
declare function cancelPurchaseOrder(api: ApiClient, purchaseOrderId: string): Promise<PurchaseOrderDetail>;
declare function postGoodsReceipt(api: ApiClient, body: {
    purchaseOrderId: string;
    branchId: string;
    receivedAt: string;
    notes?: string | null;
    lines: {
        purchaseOrderLineId: string;
        qtyReceived: number;
    }[];
}, 
/**
 * The key the server remembers this receipt by. Without one a new key is made for every call, so a second call is a
 * second receipt; a screen that may send the same receipt again passes the one key for the whole attempt.
 */
opts?: {
    idempotencyKey?: string;
}): Promise<GoodsReceiptResult>;
declare function postGrnSupplierInvoice(api: ApiClient, goodsReceiptId: string, body: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string | null;
    lines: {
        itemId: string;
        qty: number;
        unitCost: number;
        lineTotal: number;
    }[];
}, 
/** The key the server remembers this invoice by; see `postGoodsReceipt`. */
opts?: {
    idempotencyKey?: string;
}): Promise<GrnSupplierInvoiceResult>;

type TillPrintCashier = {
    id: string;
    name: string;
};
type TillPrintSlipLine = {
    name: string;
    qty: number;
    unitCost: number;
    lineTotal: number;
};
type TillPrintSlip = {
    reference: string;
    supplierName?: string | null;
    businessName?: string | null;
    branchName?: string | null;
    placedByName?: string | null;
    currency?: string | null;
    lines: TillPrintSlipLine[];
};
type TillPrintTarget = {
    userId: string;
    name: string;
    online: boolean;
};
type DispatchTillPrintResult = {
    jobIds: string[];
    tills: TillPrintTarget[];
};
declare function fetchTillCashiers(api: ApiClient, branchId?: string | null): Promise<TillPrintCashier[]>;
declare function dispatchTillPrint(api: ApiClient, body: {
    kind: 'order' | 'receipt';
    branchId?: string | null;
    targetUserIds: string[];
    slip: TillPrintSlip;
}): Promise<DispatchTillPrintResult>;
type TillPrintPendingJob = {
    id: string;
    kind: 'order' | 'receipt' | string;
    reference: string;
    createdAt?: string | null;
    slip: TillPrintSlip;
};
declare function fetchPendingTillPrints(api: ApiClient): Promise<TillPrintPendingJob[]>;
declare function claimTillPrint(api: ApiClient, jobId: string): Promise<void>;

declare function toNum(value: unknown): number;
/** "KES 1,250.50" — manual grouping so it works on any Hermes build. */
declare function formatMoney(amount: number): string;
declare function formatQty(value: number | string | null | undefined): string;

/**
 * What to tell the clerk after an order/receipt slip was queued for one or more
 * tills (web `describeTillSend`).
 */
declare function describeTillSend(kind: 'order' | 'receipt', tills: readonly TillPrintTarget[]): string;

/**
 * Purchase-order / goods-receipt slip bytes for a thermal printer.
 * Same layout as web `frontend/lib/till-slip.ts` so desk and phone slips match.
 */
type TillSlipKind = 'order' | 'receipt';
type TillSlipLine = {
    name: string;
    qty: number;
    unitCost: number;
    lineTotal: number;
};
type TillSlip = {
    reference: string;
    supplierName?: string | null;
    businessName?: string | null;
    branchName?: string | null;
    placedByName?: string | null;
    currency?: string | null;
    lines: TillSlipLine[];
};
/** `widthMm` 58 → 32 cols, 80 → 48 cols (matches grocery/cashier paper widths). */
declare function buildTillSlipEscPos(slip: TillSlip, kind: TillSlipKind, widthMm?: number): Uint8Array;

declare function OrdersScreen({ api, branchId, itemTypeIds, shopName, branchName, clerkName, printLocal, hasLocalPrinter, }: {
    api: ApiClient;
    branchId: string;
    /**
     * When set, only suppliers (and links) for these departments. Pass `[]` for
     * an explicit empty scope (grocery clerk with no assignments).
     */
    itemTypeIds?: readonly string[];
    /** Shop name on the till slip. */
    shopName?: string | null;
    /** Branch name on the till slip. */
    branchName?: string | null;
    /** Who placed the order — shown on the till slip. */
    clerkName?: string | null;
    /**
     * Print the slip on this phone's paired thermal printer (grocery clerk BLE).
     * When set, Review order shows "Print here".
     */
    printLocal?: (slip: {
        reference: string;
        supplierName: string;
        lines: TillPrintSlipLine[];
        businessName: string;
        branchName: string;
        placedByName: string;
    }) => Promise<void>;
    /** True when a printer is paired so "Print here" is offered. */
    hasLocalPrinter?: boolean;
}): react_jsx_runtime.JSX.Element;

type Props$1 = {
    api: ApiClient;
    /** Called when the user taps an open purchase order. */
    onOpenOrder: (purchaseOrderId: string) => void;
};
declare function ReceiveScreen({ api, onOpenOrder }: Props$1): react_jsx_runtime.JSX.Element;

type Props = {
    api: ApiClient;
    branchId: string;
    purchaseOrderId: string;
    /** Called when the user finishes (confirm receipt or cancel) and leaves the screen. */
    onDone: () => void;
};
declare function ReceiveOrderScreen({ api, branchId, purchaseOrderId, onDone }: Props): react_jsx_runtime.JSX.Element;

export { type DispatchTillPrintResult, type GoodsReceiptResult, type GrnSupplierInvoiceResult, OrdersScreen, type PurchaseOrderDetail, type PurchaseOrderLine, type PurchaseOrderListRow, ReceiveOrderScreen, ReceiveScreen, type SupplierItemLinkRecord, type SupplierRecord, type TillPrintCashier, type TillPrintPendingJob, type TillPrintSlip, type TillPrintSlipLine, type TillPrintTarget, type TillSlip, type TillSlipKind, type TillSlipLine, addPurchaseOrderLine, buildTillSlipEscPos, cancelPurchaseOrder, claimTillPrint, createPurchaseOrder, describeTillSend, dispatchTillPrint, fetchPendingTillPrints, fetchPurchaseOrder, fetchPurchaseOrders, fetchSupplierItemLinks, fetchSuppliers, fetchTillCashiers, formatMoney, formatQty, postGoodsReceipt, postGrnSupplierInvoice, sendPurchaseOrder, sendPurchaseOrderToSupplier, toNum };
