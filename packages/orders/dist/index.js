"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  OrdersScreen: () => OrdersScreen,
  ReceiveOrderScreen: () => ReceiveOrderScreen,
  ReceiveScreen: () => ReceiveScreen,
  addPurchaseOrderLine: () => addPurchaseOrderLine,
  cancelPurchaseOrder: () => cancelPurchaseOrder,
  createPurchaseOrder: () => createPurchaseOrder,
  fetchPurchaseOrder: () => fetchPurchaseOrder,
  fetchPurchaseOrders: () => fetchPurchaseOrders,
  fetchSupplierItemLinks: () => fetchSupplierItemLinks,
  fetchSuppliers: () => fetchSuppliers,
  formatMoney: () => formatMoney,
  formatQty: () => formatQty,
  postGoodsReceipt: () => postGoodsReceipt,
  postGrnSupplierInvoice: () => postGrnSupplierInvoice,
  sendPurchaseOrder: () => sendPurchaseOrder,
  sendPurchaseOrderToSupplier: () => sendPurchaseOrderToSupplier,
  toNum: () => toNum
});
module.exports = __toCommonJS(index_exports);

// src/api/purchasing.ts
var PURCHASE_ORDERS = "/api/v1/purchasing/path-a/purchase-orders";
var GOODS_RECEIPTS = "/api/v1/purchasing/path-a/goods-receipts";
function enc(value) {
  return encodeURIComponent(value.trim());
}
async function fetchSuppliers(api) {
  const page = await api.get(
    "/api/v1/suppliers?page=0&size=100"
  );
  return page.content;
}
async function fetchSupplierItemLinks(api, supplierId, opts) {
  const branchId = opts?.branchId?.trim();
  const q = branchId != null && branchId !== "" ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return api.get(
    `/api/v1/suppliers/${enc(supplierId)}/item-links${q}`
  );
}
async function fetchPurchaseOrders(api, opts) {
  const params = [];
  const supplierId = opts?.supplierId?.trim();
  const status = opts?.status?.trim();
  if (supplierId) params.push(`supplierId=${encodeURIComponent(supplierId)}`);
  if (status) params.push(`status=${encodeURIComponent(status)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  return api.get(`${PURCHASE_ORDERS}${qs}`);
}
async function fetchPurchaseOrder(api, purchaseOrderId) {
  return api.get(`${PURCHASE_ORDERS}/${enc(purchaseOrderId)}`);
}
async function createPurchaseOrder(api, body) {
  return api.post(PURCHASE_ORDERS, body);
}
async function addPurchaseOrderLine(api, purchaseOrderId, body) {
  return api.post(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/lines`,
    body
  );
}
async function sendPurchaseOrder(api, purchaseOrderId) {
  return api.post(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/send`,
    {}
  );
}
async function sendPurchaseOrderToSupplier(api, purchaseOrderId) {
  return api.post(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/send-to-supplier`,
    {}
  );
}
async function cancelPurchaseOrder(api, purchaseOrderId) {
  return api.post(
    `${PURCHASE_ORDERS}/${enc(purchaseOrderId)}/cancel`,
    {}
  );
}
async function postGoodsReceipt(api, body) {
  return api.post(GOODS_RECEIPTS, body, { idempotent: true });
}
async function postGrnSupplierInvoice(api, goodsReceiptId, body) {
  return api.post(
    `${GOODS_RECEIPTS}/${enc(goodsReceiptId)}/supplier-invoice`,
    body,
    { idempotent: true }
  );
}

// src/lib/format.ts
function toNum(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function formatMoney(amount) {
  const negative = amount < 0;
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, cents] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}KES ${grouped}.${cents}`;
}
function formatQty(value) {
  const n = toNum(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// src/screens/OrdersScreen.tsx
var import_react = require("react");
var import_react_native = require("react-native");
var import_ui = require("@kiosk/ui");
var import_offline = require("@kiosk/offline");
var import_jsx_runtime = require("react/jsx-runtime");
function unitCost(link) {
  const candidates = [link.lastCostPrice, link.defaultCostPrice, link.catalogBuyingPrice];
  for (const c of candidates) {
    const n = toNum(c);
    if (n > 0) return n;
  }
  return 0;
}
function linkParentId(link) {
  const variantOf = link.variantOfItemId?.trim();
  if (variantOf) return variantOf;
  const parentName = link.parentItemName?.trim();
  if (parentName) return `name:${parentName.toLowerCase().trim()}`;
  const name = link.itemName?.trim() || "";
  const sep = name.indexOf(" \xB7 ");
  if (sep > 0) return `name:${name.slice(0, sep).toLowerCase().trim()}`;
  if (name) return `name:${name.toLowerCase().trim()}`;
  return link.itemId;
}
function linkParentLabel(link) {
  const parent = link.parentItemName?.trim();
  if (parent) return parent;
  const name = link.itemName?.trim() || link.sku?.trim() || "Product";
  const sep = name.indexOf(" \xB7 ");
  return sep > 0 ? name.slice(0, sep) : name;
}
function OrdersScreen({ api, branchId }) {
  const [suppliers, setSuppliers] = (0, import_react.useState)([]);
  const [supplierId, setSupplierId] = (0, import_react.useState)(null);
  const [links, setLinks] = (0, import_react.useState)([]);
  const [loadingSuppliers, setLoadingSuppliers] = (0, import_react.useState)(true);
  const [loadingLinks, setLoadingLinks] = (0, import_react.useState)(false);
  const [filter, setFilter] = (0, import_react.useState)("");
  const [parentFilterId, setParentFilterId] = (0, import_react.useState)(null);
  const [cartsBySupplier, setCartsBySupplier] = (0, import_react.useState)({});
  const [supplierPickerOpen, setSupplierPickerOpen] = (0, import_react.useState)(false);
  const [supplierQuery, setSupplierQuery] = (0, import_react.useState)("");
  const [cartOpen, setCartOpen] = (0, import_react.useState)(false);
  const [notes, setNotes] = (0, import_react.useState)("");
  const [placing, setPlacing] = (0, import_react.useState)(false);
  const [hydrated, setHydrated] = (0, import_react.useState)(false);
  const cart = cartsBySupplier[supplierId ?? ""] ?? {};
  const draftKey = (0, import_react.useMemo)(() => `stock/order-carts/${branchId}`, [branchId]);
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    void import_offline.cache.get(draftKey).then((draft) => {
      if (cancelled) return;
      setCartsBySupplier(draft ?? {});
      setHydrated(true);
    }).catch(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    setLoadingSuppliers(true);
    void fetchSuppliers(api).then((rows) => {
      if (cancelled) return;
      const active = rows.filter(
        (s) => s.status?.toLowerCase() === "active" && !s.deletedAt
      );
      setSuppliers(active);
      setSupplierId((current) => {
        if (current && active.some((s) => s.id === current)) return current;
        return active[0]?.id ?? null;
      });
    }).catch((error) => {
      if (!cancelled) {
        import_react_native.Alert.alert("Error", error instanceof Error ? error.message : "Failed to load suppliers");
      }
    }).finally(() => {
      if (!cancelled) setLoadingSuppliers(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);
  (0, import_react.useEffect)(() => {
    if (!supplierId) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setLoadingLinks(true);
    void fetchSupplierItemLinks(api, supplierId, { branchId }).then((rows) => {
      if (!cancelled) setLinks(rows.filter((r) => r.active));
    }).catch((error) => {
      if (!cancelled) {
        setLinks([]);
        import_react_native.Alert.alert("Error", error instanceof Error ? error.message : "Failed to load products");
      }
    }).finally(() => {
      if (!cancelled) setLoadingLinks(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId, api, branchId]);
  (0, import_react.useEffect)(() => {
    setParentFilterId(null);
  }, [supplierId]);
  (0, import_react.useEffect)(() => {
    if (!hydrated) return;
    void import_offline.cache.set(draftKey, cartsBySupplier).catch(() => {
    });
  }, [cartsBySupplier, hydrated, draftKey]);
  const selectSupplier = (nextId) => {
    if (nextId === supplierId) {
      setSupplierPickerOpen(false);
      return;
    }
    setSupplierId(nextId);
    setSupplierPickerOpen(false);
  };
  const activeSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const filteredSuppliers = (0, import_react.useMemo)(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);
  const families = (0, import_react.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    for (const link of links) {
      const id = linkParentId(link);
      const existing = map.get(id);
      const stock = toNum(link.currentStock);
      const reorder = toNum(link.reorderLevel);
      const low = reorder > 0 && stock <= reorder;
      if (existing) {
        existing.links.push(link);
        if (low) existing.lowStockCount += 1;
      } else {
        map.set(id, {
          id,
          label: linkParentLabel(link),
          links: [link],
          lowStockCount: low ? 1 : 0
        });
      }
    }
    return [...map.values()];
  }, [links]);
  const visibleFamilies = (0, import_react.useMemo)(() => {
    const q = filter.trim().toLowerCase();
    let rows = families;
    if (q) {
      rows = families.map((f) => ({
        ...f,
        links: f.links.filter(
          (l) => l.itemName.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q) || (l.barcode ?? "").toLowerCase().includes(q)
        )
      })).filter((f) => f.links.length > 0);
    }
    if (parentFilterId) {
      rows = rows.filter((f) => f.id === parentFilterId);
    }
    return rows;
  }, [families, filter, parentFilterId]);
  const sections = (0, import_react.useMemo)(
    () => visibleFamilies.map((f) => ({ title: f.label, data: f.links })),
    [visibleFamilies]
  );
  const cartLines = (0, import_react.useMemo)(
    () => links.filter((l) => (cart[l.itemId] ?? 0) > 0).map((l) => ({ link: l, qty: cart[l.itemId] ?? 0 })),
    [links, cart]
  );
  const cartUnits = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + unitCost(line.link) * line.qty, 0);
  const setQty = (itemId, qty) => {
    setCartsBySupplier((prevMap) => {
      const current = { ...prevMap[supplierId ?? ""] ?? {} };
      if (qty <= 0) delete current[itemId];
      else current[itemId] = qty;
      const next = { ...prevMap };
      if (Object.keys(current).length === 0) delete next[supplierId ?? ""];
      else next[supplierId ?? ""] = current;
      return next;
    });
  };
  const placeOrder = async () => {
    if (!supplierId || !activeSupplier) {
      import_react_native.Alert.alert("Missing supplier", "Pick a supplier first.");
      return;
    }
    if (!branchId.trim()) {
      import_react_native.Alert.alert("Missing branch", "Select a branch before ordering.");
      return;
    }
    if (cartLines.length === 0) {
      import_react_native.Alert.alert("Empty order", "Add products to the order.");
      return;
    }
    setPlacing(true);
    try {
      const po = await createPurchaseOrder(api, {
        supplierId,
        branchId: branchId.trim(),
        notes: notes.trim() || "Created from Order mobile"
      });
      for (const line of cartLines) {
        await addPurchaseOrderLine(api, po.id, {
          itemId: line.link.itemId,
          qtyOrdered: line.qty,
          unitEstimatedCost: unitCost(line.link)
        });
      }
      try {
        await sendPurchaseOrderToSupplier(api, po.id);
      } catch {
        await sendPurchaseOrder(api, po.id);
      }
      setCartsBySupplier((prevMap) => {
        const next = { ...prevMap };
        delete next[supplierId];
        return next;
      });
      setCartOpen(false);
      import_react_native.Alert.alert(
        "Order placed",
        `Order ${po.poNumber} placed \u2014 confirm when goods arrive.`
      );
    } catch (error) {
      import_react_native.Alert.alert("Error", error instanceof Error ? error.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_react_native.Pressable,
      {
        style: styles.supplierBar,
        onPress: () => setSupplierPickerOpen(true),
        accessibilityRole: "button",
        accessibilityLabel: "Choose supplier",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.supplierBarText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "caption", style: styles.supplierLabel, children: "Supplier" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.supplierName, children: activeSupplier?.name ?? (loadingSuppliers ? "Loading\u2026" : "No suppliers") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.supplierCaret, children: "\u25BE" })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.TextInput,
      {
        style: styles.search,
        placeholder: "Search products or SKU",
        value: filter,
        onChangeText: setFilter,
        autoCorrect: false,
        autoCapitalize: "none"
      }
    ),
    families.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_react_native.ScrollView,
      {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        style: styles.chips,
        contentContainerStyle: styles.chipsContent,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            Chip,
            {
              label: "All",
              lowCount: null,
              active: parentFilterId === null,
              onPress: () => setParentFilterId(null)
            }
          ),
          families.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            Chip,
            {
              label: f.label,
              lowCount: f.lowStockCount,
              active: parentFilterId === f.id,
              onPress: () => setParentFilterId(f.id === parentFilterId ? null : f.id)
            },
            f.id
          ))
        ]
      }
    ),
    loadingLinks || loadingSuppliers ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.center, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.ActivityIndicator, { size: "large", color: import_ui.theme.colors.primary }) }) : sections.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.center, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "muted", children: links.length === 0 ? "No products linked to this supplier" : "No matching products" }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.SectionList,
      {
        sections,
        keyExtractor: (item) => item.itemId,
        stickySectionHeadersEnabled: false,
        renderSectionHeader: ({ section }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.sectionHeader, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "caption", style: styles.sectionTitle, children: section.title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "muted", children: section.data.length })
        ] }),
        renderItem: ({ item }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          ItemRow,
          {
            link: item,
            qty: cart[item.itemId] ?? 0,
            onChange: (qty) => setQty(item.itemId, qty)
          }
        ),
        ListFooterComponent: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: { height: 96 } }),
        contentContainerStyle: styles.listContent
      }
    ),
    cartUnits > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.cartBar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_ui.Text, { variant: "body", style: styles.cartBarQty, children: [
          cartUnits,
          " ",
          cartUnits === 1 ? "item" : "items"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "caption", style: styles.cartBarTotal, children: formatMoney(cartTotal) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Button, { title: "Review order", onPress: () => setCartOpen(true) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.Modal,
      {
        visible: supplierPickerOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setSupplierPickerOpen(false),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.modalOverlay, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.modalSheet, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.modalHeader, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "h2", children: "Choose supplier" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Pressable, { onPress: () => setSupplierPickerOpen(false), accessibilityRole: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.modalClose, children: "Close" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_react_native.TextInput,
            {
              style: styles.search,
              placeholder: "Search suppliers",
              value: supplierQuery,
              onChangeText: setSupplierQuery,
              autoCorrect: false
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_react_native.FlatList,
            {
              data: filteredSuppliers,
              keyExtractor: (s) => s.id,
              renderItem: ({ item }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                import_react_native.Pressable,
                {
                  style: styles.supplierRow,
                  onPress: () => selectSupplier(item.id),
                  accessibilityRole: "button",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.supplierRowText, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", children: item.name }),
                      item.code ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "muted", children: item.code }) : null
                    ] }),
                    item.id === supplierId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.check, children: "\u2713" }) : null
                  ]
                }
              ),
              ListEmptyComponent: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.center, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "muted", children: "No suppliers" }) })
            }
          )
        ] }) })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.Modal,
      {
        visible: cartOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setCartOpen(false),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.modalOverlay, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.modalSheet, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.modalHeader, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "h2", children: "Review order" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Pressable, { onPress: () => setCartOpen(false), accessibilityRole: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.modalClose, children: "Close" }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "caption", style: styles.cartSupplier, children: activeSupplier?.name ?? "Supplier" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_react_native.FlatList,
            {
              data: cartLines,
              keyExtractor: (line) => line.link.itemId,
              renderItem: ({ item }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_ui.Card, { style: styles.cartLineCard, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.cartLineInfo, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", numberOfLines: 1, children: item.link.itemName }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_ui.Text, { variant: "muted", children: [
                    formatMoney(unitCost(item.link)),
                    " \xD7 ",
                    item.qty,
                    " =",
                    " ",
                    formatMoney(unitCost(item.link) * item.qty)
                  ] })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  Stepper,
                  {
                    qty: item.qty,
                    onChange: (qty) => setQty(item.link.itemId, qty)
                  }
                )
              ] }),
              style: styles.cartLines
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_react_native.TextInput,
            {
              style: styles.notes,
              placeholder: "Notes (optional)",
              value: notes,
              onChangeText: setNotes,
              multiline: true
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.cartFooter, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "caption", children: "Total" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "h2", children: formatMoney(cartTotal) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              import_ui.Button,
              {
                title: placing ? "Placing\u2026" : "Place order",
                onPress: () => void placeOrder(),
                disabled: placing || cartLines.length === 0
              }
            )
          ] })
        ] }) })
      }
    )
  ] });
}
function Chip({
  label,
  lowCount,
  active,
  onPress
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    import_react_native.Pressable,
    {
      style: [styles.chip, active && styles.chipActive],
      onPress,
      accessibilityRole: "button",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_ui.Text,
          {
            variant: "caption",
            style: active ? { ...styles.chipLabel, ...styles.chipLabelActive } : styles.chipLabel,
            numberOfLines: 1,
            children: label
          }
        ),
        lowCount != null && lowCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.chipDot, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { style: styles.chipDotText, children: lowCount }) }) : null
      ]
    }
  );
}
function ItemRow({
  link,
  qty,
  onChange
}) {
  const stock = toNum(link.currentStock);
  const reorder = toNum(link.reorderLevel);
  const low = reorder > 0 && stock <= reorder;
  const cost = unitCost(link);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.itemRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.itemInfo, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", numberOfLines: 1, style: styles.itemName, children: link.itemName }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.itemMeta, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_ui.Text, { variant: "muted", children: [
          link.sku || "No SKU",
          link.packUnit ? ` \xB7 ${link.packUnit}` : ""
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_ui.Text,
          {
            variant: "caption",
            style: low ? { ...styles.stockPill, ...styles.stockLow } : { ...styles.stockPill, ...styles.stockOk },
            children: low ? `Low \xB7 ${stock}` : `${stock} in stock`
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_ui.Text, { variant: "caption", style: styles.itemCost, children: [
        formatMoney(cost),
        " ",
        reorder > 0 ? `\xB7 reorder at ${reorder}` : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stepper, { qty, onChange })
  ] });
}
function Stepper({ qty, onChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.stepper, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.Pressable,
      {
        style: [styles.stepperBtn, qty === 0 && styles.stepperBtnMuted],
        onPress: () => onChange(qty - 1),
        disabled: qty === 0,
        accessibilityRole: "button",
        accessibilityLabel: "Decrease quantity",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.stepperBtnText, children: "\u2212" })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.stepperQty, children: qty }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native.Pressable,
      {
        style: styles.stepperBtn,
        onPress: () => onChange(qty + 1),
        accessibilityRole: "button",
        accessibilityLabel: "Increase quantity",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { variant: "body", style: styles.stepperBtnText, children: "+" })
      }
    )
  ] });
}
var styles = import_react_native.StyleSheet.create({
  container: { flex: 1, backgroundColor: import_ui.theme.colors.background },
  supplierBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  supplierBarText: { flex: 1, marginRight: 8 },
  supplierLabel: { color: import_ui.theme.colors.textMuted },
  supplierName: { fontWeight: "600" },
  supplierCaret: { color: import_ui.theme.colors.textMuted, fontSize: 18 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: import_ui.theme.colors.border,
    borderRadius: import_ui.theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: import_ui.theme.colors.text,
    backgroundColor: import_ui.theme.colors.surface
  },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: import_ui.theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: import_ui.theme.colors.surface,
    maxWidth: 180
  },
  chipActive: { backgroundColor: import_ui.theme.colors.primary, borderColor: import_ui.theme.colors.primary },
  chipLabel: { color: import_ui.theme.colors.text },
  chipLabelActive: { color: "#ffffff", fontWeight: "600" },
  chipDot: {
    backgroundColor: import_ui.theme.colors.danger,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  chipDotText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 4
  },
  sectionTitle: { fontWeight: "700", color: import_ui.theme.colors.text },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: import_ui.theme.colors.background,
    borderRadius: import_ui.theme.borderRadius.md,
    borderWidth: 1,
    borderColor: import_ui.theme.colors.border,
    padding: 12,
    marginBottom: 8
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontWeight: "600" },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" },
  stockPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden"
  },
  stockOk: { backgroundColor: import_ui.theme.colors.success, color: "#ffffff" },
  stockLow: { backgroundColor: import_ui.theme.colors.danger, color: "#ffffff" },
  itemCost: { color: import_ui.theme.colors.textMuted, marginTop: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: import_ui.theme.colors.border,
    borderRadius: import_ui.theme.borderRadius.md,
    overflow: "hidden"
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: import_ui.theme.colors.surface
  },
  stepperBtnMuted: { opacity: 0.4 },
  stepperBtnText: { fontSize: 18, fontWeight: "600" },
  stepperQty: { minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] },
  cartBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: import_ui.theme.colors.primaryDark,
    borderRadius: import_ui.theme.borderRadius.lg,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6
  },
  cartBarQty: { color: "#ffffff", fontWeight: "700" },
  cartBarTotal: { color: "rgba(255,255,255,0.85)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: import_ui.theme.colors.background,
    borderTopLeftRadius: import_ui.theme.borderRadius.xl,
    borderTopRightRadius: import_ui.theme.borderRadius.xl,
    padding: 16,
    paddingBottom: 28,
    maxHeight: "85%",
    minHeight: "55%"
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  modalClose: { color: import_ui.theme.colors.primary, fontWeight: "600" },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: import_ui.theme.colors.border
  },
  supplierRowText: { flex: 1, marginRight: 8 },
  check: { color: import_ui.theme.colors.primary, fontWeight: "700" },
  cartSupplier: { color: import_ui.theme.colors.textMuted, marginBottom: 8 },
  cartLines: { flexGrow: 0 },
  cartLineCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingVertical: 10
  },
  cartLineInfo: { flex: 1, marginRight: 10 },
  notes: {
    borderWidth: 1,
    borderColor: import_ui.theme.colors.border,
    borderRadius: import_ui.theme.borderRadius.md,
    padding: 10,
    minHeight: 44,
    marginTop: 4,
    fontSize: 15,
    color: import_ui.theme.colors.text
  },
  cartFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12
  }
});

// src/screens/ReceiveScreen.tsx
var import_react2 = require("react");
var import_react_native2 = require("react-native");
var import_native = require("@react-navigation/native");
var import_ui2 = require("@kiosk/ui");
var import_jsx_runtime2 = require("react/jsx-runtime");
var STATUS_TONE = {
  sent: { bg: "#e0f2fe", fg: "#0369a1" },
  draft: { bg: "#fef3c7", fg: "#92400e" },
  completed: { bg: "#dcfce7", fg: "#166534" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b" }
};
function ReceiveScreen({ api, onOpenOrder }) {
  const [orders, setOrders] = (0, import_react2.useState)([]);
  const [suppliers, setSuppliers] = (0, import_react2.useState)([]);
  const [loading, setLoading] = (0, import_react2.useState)(true);
  const refresh = (0, import_react2.useCallback)(async () => {
    try {
      const [sent, draft, supplierRows] = await Promise.all([
        fetchPurchaseOrders(api, { status: "sent" }),
        fetchPurchaseOrders(api, { status: "draft" }),
        fetchSuppliers(api)
      ]);
      const open = [...sent, ...draft].filter((o) => toNum(o.totalOrdered) > toNum(o.totalReceived));
      open.sort((a, b) => b.poNumber.localeCompare(a.poNumber));
      setOrders(open);
      setSuppliers(supplierRows);
    } catch (error) {
      console.warn("Failed to load orders", error);
    } finally {
      setLoading(false);
    }
  }, [api]);
  (0, import_native.useFocusEffect)(
    (0, import_react2.useCallback)(() => {
      void refresh();
    }, [refresh])
  );
  const supplierName = (supplierId) => suppliers.find((s) => s.id === supplierId)?.name ?? "Supplier";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: styles2.container, children: loading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: styles2.center, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.ActivityIndicator, { size: "large", color: import_ui2.theme.colors.primary }) }) : orders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.center, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "muted", children: "No open orders." }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "muted", style: styles2.emptyHint, children: "Place an order first, then confirm here when goods arrive." })
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_react_native2.FlatList,
    {
      data: orders,
      keyExtractor: (o) => o.id,
      onRefresh: () => void refresh(),
      refreshing: false,
      contentContainerStyle: styles2.listContent,
      renderItem: ({ item }) => {
        const tone = STATUS_TONE[item.status] ?? { bg: import_ui2.theme.colors.surface, fg: import_ui2.theme.colors.textMuted };
        const remaining = toNum(item.totalOrdered) - toNum(item.totalReceived);
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_react_native2.Pressable,
          {
            onPress: () => onOpenOrder(item.id),
            accessibilityRole: "button",
            accessibilityLabel: `Open order ${item.poNumber}`,
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_ui2.Card, { style: styles2.card, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.cardHeader, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "body", style: styles2.poNumber, children: item.poNumber }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: [styles2.statusPill, { backgroundColor: tone.bg }], children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
                  import_ui2.Text,
                  {
                    variant: "caption",
                    style: { ...styles2.statusText, color: tone.fg },
                    children: item.status
                  }
                ) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "body", children: supplierName(item.supplierId) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.cardMeta, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_ui2.Text, { variant: "muted", children: [
                  item.lineCount,
                  " lines"
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_ui2.Text, { variant: "muted", children: [
                  formatQty(item.totalOrdered),
                  " ordered \xB7 ",
                  formatQty(remaining),
                  " to receive"
                ] })
              ] })
            ] })
          }
        );
      }
    }
  ) });
}
var styles2 = import_react_native2.StyleSheet.create({
  container: { flex: 1, backgroundColor: import_ui2.theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyHint: { marginTop: 8, textAlign: "center" },
  listContent: { padding: 16, paddingBottom: 24 },
  card: { marginBottom: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  poNumber: { fontWeight: "700" },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontWeight: "600", textTransform: "capitalize" },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", gap: 8 }
});

// src/screens/ReceiveOrderScreen.tsx
var import_react3 = require("react");
var import_react_native3 = require("react-native");
var import_ui3 = require("@kiosk/ui");
var import_jsx_runtime3 = require("react/jsx-runtime");
function todayIsoDate() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function round2(value) {
  return Math.round(value * 100) / 100;
}
function ReceiveOrderScreen({ api, branchId, purchaseOrderId, onDone }) {
  const [detail, setDetail] = (0, import_react3.useState)(null);
  const [itemMeta, setItemMeta] = (0, import_react3.useState)({});
  const [qtyByLine, setQtyByLine] = (0, import_react3.useState)({});
  const [selectedLines, setSelectedLines] = (0, import_react3.useState)({});
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [confirming, setConfirming] = (0, import_react3.useState)(false);
  const [cancelling, setCancelling] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPurchaseOrder(api, purchaseOrderId).then(async (po) => {
      if (cancelled) return;
      setDetail(po);
      const openLines2 = po.lines.filter(
        (l) => toNum(l.qtyOrdered) > toNum(l.qtyReceived)
      );
      const nextQty = {};
      const nextSel = {};
      for (const line of openLines2) {
        const remaining = toNum(line.qtyOrdered) - toNum(line.qtyReceived);
        nextQty[line.id] = remaining;
        nextSel[line.id] = true;
      }
      setQtyByLine(nextQty);
      setSelectedLines(nextSel);
      try {
        const links = await fetchSupplierItemLinks(api, po.supplierId, {
          branchId: po.branchId || branchId || void 0
        });
        if (cancelled) return;
        const map = {};
        for (const link of links) {
          map[link.itemId] = { name: link.itemName };
        }
        setItemMeta(map);
      } catch {
        if (!cancelled) setItemMeta({});
      }
    }).catch((error) => {
      if (!cancelled) {
        import_react_native3.Alert.alert("Error", error instanceof Error ? error.message : "Could not load order");
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseOrderId, api]);
  const openLines = (0, import_react3.useMemo)(
    () => (detail?.lines ?? []).filter((l) => toNum(l.qtyOrdered) > toNum(l.qtyReceived)),
    [detail]
  );
  const lineName = (0, import_react3.useCallback)(
    (line) => itemMeta[line.itemId]?.name ?? "Item",
    [itemMeta]
  );
  const selectedTotal = (0, import_react3.useMemo)(() => {
    let sum = 0;
    for (const line of openLines) {
      if (!selectedLines[line.id]) continue;
      sum += Math.max(0, qtyByLine[line.id] ?? 0) * toNum(line.unitEstimatedCost);
    }
    return sum;
  }, [openLines, selectedLines, qtyByLine]);
  const selectedUnits = (0, import_react3.useMemo)(() => {
    let sum = 0;
    for (const line of openLines) {
      if (!selectedLines[line.id]) continue;
      sum += Math.max(0, qtyByLine[line.id] ?? 0);
    }
    return sum;
  }, [openLines, selectedLines, qtyByLine]);
  const toggleLine = (lineId) => {
    const willSelect = !selectedLines[lineId];
    setSelectedLines((prev) => ({ ...prev, [lineId]: willSelect }));
    if (!willSelect) {
      setQtyByLine((q) => ({ ...q, [lineId]: 0 }));
    }
  };
  const setLineQty = (lineId, qty) => {
    setQtyByLine((prev) => ({ ...prev, [lineId]: Math.max(0, qty) }));
  };
  const confirmSelected = async () => {
    if (!detail) return;
    const lines = openLines.filter((l) => selectedLines[l.id]).map((l) => ({
      purchaseOrderLineId: l.id,
      qtyReceived: Math.max(0, qtyByLine[l.id] ?? 0),
      itemId: l.itemId,
      unitCost: toNum(l.unitEstimatedCost)
    })).filter((l) => l.qtyReceived > 0);
    if (lines.length === 0) {
      import_react_native3.Alert.alert("Nothing to confirm", "Select at least one line with quantity.");
      return;
    }
    const receiveBranch = detail.branchId || branchId;
    if (!receiveBranch.trim()) {
      import_react_native3.Alert.alert("Missing branch", "A branch is required to confirm.");
      return;
    }
    setConfirming(true);
    try {
      const grn = await postGoodsReceipt(api, {
        purchaseOrderId: detail.id,
        branchId: receiveBranch.trim(),
        receivedAt: (/* @__PURE__ */ new Date()).toISOString(),
        notes: `Confirmed from Order \xB7 ${detail.poNumber}`,
        lines: lines.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          qtyReceived: l.qtyReceived
        }))
      });
      const invoiceLines = lines.map((l) => ({
        itemId: l.itemId,
        qty: l.qtyReceived,
        unitCost: l.unitCost,
        lineTotal: round2(l.qtyReceived * l.unitCost)
      }));
      await postGrnSupplierInvoice(api, grn.goodsReceiptId, {
        invoiceNumber: `${detail.poNumber}-R${String(Date.now()).slice(-4)}`,
        invoiceDate: todayIsoDate(),
        lines: invoiceLines
      });
      import_react_native3.Alert.alert("Confirmed", "Order confirmed \u2014 stock updated.", [
        { text: "OK", onPress: onDone }
      ]);
    } catch (error) {
      import_react_native3.Alert.alert("Error", error instanceof Error ? error.message : "Could not confirm order");
    } finally {
      setConfirming(false);
    }
  };
  const cancelOrder = () => {
    if (!detail) return;
    import_react_native3.Alert.alert("Cancel order", `Cancel ${detail.poNumber}? This cannot be undone.`, [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: () => void runCancel(detail.id)
      }
    ]);
  };
  const runCancel = async (orderId) => {
    setCancelling(true);
    try {
      await cancelPurchaseOrder(api, orderId);
      import_react_native3.Alert.alert("Order cancelled", "The purchase order has been cancelled.", [
        { text: "OK", onPress: onDone }
      ]);
    } catch (error) {
      import_react_native3.Alert.alert("Error", error instanceof Error ? error.message : "Could not cancel order");
    } finally {
      setCancelling(false);
    }
  };
  const canCancel = detail ? detail.status === "draft" || detail.status === "sent" : false;
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.View, { style: styles3.center, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.ActivityIndicator, { size: "large", color: import_ui3.theme.colors.primary }) });
  }
  if (!detail) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.View, { style: styles3.center, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "muted", children: "Could not load this order." }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.headerText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "h2", children: detail.poNumber }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_ui3.Text, { variant: "muted", children: [
          "Status: ",
          detail.status
        ] })
      ] }),
      canCancel ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_ui3.Button,
        {
          title: cancelling ? "Cancelling\u2026" : "Cancel order",
          variant: "danger",
          onPress: cancelOrder,
          disabled: cancelling || confirming,
          style: styles3.cancelBtn
        }
      ) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_react_native3.FlatList,
      {
        data: openLines,
        keyExtractor: (l) => l.id,
        contentContainerStyle: styles3.listContent,
        ListHeaderComponent: openLines.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.View, { style: styles3.center, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "muted", children: "All lines on this order have been received." }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "caption", style: styles3.listHint, children: "Adjust quantities, then confirm what arrived." }),
        renderItem: ({ item }) => {
          const ordered = toNum(item.qtyOrdered);
          const received = toNum(item.qtyReceived);
          const remaining = ordered - received;
          const qty = Math.max(0, qtyByLine[item.id] ?? 0);
          const selected = !!selectedLines[item.id];
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            import_ui3.Card,
            {
              style: selected ? styles3.lineCard : { ...styles3.lineCard, ...styles3.lineCardMuted },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                  import_react_native3.Pressable,
                  {
                    style: styles3.lineMain,
                    onPress: () => toggleLine(item.id),
                    accessibilityRole: "checkbox",
                    accessibilityState: { checked: selected },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.View, { style: [styles3.checkbox, selected && styles3.checkboxOn], children: selected ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { style: styles3.checkboxCheck, children: "\u2713" }) : null }),
                      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.lineInfo, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "body", numberOfLines: 1, style: styles3.lineName, children: lineName(item) }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_ui3.Text, { variant: "muted", children: [
                          formatQty(received),
                          " of ",
                          formatQty(ordered),
                          " received \xB7 ",
                          formatQty(remaining),
                          " ",
                          "remaining"
                        ] }),
                        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_ui3.Text, { variant: "caption", style: styles3.lineCost, children: [
                          formatMoney(toNum(item.unitEstimatedCost)),
                          " / unit"
                        ] })
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.lineQty, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_react_native3.Pressable,
                    {
                      style: [styles3.qtyBtn, qty === 0 && styles3.qtyBtnMuted],
                      onPress: () => setLineQty(item.id, qty - 1),
                      disabled: qty === 0,
                      accessibilityRole: "button",
                      accessibilityLabel: "Decrease received quantity",
                      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "body", style: styles3.qtyBtnText, children: "\u2212" })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "body", style: styles3.qtyValue, children: qty }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    import_react_native3.Pressable,
                    {
                      style: styles3.qtyBtn,
                      onPress: () => setLineQty(item.id, qty + 1),
                      accessibilityRole: "button",
                      accessibilityLabel: "Increase received quantity",
                      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "body", style: styles3.qtyBtnText, children: "+" })
                    }
                  )
                ] })
              ]
            }
          );
        },
        ListFooterComponent: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.View, { style: { height: 96 } })
      }
    ),
    openLines.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { style: styles3.confirmBar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native3.View, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "caption", style: styles3.confirmBarLabel, children: "Receiving" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_ui3.Text, { variant: "body", style: styles3.confirmBarTotal, children: [
          selectedUnits,
          " ",
          selectedUnits === 1 ? "unit" : "units",
          " \xB7 ",
          formatMoney(selectedTotal)
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_ui3.Button,
        {
          title: confirming ? "Confirming\u2026" : "Confirm receipt",
          onPress: () => void confirmSelected(),
          disabled: confirming || selectedUnits === 0
        }
      )
    ] })
  ] });
}
var styles3 = import_react_native3.StyleSheet.create({
  container: { flex: 1, backgroundColor: import_ui3.theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { padding: 16, paddingBottom: 4, flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, marginRight: 8 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 12, minHeight: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  listHint: { color: import_ui3.theme.colors.textMuted, marginBottom: 8 },
  lineCard: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingVertical: 10 },
  lineCardMuted: { opacity: 0.55 },
  lineMain: { flex: 1, flexDirection: "row", alignItems: "center", marginRight: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: import_ui3.theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  checkboxOn: { backgroundColor: import_ui3.theme.colors.primary, borderColor: import_ui3.theme.colors.primary },
  checkboxCheck: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  lineInfo: { flex: 1 },
  lineName: { fontWeight: "600" },
  lineCost: { color: import_ui3.theme.colors.textMuted, marginTop: 2 },
  lineQty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: import_ui3.theme.colors.border,
    borderRadius: import_ui3.theme.borderRadius.md,
    overflow: "hidden"
  },
  qtyBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: import_ui3.theme.colors.surface
  },
  qtyBtnMuted: { opacity: 0.4 },
  qtyBtnText: { fontSize: 18, fontWeight: "600" },
  qtyValue: { minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] },
  confirmBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: import_ui3.theme.colors.primaryDark,
    borderRadius: import_ui3.theme.borderRadius.lg,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6
  },
  confirmBarLabel: { color: "rgba(255,255,255,0.8)" },
  confirmBarTotal: { color: "#ffffff", fontWeight: "700" }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OrdersScreen,
  ReceiveOrderScreen,
  ReceiveScreen,
  addPurchaseOrderLine,
  cancelPurchaseOrder,
  createPurchaseOrder,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchSupplierItemLinks,
  fetchSuppliers,
  formatMoney,
  formatQty,
  postGoodsReceipt,
  postGrnSupplierInvoice,
  sendPurchaseOrder,
  sendPurchaseOrderToSupplier,
  toNum
});
