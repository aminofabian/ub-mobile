// src/api/purchasing.ts
var PURCHASE_ORDERS = "/api/v1/purchasing/path-a/purchase-orders";
var GOODS_RECEIPTS = "/api/v1/purchasing/path-a/goods-receipts";
function enc(value) {
  return encodeURIComponent(value.trim());
}
async function fetchSuppliers(api, opts) {
  const parts = ["page=0", "size=100"];
  if (opts?.itemTypeIds !== void 0) {
    for (const id of opts.itemTypeIds) {
      const trimmed = id?.trim();
      if (trimmed) parts.push(`itemTypeIds=${encodeURIComponent(trimmed)}`);
    }
    if (opts.itemTypeIds.length === 0) {
      parts.push("itemTypeIds=");
    }
  }
  const page = await api.get(
    `/api/v1/suppliers?${parts.join("&")}`
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
async function postGoodsReceipt(api, body, opts) {
  return api.post(GOODS_RECEIPTS, body, {
    idempotent: true,
    ...opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}
  });
}
async function postGrnSupplierInvoice(api, goodsReceiptId, body, opts) {
  return api.post(
    `${GOODS_RECEIPTS}/${enc(goodsReceiptId)}/supplier-invoice`,
    body,
    { idempotent: true, ...opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {} }
  );
}

// src/api/till-prints.ts
var TILL_PRINTS = "/api/v1/purchasing/till-prints";
async function fetchTillCashiers(api, branchId) {
  const bid = branchId?.trim();
  const q = bid ? `?branchId=${encodeURIComponent(bid)}` : "";
  const rows = await api.get(`${TILL_PRINTS}/cashiers${q}`);
  return Array.isArray(rows) ? rows : [];
}
async function dispatchTillPrint(api, body) {
  const result = await api.post(TILL_PRINTS, body);
  return {
    jobIds: Array.isArray(result?.jobIds) ? result.jobIds : [],
    tills: Array.isArray(result?.tills) ? result.tills : []
  };
}
async function fetchPendingTillPrints(api) {
  const rows = await api.get(`${TILL_PRINTS}/pending`);
  return Array.isArray(rows) ? rows : [];
}
async function claimTillPrint(api, jobId) {
  const id = jobId.trim();
  if (!id) return;
  await api.post(`${TILL_PRINTS}/${encodeURIComponent(id)}/claim`, {});
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

// src/lib/till-send-words.ts
function describeTillSend(kind, tills) {
  const label = kind === "receipt" ? "Receipt" : "Order";
  const names = (rows) => rows.map((row) => row.name?.trim() || "the till").join(", ");
  const online = tills.filter((row) => row.online);
  const offline = tills.filter((row) => !row.online);
  if (tills.length === 0) {
    return `${label} queued for the till.`;
  }
  if (offline.length === 0) {
    return `${label} sent to ${names(online)}. Their screen will chime and the slip will print.`;
  }
  if (online.length === 0) {
    const who = names(offline);
    return tills.length === 1 ? `${who} is not on Sell right now. The slip is waiting \u2014 they will hear a chime and it will print when they open the till.` : `${who} are not on Sell right now. The slips are waiting until they open the till.`;
  }
  return `${label} printing for ${names(online)}. ${names(offline)} will get it when they open Sell.`;
}

// src/lib/till-slip-escpos.ts
var CUT_TAIL = new Uint8Array([27, 100, 8, 29, 86, 1]);
var INIT = new Uint8Array([27, 64]);
function escPosCharWidth(widthMm) {
  if (widthMm <= 50) return 28;
  if (widthMm <= 58) return 32;
  return 48;
}
function strip(s) {
  return s.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").trim();
}
function repeat(ch, n) {
  return ch.repeat(Math.max(0, n));
}
function padLeft(text, width) {
  if (text.length >= width) return text.slice(-width);
  return " ".repeat(width - text.length) + text;
}
function center(text, width) {
  if (text.length >= width) return text.slice(0, width);
  const pad = width - text.length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + text + " ".repeat(pad - left);
}
function wrap(text, width) {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= width) return [t];
  const out = [];
  let rest = t;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut <= 0) cut = width;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
function asNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
function formatQty2(n) {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1e3) / 1e3;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
function buildTillSlipEscPos(slip, kind, widthMm = 58) {
  const w = escPosCharWidth(widthMm);
  const currency = strip(slip.currency || "KES") || "KES";
  const heading = kind === "receipt" ? "GOODS RECEIPT" : "PURCHASE ORDER";
  const out = [];
  if (slip.businessName?.trim()) {
    out.push(center(strip(slip.businessName), w));
  }
  if (slip.branchName?.trim()) {
    out.push(center(strip(slip.branchName), w));
  }
  out.push(repeat("-", w));
  out.push(center(heading, w));
  out.push(center(strip(slip.reference), w));
  out.push(center(strip((/* @__PURE__ */ new Date()).toLocaleString("en-KE")), w));
  if (slip.placedByName?.trim()) {
    out.push(center(strip(slip.placedByName), w));
  }
  if (slip.supplierName?.trim()) {
    out.push(repeat("-", w));
    out.push(center(`Supplier: ${strip(slip.supplierName)}`, w));
  }
  out.push(repeat("-", w));
  let grand = 0;
  for (const line of slip.lines) {
    const name = strip(line.name) || "Item";
    for (const row of wrap(name, w)) out.push(row);
    const unitCost2 = asNumber(line.unitCost);
    const lineTotal = asNumber(line.lineTotal);
    const qty = asNumber(line.qty);
    grand += lineTotal;
    const detail = `${formatQty2(qty)} x ${unitCost2.toFixed(2)} = ${lineTotal.toFixed(2)}`;
    out.push(padLeft(strip(detail), w));
  }
  out.push(repeat("-", w));
  out.push(padLeft(`TOTAL ${grand.toFixed(2)} ${currency}`, w));
  out.push(repeat("-", w));
  out.push(center(kind === "receipt" ? "Received into stock" : "Place with supplier", w));
  const bodyParts = out.map((line) => encodeLatin1(`${line}
`));
  let bodyLen = 0;
  for (const p of bodyParts) bodyLen += p.length;
  const bytes = new Uint8Array(INIT.length + bodyLen + CUT_TAIL.length);
  let offset = 0;
  bytes.set(INIT, offset);
  offset += INIT.length;
  for (const p of bodyParts) {
    bytes.set(p, offset);
    offset += p.length;
  }
  bytes.set(CUT_TAIL, offset);
  return bytes;
}
function encodeLatin1(s) {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    const code = s.charCodeAt(i);
    out[i] = code <= 255 ? code : 63;
  }
  return out;
}

// src/screens/OrdersScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View
} from "react-native";
import { Button, Card, Text, theme } from "@kiosk/ui";
import { cache } from "@kiosk/offline";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var ORDER_CURRENCY = "KES";
var TILL_PICK_KEY = (branchId) => `stock/order-print-till/${branchId || "none"}`;
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
function OrdersScreen({
  api,
  branchId,
  itemTypeIds,
  shopName,
  branchName,
  clerkName,
  printLocal,
  hasLocalPrinter = false
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState(null);
  const [links, setLinks] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [filter, setFilter] = useState("");
  const [parentFilterId, setParentFilterId] = useState(null);
  const [cartsBySupplier, setCartsBySupplier] = useState({});
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [printingOrder, setPrintingOrder] = useState(false);
  const [cashiers, setCashiers] = useState([]);
  const [cashiersLoading, setCashiersLoading] = useState(false);
  const [cashiersError, setCashiersError] = useState(null);
  const [printTillId, setPrintTillId] = useState(null);
  const [tillPickerOpen, setTillPickerOpen] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const scopeKey = itemTypeIds === void 0 ? "all" : itemTypeIds.slice().sort().join(",");
  const cart = cartsBySupplier[supplierId ?? ""] ?? {};
  const draftKey = useMemo(() => `stock/order-carts/${branchId}`, [branchId]);
  useEffect(() => {
    let cancelled = false;
    void cache.get(draftKey).then((draft) => {
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
  useEffect(() => {
    let cancelled = false;
    setLoadingSuppliers(true);
    void fetchSuppliers(
      api,
      itemTypeIds !== void 0 ? { itemTypeIds } : void 0
    ).then((rows) => {
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
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to load suppliers");
      }
    }).finally(() => {
      if (!cancelled) setLoadingSuppliers(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, scopeKey, itemTypeIds]);
  useEffect(() => {
    if (!supplierId) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setLoadingLinks(true);
    void fetchSupplierItemLinks(api, supplierId, { branchId }).then((rows) => {
      if (cancelled) return;
      const active = rows.filter((r) => r.active);
      if (itemTypeIds === void 0) {
        setLinks(active);
        return;
      }
      if (itemTypeIds.length === 0) {
        setLinks([]);
        return;
      }
      const allowed = new Set(itemTypeIds.map((id) => id.trim()).filter(Boolean));
      setLinks(
        active.filter((r) => {
          const typeId = r.itemTypeId?.trim();
          return !!typeId && allowed.has(typeId);
        })
      );
    }).catch((error) => {
      if (!cancelled) {
        setLinks([]);
        Alert.alert("Error", error instanceof Error ? error.message : "Failed to load products");
      }
    }).finally(() => {
      if (!cancelled) setLoadingLinks(false);
    });
    return () => {
      cancelled = true;
    };
  }, [supplierId, api, branchId, scopeKey, itemTypeIds]);
  useEffect(() => {
    setParentFilterId(null);
  }, [supplierId]);
  useEffect(() => {
    if (!hydrated) return;
    void cache.set(draftKey, cartsBySupplier).catch(() => {
    });
  }, [cartsBySupplier, hydrated, draftKey]);
  useEffect(() => {
    let cancelled = false;
    setCashiersLoading(true);
    setCashiersError(null);
    void fetchTillCashiers(api, branchId).then(async (rows) => {
      if (cancelled) return;
      setCashiers(rows);
      const remembered = await cache.get(TILL_PICK_KEY(branchId)).catch(() => null);
      if (remembered && rows.some((r) => r.id === remembered)) {
        setPrintTillId(remembered);
      } else if (rows.length === 1) {
        setPrintTillId(rows[0].id);
      } else {
        setPrintTillId(null);
      }
    }).catch((error) => {
      if (cancelled) return;
      setCashiers([]);
      setPrintTillId(null);
      setCashiersError(
        error instanceof Error ? error.message : "Could not load cashiers"
      );
    }).finally(() => {
      if (!cancelled) setCashiersLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, branchId]);
  const selectSupplier = (nextId) => {
    if (nextId === supplierId) {
      setSupplierPickerOpen(false);
      return;
    }
    setSupplierId(nextId);
    setSupplierPickerOpen(false);
  };
  const activeSupplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);
  const families = useMemo(() => {
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
  const visibleFamilies = useMemo(() => {
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
  const sections = useMemo(
    () => visibleFamilies.map((f) => ({ title: f.label, data: f.links })),
    [visibleFamilies]
  );
  const cartLines = useMemo(
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
  const printPlacedAfterPickRef = useRef(false);
  const buildOrderSlipLines = useCallback(() => {
    return cartLines.map((line) => {
      const unit = unitCost(line.link);
      return {
        name: line.link.itemName || "Item",
        qty: line.qty,
        unitCost: unit,
        lineTotal: unit * line.qty
      };
    });
  }, [cartLines]);
  const dispatchSlip = useCallback(
    async (opts) => {
      return dispatchTillPrint(api, {
        kind: "order",
        branchId: branchId.trim() || null,
        targetUserIds: [opts.targetUserId],
        slip: {
          reference: opts.reference,
          supplierName: opts.supplierName,
          businessName: shopName?.trim() || "",
          branchName: branchName?.trim() || "",
          placedByName: clerkName?.trim() || "",
          currency: ORDER_CURRENCY,
          lines: opts.lines
        }
      });
    },
    [api, branchId, branchName, clerkName, shopName]
  );
  const localSlipPayload = useCallback(
    (reference, lines, supplierName) => ({
      reference,
      supplierName,
      lines,
      businessName: shopName?.trim() || "",
      branchName: branchName?.trim() || "",
      placedByName: clerkName?.trim() || ""
    }),
    [branchName, clerkName, shopName]
  );
  const printHere = async (reference, lines, supplierName) => {
    if (!printLocal) {
      Alert.alert("No printer", "Pair a Bluetooth printer in Sales \u2192 Invoice printer.");
      return;
    }
    const slipLines = lines ?? buildOrderSlipLines();
    if (slipLines.length === 0) {
      Alert.alert("Empty order", "Add products to the order.");
      return;
    }
    setPrintingOrder(true);
    try {
      await printLocal(
        localSlipPayload(
          reference ?? `DRAFT-${Date.now().toString().slice(-6)}`,
          slipLines,
          supplierName ?? activeSupplier?.name ?? "Supplier"
        )
      );
      Alert.alert("Printed", "The order slip was sent to this phone\u2019s printer.");
    } catch (error) {
      Alert.alert(
        "Could not print",
        error instanceof Error ? error.message : "The printer did not take the slip."
      );
    } finally {
      setPrintingOrder(false);
    }
  };
  const printOrderNow = async () => {
    if (!printTillId) {
      Alert.alert("Pick a till", "Choose which till should print this order.");
      setTillPickerOpen(true);
      return;
    }
    const slipLines = buildOrderSlipLines();
    if (slipLines.length === 0) {
      Alert.alert("Empty order", "Add products to the order.");
      return;
    }
    setPrintingOrder(true);
    try {
      const sent = await dispatchSlip({
        reference: `DRAFT-${Date.now().toString().slice(-6)}`,
        supplierName: activeSupplier?.name || "Supplier",
        lines: slipLines,
        targetUserId: printTillId
      });
      Alert.alert("Sent to till", describeTillSend("order", sent.tills));
    } catch (error) {
      Alert.alert(
        "Could not send",
        error instanceof Error ? error.message : "Could not send order to till"
      );
    } finally {
      setPrintingOrder(false);
    }
  };
  const printLastPlaced = useCallback(
    async (targetUserId) => {
      if (!lastPlaced) return;
      const tillId = targetUserId?.trim() || printTillId?.trim() || "";
      if (!tillId) {
        printPlacedAfterPickRef.current = true;
        setTillPickerOpen(true);
        return;
      }
      setPrintingOrder(true);
      try {
        const sent = await dispatchSlip({
          reference: lastPlaced.poNumber,
          supplierName: lastPlaced.supplierName,
          lines: lastPlaced.lines,
          targetUserId: tillId
        });
        Alert.alert("Sent to till", describeTillSend("order", sent.tills));
      } catch (error) {
        Alert.alert(
          "Could not send",
          error instanceof Error ? error.message : "Could not send order to till"
        );
      } finally {
        setPrintingOrder(false);
      }
    },
    [dispatchSlip, lastPlaced, printTillId]
  );
  const pickTill = useCallback(
    (id) => {
      setPrintTillId(id);
      setTillPickerOpen(false);
      void cache.set(TILL_PICK_KEY(branchId), id).catch(() => {
      });
      if (printPlacedAfterPickRef.current) {
        printPlacedAfterPickRef.current = false;
        void printLastPlaced(id);
      }
    },
    [branchId, printLastPlaced]
  );
  const placeOrder = async () => {
    if (!supplierId || !activeSupplier) {
      Alert.alert("Missing supplier", "Pick a supplier first.");
      return;
    }
    if (!branchId.trim()) {
      Alert.alert("Missing branch", "Select a branch before ordering.");
      return;
    }
    if (cartLines.length === 0) {
      Alert.alert("Empty order", "Add products to the order.");
      return;
    }
    const printTo = printTillId?.trim() || "";
    const slipLines = buildOrderSlipLines();
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
      const placed = {
        poNumber: po.poNumber,
        supplierName: activeSupplier.name || "Supplier",
        lines: slipLines
      };
      setLastPlaced(placed);
      let printNote = "";
      if (printTo && slipLines.length > 0) {
        try {
          const sent = await dispatchSlip({
            reference: po.poNumber,
            supplierName: placed.supplierName,
            lines: slipLines,
            targetUserId: printTo
          });
          printNote = `

${describeTillSend("order", sent.tills)}`;
        } catch {
          printNote = "\n\nThe order was saved, but the selected till did not get the print.";
        }
      }
      setCartsBySupplier((prevMap) => {
        const next = { ...prevMap };
        delete next[supplierId];
        return next;
      });
      setCartOpen(false);
      const actions = [{ text: "Done", style: "cancel" }];
      if (hasLocalPrinter && printLocal) {
        actions.push({
          text: "Print here",
          onPress: () => {
            void printHere(po.poNumber, slipLines, placed.supplierName);
          }
        });
      }
      if (!printTo) {
        actions.push({
          text: "Print to till",
          onPress: () => {
            void printLastPlaced(printTillId ?? void 0);
          }
        });
      }
      Alert.alert(
        "Order placed",
        `Order ${po.poNumber} placed \u2014 confirm when goods arrive.${printNote}`,
        actions
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };
  return /* @__PURE__ */ jsxs(View, { style: styles.container, children: [
    /* @__PURE__ */ jsxs(
      Pressable,
      {
        style: styles.supplierBar,
        onPress: () => setSupplierPickerOpen(true),
        accessibilityRole: "button",
        accessibilityLabel: "Choose supplier",
        children: [
          /* @__PURE__ */ jsxs(View, { style: styles.supplierBarText, children: [
            /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.supplierLabel, children: "Supplier" }),
            /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.supplierName, children: activeSupplier?.name ?? (loadingSuppliers ? "Loading\u2026" : "No suppliers") })
          ] }),
          /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.supplierCaret, children: "\u25BE" })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      TextInput,
      {
        style: styles.search,
        placeholder: "Search products or SKU",
        value: filter,
        onChangeText: setFilter,
        autoCorrect: false,
        autoCapitalize: "none"
      }
    ),
    families.length > 1 && /* @__PURE__ */ jsxs(
      ScrollView,
      {
        horizontal: true,
        showsHorizontalScrollIndicator: false,
        style: styles.chips,
        contentContainerStyle: styles.chipsContent,
        children: [
          /* @__PURE__ */ jsx(
            Chip,
            {
              label: "All",
              lowCount: null,
              active: parentFilterId === null,
              onPress: () => setParentFilterId(null)
            }
          ),
          families.map((f) => /* @__PURE__ */ jsx(
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
    loadingLinks || loadingSuppliers ? /* @__PURE__ */ jsx(View, { style: styles.center, children: /* @__PURE__ */ jsx(ActivityIndicator, { size: "large", color: theme.colors.primary }) }) : sections.length === 0 ? /* @__PURE__ */ jsx(View, { style: styles.center, children: /* @__PURE__ */ jsx(Text, { variant: "muted", children: links.length === 0 ? "No products linked to this supplier" : "No matching products" }) }) : /* @__PURE__ */ jsx(
      SectionList,
      {
        sections,
        keyExtractor: (item) => item.itemId,
        stickySectionHeadersEnabled: false,
        renderSectionHeader: ({ section }) => /* @__PURE__ */ jsxs(View, { style: styles.sectionHeader, children: [
          /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.sectionTitle, children: section.title }),
          /* @__PURE__ */ jsx(Text, { variant: "muted", children: section.data.length })
        ] }),
        renderItem: ({ item }) => /* @__PURE__ */ jsx(
          ItemRow,
          {
            link: item,
            qty: cart[item.itemId] ?? 0,
            onChange: (qty) => setQty(item.itemId, qty)
          }
        ),
        ListFooterComponent: /* @__PURE__ */ jsx(View, { style: { height: 96 } }),
        contentContainerStyle: styles.listContent
      }
    ),
    cartUnits > 0 && /* @__PURE__ */ jsxs(View, { style: styles.cartBar, children: [
      /* @__PURE__ */ jsxs(View, { children: [
        /* @__PURE__ */ jsxs(Text, { variant: "body", style: styles.cartBarQty, children: [
          cartUnits,
          " ",
          cartUnits === 1 ? "item" : "items"
        ] }),
        /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.cartBarTotal, children: formatMoney(cartTotal) })
      ] }),
      /* @__PURE__ */ jsx(Button, { title: "Review order", onPress: () => setCartOpen(true) })
    ] }),
    /* @__PURE__ */ jsx(
      Modal,
      {
        visible: supplierPickerOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setSupplierPickerOpen(false),
        children: /* @__PURE__ */ jsx(View, { style: styles.modalOverlay, children: /* @__PURE__ */ jsxs(View, { style: styles.modalSheet, children: [
          /* @__PURE__ */ jsxs(View, { style: styles.modalHeader, children: [
            /* @__PURE__ */ jsx(Text, { variant: "h2", children: "Choose supplier" }),
            /* @__PURE__ */ jsx(Pressable, { onPress: () => setSupplierPickerOpen(false), accessibilityRole: "button", children: /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.modalClose, children: "Close" }) })
          ] }),
          /* @__PURE__ */ jsx(
            TextInput,
            {
              style: styles.search,
              placeholder: "Search suppliers",
              value: supplierQuery,
              onChangeText: setSupplierQuery,
              autoCorrect: false
            }
          ),
          /* @__PURE__ */ jsx(
            FlatList,
            {
              data: filteredSuppliers,
              keyExtractor: (s) => s.id,
              renderItem: ({ item }) => /* @__PURE__ */ jsxs(
                Pressable,
                {
                  style: styles.supplierRow,
                  onPress: () => selectSupplier(item.id),
                  accessibilityRole: "button",
                  children: [
                    /* @__PURE__ */ jsxs(View, { style: styles.supplierRowText, children: [
                      /* @__PURE__ */ jsx(Text, { variant: "body", children: item.name }),
                      item.code ? /* @__PURE__ */ jsx(Text, { variant: "muted", children: item.code }) : null
                    ] }),
                    item.id === supplierId ? /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.check, children: "\u2713" }) : null
                  ]
                }
              ),
              ListEmptyComponent: /* @__PURE__ */ jsx(View, { style: styles.center, children: /* @__PURE__ */ jsx(Text, { variant: "muted", children: "No suppliers" }) })
            }
          )
        ] }) })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        visible: cartOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => setCartOpen(false),
        children: /* @__PURE__ */ jsx(View, { style: styles.modalOverlay, children: /* @__PURE__ */ jsxs(View, { style: styles.modalSheet, children: [
          /* @__PURE__ */ jsxs(View, { style: styles.modalHeader, children: [
            /* @__PURE__ */ jsx(Text, { variant: "h2", children: "Review order" }),
            /* @__PURE__ */ jsx(Pressable, { onPress: () => setCartOpen(false), accessibilityRole: "button", children: /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.modalClose, children: "Close" }) })
          ] }),
          /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.cartSupplier, children: activeSupplier?.name ?? "Supplier" }),
          /* @__PURE__ */ jsx(
            FlatList,
            {
              data: cartLines,
              keyExtractor: (line) => line.link.itemId,
              renderItem: ({ item }) => /* @__PURE__ */ jsxs(Card, { style: styles.cartLineCard, children: [
                /* @__PURE__ */ jsxs(View, { style: styles.cartLineInfo, children: [
                  /* @__PURE__ */ jsx(Text, { variant: "body", numberOfLines: 1, children: item.link.itemName }),
                  /* @__PURE__ */ jsxs(Text, { variant: "muted", children: [
                    formatMoney(unitCost(item.link)),
                    " \xD7 ",
                    item.qty,
                    " =",
                    " ",
                    formatMoney(unitCost(item.link) * item.qty)
                  ] })
                ] }),
                /* @__PURE__ */ jsx(
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
          /* @__PURE__ */ jsx(
            TextInput,
            {
              style: styles.notes,
              placeholder: "Notes (optional)",
              value: notes,
              onChangeText: setNotes,
              multiline: true
            }
          ),
          /* @__PURE__ */ jsxs(View, { style: styles.printOrderBox, accessibilityRole: "radiogroup", children: [
            /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.printOrderLegend, children: "Print order to" }),
            /* @__PURE__ */ jsx(Text, { variant: "muted", style: styles.printOrderHint, children: "One till only. Their screen chimes and the slip prints on that cashier\u2019s printer \u2014 even remotely." }),
            cashiersLoading ? /* @__PURE__ */ jsx(Text, { variant: "muted", children: "Loading cashiers\u2026" }) : cashiersError ? /* @__PURE__ */ jsx(Text, { variant: "muted", style: styles.printOrderError, children: cashiersError }) : cashiers.length === 0 ? /* @__PURE__ */ jsx(Text, { variant: "muted", children: "No cashiers on this shop, so nothing will print remotely." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(
                Pressable,
                {
                  style: styles.printOrderRow,
                  onPress: () => {
                    printPlacedAfterPickRef.current = false;
                    setPrintTillId(null);
                    void cache.set(TILL_PICK_KEY(branchId), "").catch(() => {
                    });
                  },
                  accessibilityRole: "radio",
                  accessibilityState: { selected: printTillId === null },
                  children: /* @__PURE__ */ jsxs(Text, { variant: "body", style: printTillId === null ? styles.printOrderOn : void 0, children: [
                    printTillId === null ? "\u25CF" : "\u25CB",
                    " Don\u2019t print"
                  ] })
                }
              ),
              cashiers.map((cashier) => {
                const on = printTillId === cashier.id;
                return /* @__PURE__ */ jsx(
                  Pressable,
                  {
                    style: styles.printOrderRow,
                    onPress: () => pickTill(cashier.id),
                    accessibilityRole: "radio",
                    accessibilityState: { selected: on },
                    children: /* @__PURE__ */ jsxs(Text, { variant: "body", style: on ? styles.printOrderOn : void 0, numberOfLines: 1, children: [
                      on ? "\u25CF" : "\u25CB",
                      " ",
                      cashier.name
                    ] })
                  },
                  cashier.id
                );
              })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              title: printingOrder ? "Sending to till\u2026" : "Print order now",
              onPress: () => void printOrderNow(),
              disabled: printingOrder || placing || cartLines.length === 0 || !printTillId,
              variant: "secondary"
            }
          ),
          hasLocalPrinter && printLocal ? /* @__PURE__ */ jsx(
            Button,
            {
              title: printingOrder ? "Printing\u2026" : "Print here",
              onPress: () => void printHere(),
              disabled: printingOrder || placing || cartLines.length === 0,
              variant: "secondary"
            }
          ) : null,
          lastPlaced ? /* @__PURE__ */ jsx(
            Button,
            {
              title: printingOrder ? "Sending\u2026" : `Print ${lastPlaced.poNumber} to till again`,
              onPress: () => void printLastPlaced(),
              disabled: printingOrder || placing || !printTillId,
              variant: "secondary"
            }
          ) : null,
          /* @__PURE__ */ jsxs(View, { style: styles.cartFooter, children: [
            /* @__PURE__ */ jsxs(View, { children: [
              /* @__PURE__ */ jsx(Text, { variant: "caption", children: "Total" }),
              /* @__PURE__ */ jsx(Text, { variant: "h2", children: formatMoney(cartTotal) })
            ] }),
            /* @__PURE__ */ jsx(
              Button,
              {
                title: placing ? "Placing\u2026" : "Place order",
                onPress: () => void placeOrder(),
                disabled: placing || printingOrder || cartLines.length === 0
              }
            )
          ] })
        ] }) })
      }
    ),
    /* @__PURE__ */ jsx(
      Modal,
      {
        visible: tillPickerOpen,
        animationType: "slide",
        transparent: true,
        onRequestClose: () => {
          printPlacedAfterPickRef.current = false;
          setTillPickerOpen(false);
        },
        children: /* @__PURE__ */ jsx(View, { style: styles.modalOverlay, children: /* @__PURE__ */ jsxs(View, { style: styles.modalSheet, children: [
          /* @__PURE__ */ jsxs(View, { style: styles.modalHeader, children: [
            /* @__PURE__ */ jsx(Text, { variant: "h2", children: "Print on till" }),
            /* @__PURE__ */ jsx(
              Pressable,
              {
                onPress: () => {
                  printPlacedAfterPickRef.current = false;
                  setTillPickerOpen(false);
                },
                accessibilityRole: "button",
                children: /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.modalClose, children: "Close" })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(Text, { variant: "caption", style: styles.cartSupplier, children: "The slip is queued remotely. If they are on Sell it prints now; otherwise it waits." }),
          /* @__PURE__ */ jsx(
            FlatList,
            {
              data: cashiers,
              keyExtractor: (item) => item.id,
              renderItem: ({ item }) => /* @__PURE__ */ jsxs(
                Pressable,
                {
                  style: styles.supplierRow,
                  onPress: () => pickTill(item.id),
                  accessibilityRole: "button",
                  children: [
                    /* @__PURE__ */ jsx(View, { style: styles.supplierRowText, children: /* @__PURE__ */ jsx(Text, { variant: "body", children: item.name }) }),
                    item.id === printTillId ? /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.check, children: "\u2713" }) : null
                  ]
                }
              ),
              ListEmptyComponent: /* @__PURE__ */ jsx(View, { style: styles.center, children: /* @__PURE__ */ jsx(Text, { variant: "muted", children: "No cashier tills on this shop." }) })
            }
          )
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
  return /* @__PURE__ */ jsxs(
    Pressable,
    {
      style: [styles.chip, active && styles.chipActive],
      onPress,
      accessibilityRole: "button",
      children: [
        /* @__PURE__ */ jsx(
          Text,
          {
            variant: "caption",
            style: active ? { ...styles.chipLabel, ...styles.chipLabelActive } : styles.chipLabel,
            numberOfLines: 1,
            children: label
          }
        ),
        lowCount != null && lowCount > 0 ? /* @__PURE__ */ jsx(View, { style: styles.chipDot, children: /* @__PURE__ */ jsx(Text, { style: styles.chipDotText, children: lowCount }) }) : null
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
  return /* @__PURE__ */ jsxs(View, { style: styles.itemRow, children: [
    /* @__PURE__ */ jsxs(View, { style: styles.itemInfo, children: [
      /* @__PURE__ */ jsx(Text, { variant: "body", numberOfLines: 1, style: styles.itemName, children: link.itemName }),
      /* @__PURE__ */ jsxs(View, { style: styles.itemMeta, children: [
        /* @__PURE__ */ jsxs(Text, { variant: "muted", children: [
          link.sku || "No SKU",
          link.packUnit ? ` \xB7 ${link.packUnit}` : ""
        ] }),
        /* @__PURE__ */ jsx(
          Text,
          {
            variant: "caption",
            style: low ? { ...styles.stockPill, ...styles.stockLow } : { ...styles.stockPill, ...styles.stockOk },
            children: low ? `Low \xB7 ${stock}` : `${stock} in stock`
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Text, { variant: "caption", style: styles.itemCost, children: [
        formatMoney(cost),
        " ",
        reorder > 0 ? `\xB7 reorder at ${reorder}` : ""
      ] })
    ] }),
    /* @__PURE__ */ jsx(Stepper, { qty, onChange })
  ] });
}
function Stepper({ qty, onChange }) {
  return /* @__PURE__ */ jsxs(View, { style: styles.stepper, children: [
    /* @__PURE__ */ jsx(
      Pressable,
      {
        style: [styles.stepperBtn, qty === 0 && styles.stepperBtnMuted],
        onPress: () => onChange(qty - 1),
        disabled: qty === 0,
        accessibilityRole: "button",
        accessibilityLabel: "Decrease quantity",
        children: /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.stepperBtnText, children: "\u2212" })
      }
    ),
    /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.stepperQty, children: qty }),
    /* @__PURE__ */ jsx(
      Pressable,
      {
        style: styles.stepperBtn,
        onPress: () => onChange(qty + 1),
        accessibilityRole: "button",
        accessibilityLabel: "Increase quantity",
        children: /* @__PURE__ */ jsx(Text, { variant: "body", style: styles.stepperBtnText, children: "+" })
      }
    )
  ] });
}
var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  supplierBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  supplierBarText: { flex: 1, marginRight: 8 },
  supplierLabel: { color: theme.colors.textMuted },
  supplierName: { fontWeight: "600" },
  supplierCaret: { color: theme.colors.textMuted, fontSize: 18 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface
  },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    maxWidth: 180
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipLabel: { color: theme.colors.text },
  chipLabelActive: { color: "#ffffff", fontWeight: "600" },
  chipDot: {
    backgroundColor: theme.colors.danger,
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
  sectionTitle: { fontWeight: "700", color: theme.colors.text },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  stockOk: { backgroundColor: theme.colors.success, color: "#ffffff" },
  stockLow: { backgroundColor: theme.colors.danger, color: "#ffffff" },
  itemCost: { color: theme.colors.textMuted, marginTop: 4 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    overflow: "hidden"
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface
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
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
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
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
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
  modalClose: { color: theme.colors.primary, fontWeight: "600" },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  supplierRowText: { flex: 1, marginRight: 8 },
  check: { color: theme.colors.primary, fontWeight: "700" },
  cartSupplier: { color: theme.colors.textMuted, marginBottom: 8 },
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
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    minHeight: 44,
    marginTop: 4,
    fontSize: 15,
    color: theme.colors.text
  },
  printOrderBox: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface
  },
  printOrderLegend: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: theme.colors.textMuted,
    marginBottom: 4
  },
  printOrderHint: { marginBottom: 8, fontSize: 12, lineHeight: 16 },
  printOrderError: { color: theme.colors.danger },
  printOrderRow: { paddingVertical: 6 },
  printOrderOn: { fontWeight: "700", color: theme.colors.primary },
  cartFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12
  }
});

// src/screens/ReceiveScreen.tsx
import { useCallback as useCallback2, useState as useState2 } from "react";
import { ActivityIndicator as ActivityIndicator2, FlatList as FlatList2, Pressable as Pressable2, StyleSheet as StyleSheet2, View as View2 } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Button as Button2, Card as Card2, Text as Text2, theme as theme2 } from "@kiosk/ui";
import { isApiError } from "@kiosk/core";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var STATUS_TONE = {
  sent: { bg: "#e0f2fe", fg: "#0369a1" },
  draft: { bg: "#fef3c7", fg: "#92400e" },
  completed: { bg: "#dcfce7", fg: "#166534" },
  cancelled: { bg: "#fee2e2", fg: "#991b1b" }
};
function ReceiveScreen({ api, onOpenOrder }) {
  const [orders, setOrders] = useState2([]);
  const [suppliers, setSuppliers] = useState2([]);
  const [loading, setLoading] = useState2(true);
  const [failed, setFailed] = useState2(null);
  const refresh = useCallback2(async () => {
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
      setFailed(null);
    } catch (error) {
      console.warn("Failed to load orders", error);
      setFailed(
        isApiError(error) && error.status === 403 ? "Your role is not allowed to see supplier orders. Ask the owner of the shop to allow it." : "Could not load the orders. Check the signal and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [api]);
  useFocusEffect(
    useCallback2(() => {
      void refresh();
    }, [refresh])
  );
  const supplierName = (supplierId) => suppliers.find((s) => s.id === supplierId)?.name ?? "Supplier";
  return /* @__PURE__ */ jsx2(View2, { style: styles2.container, children: loading ? /* @__PURE__ */ jsx2(View2, { style: styles2.center, children: /* @__PURE__ */ jsx2(ActivityIndicator2, { size: "large", color: theme2.colors.primary }) }) : orders.length === 0 && failed ? /* @__PURE__ */ jsxs2(View2, { style: styles2.center, children: [
    /* @__PURE__ */ jsx2(Text2, { variant: "muted", style: styles2.emptyHint, children: failed }),
    /* @__PURE__ */ jsx2(Button2, { title: "Try again", onPress: () => void refresh(), style: styles2.retry })
  ] }) : orders.length === 0 ? /* @__PURE__ */ jsxs2(View2, { style: styles2.center, children: [
    /* @__PURE__ */ jsx2(Text2, { variant: "muted", children: "No open orders." }),
    /* @__PURE__ */ jsx2(Text2, { variant: "muted", style: styles2.emptyHint, children: "Place an order first, then confirm here when goods arrive." })
  ] }) : /* @__PURE__ */ jsx2(
    FlatList2,
    {
      data: orders,
      keyExtractor: (o) => o.id,
      onRefresh: () => void refresh(),
      refreshing: false,
      ListHeaderComponent: failed ? /* @__PURE__ */ jsx2(Text2, { variant: "muted", style: styles2.staleHint, children: "Could not refresh. These are the last orders read." }) : null,
      contentContainerStyle: styles2.listContent,
      renderItem: ({ item }) => {
        const tone = STATUS_TONE[item.status] ?? { bg: theme2.colors.surface, fg: theme2.colors.textMuted };
        const remaining = toNum(item.totalOrdered) - toNum(item.totalReceived);
        return /* @__PURE__ */ jsx2(
          Pressable2,
          {
            onPress: () => onOpenOrder(item.id),
            accessibilityRole: "button",
            accessibilityLabel: `Open order ${item.poNumber}`,
            children: /* @__PURE__ */ jsxs2(Card2, { style: styles2.card, children: [
              /* @__PURE__ */ jsxs2(View2, { style: styles2.cardHeader, children: [
                /* @__PURE__ */ jsx2(Text2, { variant: "body", style: styles2.poNumber, children: item.poNumber }),
                /* @__PURE__ */ jsx2(View2, { style: [styles2.statusPill, { backgroundColor: tone.bg }], children: /* @__PURE__ */ jsx2(
                  Text2,
                  {
                    variant: "caption",
                    style: { ...styles2.statusText, color: tone.fg },
                    children: item.status
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsx2(Text2, { variant: "body", children: supplierName(item.supplierId) }),
              /* @__PURE__ */ jsxs2(View2, { style: styles2.cardMeta, children: [
                /* @__PURE__ */ jsxs2(Text2, { variant: "muted", children: [
                  item.lineCount,
                  " lines"
                ] }),
                /* @__PURE__ */ jsxs2(Text2, { variant: "muted", children: [
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
var styles2 = StyleSheet2.create({
  container: { flex: 1, backgroundColor: theme2.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyHint: { marginTop: 8, textAlign: "center" },
  retry: { marginTop: 16 },
  staleHint: { marginBottom: 12 },
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
import { useCallback as useCallback3, useEffect as useEffect2, useMemo as useMemo2, useRef as useRef2, useState as useState3 } from "react";
import {
  ActivityIndicator as ActivityIndicator3,
  Alert as Alert2,
  FlatList as FlatList3,
  Pressable as Pressable3,
  StyleSheet as StyleSheet3,
  View as View3
} from "react-native";
import { Button as Button3, Card as Card3, Text as Text3, theme as theme3 } from "@kiosk/ui";
import { generateIdempotencyKey } from "@kiosk/core";

// src/lib/receipt-attempt.ts
function receiptSignature(input) {
  const lines = input.lines.map((line) => `${line.purchaseOrderLineId}:${line.qtyReceived}`).sort();
  return [input.purchaseOrderId, input.branchId, ...lines].join("|");
}
function planAttempt(previous, input, make) {
  if (previous && previous.signature === input.signature) return { kind: "go", attempt: previous };
  if (previous && previous.goodsReceiptId !== null) return { kind: "half_done", attempt: previous };
  const at = new Date(make.now());
  return {
    kind: "go",
    attempt: {
      signature: input.signature,
      goodsReceiptKey: make.key(),
      invoiceKey: make.key(),
      invoiceNumber: `${input.poNumber}-R${String(at.getTime()).slice(-4)}`,
      receivedAt: at.toISOString(),
      invoiceDate: at.toISOString().slice(0, 10),
      goodsReceiptId: null
    }
  };
}
async function sendAttempt(attempt, tools) {
  if (attempt.goodsReceiptId === null) {
    const receipt = await tools.postGoodsReceipt(attempt.goodsReceiptKey);
    const id = receipt && typeof receipt.goodsReceiptId === "string" ? receipt.goodsReceiptId.trim() : "";
    if (id === "") throw new Error("The server did not say which receipt it made.");
    attempt.goodsReceiptId = id;
  }
  await tools.postInvoice(attempt.goodsReceiptId, attempt.invoiceKey);
}
function receiptFailureWords(attempt, error) {
  const said = error instanceof Error && error.message.trim() !== "" ? error.message.trim() : "Could not confirm the order.";
  if (attempt.goodsReceiptId !== null) {
    return `The goods are recorded as received, but the invoice could not be saved: ${said} Press Confirm receipt again to finish it. The goods will not be counted twice.`;
  }
  return `${said} Press Confirm receipt again to try once more. It will not be counted twice.`;
}
var HALF_DONE_WORDS = "The goods from your last try are already received. Go back and open this order again to see what is still to come, so nothing is counted twice.";

// src/screens/ReceiveOrderScreen.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
function round2(value) {
  return Math.round(value * 100) / 100;
}
function ReceiveOrderScreen({ api, branchId, purchaseOrderId, onDone }) {
  const [detail, setDetail] = useState3(null);
  const [itemMeta, setItemMeta] = useState3({});
  const [qtyByLine, setQtyByLine] = useState3({});
  const [selectedLines, setSelectedLines] = useState3({});
  const [loading, setLoading] = useState3(true);
  const [confirming, setConfirming] = useState3(false);
  const [cancelling, setCancelling] = useState3(false);
  const attemptRef = useRef2(null);
  const sending = useRef2(false);
  useEffect2(() => {
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
        Alert2.alert("Error", error instanceof Error ? error.message : "Could not load order");
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [purchaseOrderId, api]);
  const openLines = useMemo2(
    () => (detail?.lines ?? []).filter((l) => toNum(l.qtyOrdered) > toNum(l.qtyReceived)),
    [detail]
  );
  const lineName = useCallback3(
    (line) => itemMeta[line.itemId]?.name ?? "Item",
    [itemMeta]
  );
  const selectedTotal = useMemo2(() => {
    let sum = 0;
    for (const line of openLines) {
      if (!selectedLines[line.id]) continue;
      sum += Math.max(0, qtyByLine[line.id] ?? 0) * toNum(line.unitEstimatedCost);
    }
    return sum;
  }, [openLines, selectedLines, qtyByLine]);
  const selectedUnits = useMemo2(() => {
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
    if (!detail || sending.current) return;
    const lines = openLines.filter((l) => selectedLines[l.id]).map((l) => ({
      purchaseOrderLineId: l.id,
      qtyReceived: Math.max(0, qtyByLine[l.id] ?? 0),
      itemId: l.itemId,
      unitCost: toNum(l.unitEstimatedCost)
    })).filter((l) => l.qtyReceived > 0);
    if (lines.length === 0) {
      Alert2.alert("Nothing to confirm", "Select at least one line with quantity.");
      return;
    }
    const receiveBranch = detail.branchId || branchId;
    if (!receiveBranch.trim()) {
      Alert2.alert("Missing branch", "A branch is required to confirm.");
      return;
    }
    const body = {
      purchaseOrderId: detail.id,
      branchId: receiveBranch.trim(),
      notes: `Confirmed from Order \xB7 ${detail.poNumber}`,
      lines: lines.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        qtyReceived: l.qtyReceived
      }))
    };
    const invoiceLines = lines.map((l) => ({
      itemId: l.itemId,
      qty: l.qtyReceived,
      unitCost: l.unitCost,
      lineTotal: round2(l.qtyReceived * l.unitCost)
    }));
    const plan = planAttempt(
      attemptRef.current,
      { signature: receiptSignature(body), poNumber: detail.poNumber },
      { key: generateIdempotencyKey, now: Date.now }
    );
    if (plan.kind === "half_done") {
      Alert2.alert("Part of this is already recorded", HALF_DONE_WORDS);
      return;
    }
    const attempt = plan.attempt;
    attemptRef.current = attempt;
    sending.current = true;
    setConfirming(true);
    try {
      await sendAttempt(attempt, {
        postGoodsReceipt: (key) => postGoodsReceipt(
          api,
          {
            purchaseOrderId: body.purchaseOrderId,
            branchId: body.branchId,
            receivedAt: attempt.receivedAt,
            notes: body.notes,
            lines: body.lines
          },
          { idempotencyKey: key }
        ),
        postInvoice: (goodsReceiptId, key) => postGrnSupplierInvoice(
          api,
          goodsReceiptId,
          { invoiceNumber: attempt.invoiceNumber, invoiceDate: attempt.invoiceDate, lines: invoiceLines },
          { idempotencyKey: key }
        )
      });
      attemptRef.current = null;
      Alert2.alert("Confirmed", "Order confirmed \u2014 stock updated.", [
        { text: "OK", onPress: onDone }
      ]);
    } catch (error) {
      Alert2.alert("Error", receiptFailureWords(attempt, error));
    } finally {
      sending.current = false;
      setConfirming(false);
    }
  };
  const cancelOrder = () => {
    if (!detail) return;
    Alert2.alert("Cancel order", `Cancel ${detail.poNumber}? This cannot be undone.`, [
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
      Alert2.alert("Order cancelled", "The purchase order has been cancelled.", [
        { text: "OK", onPress: onDone }
      ]);
    } catch (error) {
      Alert2.alert("Error", error instanceof Error ? error.message : "Could not cancel order");
    } finally {
      setCancelling(false);
    }
  };
  const canCancel = detail ? detail.status === "draft" || detail.status === "sent" : false;
  if (loading) {
    return /* @__PURE__ */ jsx3(View3, { style: styles3.center, children: /* @__PURE__ */ jsx3(ActivityIndicator3, { size: "large", color: theme3.colors.primary }) });
  }
  if (!detail) {
    return /* @__PURE__ */ jsx3(View3, { style: styles3.center, children: /* @__PURE__ */ jsx3(Text3, { variant: "muted", children: "Could not load this order." }) });
  }
  return /* @__PURE__ */ jsxs3(View3, { style: styles3.container, children: [
    /* @__PURE__ */ jsxs3(View3, { style: styles3.header, children: [
      /* @__PURE__ */ jsxs3(View3, { style: styles3.headerText, children: [
        /* @__PURE__ */ jsx3(Text3, { variant: "h2", children: detail.poNumber }),
        /* @__PURE__ */ jsxs3(Text3, { variant: "muted", children: [
          "Status: ",
          detail.status
        ] })
      ] }),
      canCancel ? /* @__PURE__ */ jsx3(
        Button3,
        {
          title: cancelling ? "Cancelling\u2026" : "Cancel order",
          variant: "danger",
          onPress: cancelOrder,
          disabled: cancelling || confirming,
          style: styles3.cancelBtn
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsx3(
      FlatList3,
      {
        data: openLines,
        keyExtractor: (l) => l.id,
        contentContainerStyle: styles3.listContent,
        ListHeaderComponent: openLines.length === 0 ? /* @__PURE__ */ jsx3(View3, { style: styles3.center, children: /* @__PURE__ */ jsx3(Text3, { variant: "muted", children: "All lines on this order have been received." }) }) : /* @__PURE__ */ jsx3(Text3, { variant: "caption", style: styles3.listHint, children: "Adjust quantities, then confirm what arrived." }),
        renderItem: ({ item }) => {
          const ordered = toNum(item.qtyOrdered);
          const received = toNum(item.qtyReceived);
          const remaining = ordered - received;
          const qty = Math.max(0, qtyByLine[item.id] ?? 0);
          const selected = !!selectedLines[item.id];
          return /* @__PURE__ */ jsxs3(
            Card3,
            {
              style: selected ? styles3.lineCard : { ...styles3.lineCard, ...styles3.lineCardMuted },
              children: [
                /* @__PURE__ */ jsxs3(
                  Pressable3,
                  {
                    style: styles3.lineMain,
                    onPress: () => toggleLine(item.id),
                    accessibilityRole: "checkbox",
                    accessibilityState: { checked: selected },
                    children: [
                      /* @__PURE__ */ jsx3(View3, { style: [styles3.checkbox, selected && styles3.checkboxOn], children: selected ? /* @__PURE__ */ jsx3(Text3, { style: styles3.checkboxCheck, children: "\u2713" }) : null }),
                      /* @__PURE__ */ jsxs3(View3, { style: styles3.lineInfo, children: [
                        /* @__PURE__ */ jsx3(Text3, { variant: "body", numberOfLines: 1, style: styles3.lineName, children: lineName(item) }),
                        /* @__PURE__ */ jsxs3(Text3, { variant: "muted", children: [
                          formatQty(received),
                          " of ",
                          formatQty(ordered),
                          " received \xB7 ",
                          formatQty(remaining),
                          " ",
                          "remaining"
                        ] }),
                        /* @__PURE__ */ jsxs3(Text3, { variant: "caption", style: styles3.lineCost, children: [
                          formatMoney(toNum(item.unitEstimatedCost)),
                          " / unit"
                        ] })
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs3(View3, { style: styles3.lineQty, children: [
                  /* @__PURE__ */ jsx3(
                    Pressable3,
                    {
                      style: [styles3.qtyBtn, qty === 0 && styles3.qtyBtnMuted],
                      onPress: () => setLineQty(item.id, qty - 1),
                      disabled: qty === 0,
                      accessibilityRole: "button",
                      accessibilityLabel: "Decrease received quantity",
                      children: /* @__PURE__ */ jsx3(Text3, { variant: "body", style: styles3.qtyBtnText, children: "\u2212" })
                    }
                  ),
                  /* @__PURE__ */ jsx3(Text3, { variant: "body", style: styles3.qtyValue, children: qty }),
                  /* @__PURE__ */ jsx3(
                    Pressable3,
                    {
                      style: styles3.qtyBtn,
                      onPress: () => setLineQty(item.id, qty + 1),
                      accessibilityRole: "button",
                      accessibilityLabel: "Increase received quantity",
                      children: /* @__PURE__ */ jsx3(Text3, { variant: "body", style: styles3.qtyBtnText, children: "+" })
                    }
                  )
                ] })
              ]
            }
          );
        },
        ListFooterComponent: /* @__PURE__ */ jsx3(View3, { style: { height: 96 } })
      }
    ),
    openLines.length > 0 && /* @__PURE__ */ jsxs3(View3, { style: styles3.confirmBar, children: [
      /* @__PURE__ */ jsxs3(View3, { children: [
        /* @__PURE__ */ jsx3(Text3, { variant: "caption", style: styles3.confirmBarLabel, children: "Receiving" }),
        /* @__PURE__ */ jsxs3(Text3, { variant: "body", style: styles3.confirmBarTotal, children: [
          selectedUnits,
          " ",
          selectedUnits === 1 ? "unit" : "units",
          " \xB7 ",
          formatMoney(selectedTotal)
        ] })
      ] }),
      /* @__PURE__ */ jsx3(
        Button3,
        {
          title: confirming ? "Confirming\u2026" : "Confirm receipt",
          onPress: () => void confirmSelected(),
          disabled: confirming || selectedUnits === 0
        }
      )
    ] })
  ] });
}
var styles3 = StyleSheet3.create({
  container: { flex: 1, backgroundColor: theme3.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { padding: 16, paddingBottom: 4, flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, marginRight: 8 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 12, minHeight: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  listHint: { color: theme3.colors.textMuted, marginBottom: 8 },
  lineCard: { flexDirection: "row", alignItems: "center", marginBottom: 10, paddingVertical: 10 },
  lineCardMuted: { opacity: 0.55 },
  lineMain: { flex: 1, flexDirection: "row", alignItems: "center", marginRight: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme3.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10
  },
  checkboxOn: { backgroundColor: theme3.colors.primary, borderColor: theme3.colors.primary },
  checkboxCheck: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  lineInfo: { flex: 1 },
  lineName: { fontWeight: "600" },
  lineCost: { color: theme3.colors.textMuted, marginTop: 2 },
  lineQty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme3.colors.border,
    borderRadius: theme3.borderRadius.md,
    overflow: "hidden"
  },
  qtyBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme3.colors.surface
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
    backgroundColor: theme3.colors.primaryDark,
    borderRadius: theme3.borderRadius.lg,
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
export {
  OrdersScreen,
  ReceiveOrderScreen,
  ReceiveScreen,
  addPurchaseOrderLine,
  buildTillSlipEscPos,
  cancelPurchaseOrder,
  claimTillPrint,
  createPurchaseOrder,
  describeTillSend,
  dispatchTillPrint,
  fetchPendingTillPrints,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  fetchSupplierItemLinks,
  fetchSuppliers,
  fetchTillCashiers,
  formatMoney,
  formatQty,
  postGoodsReceipt,
  postGrnSupplierInvoice,
  sendPurchaseOrder,
  sendPurchaseOrderToSupplier,
  toNum
};
