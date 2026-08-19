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
declare function fetchSuppliers(api: ApiClient): Promise<SupplierRecord[]>;
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
}): Promise<GrnSupplierInvoiceResult>;

declare function toNum(value: unknown): number;
/** "KES 1,250.50" — manual grouping so it works on any Hermes build. */
declare function formatMoney(amount: number): string;
declare function formatQty(value: number | string | null | undefined): string;

declare function OrdersScreen({ api, branchId }: {
    api: ApiClient;
    branchId: string;
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

export { type GoodsReceiptResult, type GrnSupplierInvoiceResult, OrdersScreen, type PurchaseOrderDetail, type PurchaseOrderLine, type PurchaseOrderListRow, ReceiveOrderScreen, ReceiveScreen, type SupplierItemLinkRecord, type SupplierRecord, addPurchaseOrderLine, cancelPurchaseOrder, createPurchaseOrder, fetchPurchaseOrder, fetchPurchaseOrders, fetchSupplierItemLinks, fetchSuppliers, formatMoney, formatQty, postGoodsReceipt, postGrnSupplierInvoice, sendPurchaseOrder, sendPurchaseOrderToSupplier, toNum };
