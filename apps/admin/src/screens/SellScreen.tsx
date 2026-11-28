import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  cashSuggestions,
  describePlanProblem,
  formatKes,
  generateIdempotencyKey,
  isMpesaCode,
  createCustomer,
  findCustomerByPhone,
  normalizeKenyanPhone,
  fetchCategories,
  itemsPath,
  lineCents,
  normalizeMpesaCode,
  planPayments,
  readItemsPage,
  toCents,
  wholeShillings,
  type ApiClient,
  type CategoryOption,
  type StockItem,
} from '@kiosk/core';
import { ItemPicker, MartText, Sheet, type ScannerRenderer } from '@kiosk/staff';
import { FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, tint, onFill } from '../theme/mart';

/** One line of the owner's basket: the product, how many, and what it costs each. */
type Line = { item: StockItem; units: number; eachCents: number };

/**
 * The owner selling from the back office.
 *
 * The counter's arithmetic, not a second copy of it: `lineCents`/`toCents` come from `@kiosk/core`, so a basket rung up
 * here rounds, weighs and totals exactly as the till does. There is no shift and no drawer — the backend opens a hidden
 * one for a manager's sale — so the whole screen is the shelf, the basket and the way the customer paid.
 */
export function SellScreen({
  api,
  branchId,
  renderScanner,
  onSold,
  canCredit = false,
}: {
  api: ApiClient;
  branchId: string;
  renderScanner?: ScannerRenderer;
  onSold?: (words: string) => void;
  /** Whether a tab may be opened: the server needs `credits.customers.read` to find the customer. */
  canCredit?: boolean;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<'cash' | 'mpesa_manual' | 'customer_credit'>('cash');
  const [received, setReceived] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  /** The person a tab is opened for: found by number, never guessed when a number matches two customers. */
  const [creditPhone, setCreditPhone] = useState('');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  /** True when no customer has that number: the sheet then offers to add one rather than pointing at the web. */
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [showing, setShowing] = useState(false);
  /** What was just sold, kept only long enough to show the receipt. */
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [featured, setFeatured] = useState<StockItem[]>([]);
  const [receipt, setReceipt] = useState<{
    lines: { name: string; units: number; cents: number }[];
    totalCents: number;
    method: 'cash' | 'mpesa_manual' | 'customer_credit';
    changeCents: number;
    code: string;
  } | null>(null);

  useEffect(() => {
    let live = true;
    fetchCategories(api)
      .then((rows) => {
        if (live) setCategories(rows);
      })
      .catch(() => {
        if (live) setCategories([]);
      });
    return () => {
      live = false;
    };
  }, [api]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const tops = await api.get<
          { id?: string; name?: string; sku?: string | null; thumbnailUrl?: string | null }[]
        >(`/api/v1/sales/top-products?branchId=${encodeURIComponent(branchId)}&limit=8`);
        const rows = Array.isArray(tops) ? tops.slice(0, 8) : [];
        const found = await Promise.all(
          rows.map(async (sku) => {
            const id = typeof sku.id === 'string' ? sku.id.trim() : '';
            const term = (sku.sku?.trim() || sku.name?.trim() || '').slice(0, 80);
            if (!id || !term) return null;
            const raw = await api.get<unknown>(itemsPath({ branchId, search: term, size: 20 }));
            const page = readItemsPage(raw, { page: 0, size: 20 });
            const item = page?.items.find((row) => row.id === id && row.active && row.sellable) ?? null;
            if (!item) return null;
            const thumb = typeof sku.thumbnailUrl === 'string' ? sku.thumbnailUrl.trim() : '';
            return item.imageUrl || !/^https?:\/\//i.test(thumb) ? item : { ...item, imageUrl: thumb };
          }),
        );
        if (live) setFeatured(found.filter((item): item is StockItem => item !== null));
      } catch {
        if (live) setFeatured([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [api, branchId]);

  const totalCents = useMemo(
    () => lines.reduce((sum, line) => sum + (lineCents(line.units, line.eachCents / 100) ?? 0), 0),
    [lines]
  );
  const units = useMemo(() => lines.reduce((sum, line) => sum + line.units, 0), [lines]);

  /** A tap on the shelf puts one in, or one more of what is already there. */
  const add = useCallback((item: StockItem) => {
    setProblem(null);
    setLines((current) => {
      const at = current.findIndex((line) => line.item.id === item.id);
      if (at === -1) {
        // `sellingCents` is already whole cents; a product with no price enters at zero and is priced by the server
        const each = item.sellingCents ?? 0;
        return [...current, { item, units: 1, eachCents: each }];
      }
      const next = [...current];
      next[at] = { ...next[at], units: next[at].units + 1 };
      return next;
    });
  }, []);

  const remove = useCallback((item: StockItem) => {
    const itemId = item.id;
    setLines((current) =>
      current.flatMap((line) => {
        if (line.item.id !== itemId) return [line];
        return line.units > 1 ? [{ ...line, units: line.units - 1 }] : [];
      })
    );
  }, []);

  const receivedCents = toCents(Number(received.replace(/[^0-9.]/g, '')) || 0) ?? 0;

  /** Finds the customer a tab would be opened for, by the number they gave. */
  const findCustomer = useCallback(async () => {
    if (!normalizeKenyanPhone(creditPhone)) {
      setProblem("That is not a mobile number. Write it like 0712 345 678.");
      return;
    }
    setProblem(null);
    try {
      const match = await findCustomerByPhone(api, creditPhone);
      if (match?.kind === 'one') setCustomer({ id: match.customer.id, name: match.customer.name ?? 'Customer' });
      else if (match?.kind === 'several') setProblem('Two customers have that number, so the sale cannot be put on either. Sort it out on the web.');
      else setAdding(true);
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'Could not look that number up.');
    }
  }, [api, creditPhone]);

  /** Adds the customer whose number was looked up, then puts the sale on their new tab. */
  const addCustomer = useCallback(async () => {
    if (!newName.trim()) {
      setProblem('Give the customer a name.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const created = await createCustomer(api, { name: newName, phone: creditPhone });
      setCustomer(created);
      setAdding(false);
      setNewName('');
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'The customer could not be added.');
    } finally {
      setBusy(false);
    }
  }, [api, creditPhone, newName]);

  /**
   * What the till would do with this money: the shared planner, so payments add up to exactly the bill, an M-Pesa share
   * is whole shillings, and the notes handed over travel separately so the change is right.
   */
  const plan = useMemo(() => {
    // No code typed: the money is M-Pesa, and the reference is simply not known yet. The server accepts a payment
    // without one, so the sale is not held up waiting for a message the customer may not have brought.
    if (method === 'mpesa_manual' && code.trim() === '') {
      return {
        ok: true as const,
        payments: [{ method: 'mpesa_manual', amount: totalCents / 100 }],
        changeCents: 0,
      };
    }
    return planPayments({
      totalCents,
      tenders:
        method === 'cash'
          ? [{ kind: 'cash', cents: totalCents, ...(received.trim() !== '' ? { handedCents: receivedCents } : {}) }]
          : method === 'mpesa_manual'
            ? [{ kind: 'mpesa', cents: wholeShillings(totalCents), code: normalizeMpesaCode(code) }]
            : [{ kind: 'credit', cents: totalCents }],
      ...(method === 'customer_credit' && customer ? { customerId: customer.id } : {}),
    });
  }, [code, customer, method, received, receivedCents, totalCents]);
  const changeCents = plan.ok ? plan.changeCents : 0;
  const short = method === 'cash' && received.trim() !== '' && receivedCents < totalCents;
  const codeProblem =
    method === 'mpesa_manual' && code.trim() !== '' && !isMpesaCode(normalizeMpesaCode(code))
      ? 'That does not look like an M-Pesa code (6 to 20 letters and digits).'
      : null;
  const planProblem = !plan.ok ? describePlanProblem(plan) : null;

  /**
   * The sale, and the one thing the server may ask for first.
   *
   * A sale carries no till device from the back office, so the server looks for a shift with no device — and opens one
   * itself only when the shop runs without shifts. On a shop that uses shifts, the first owner sale has to open one; the
   * same endpoint the till uses does it, at zero float, with a note saying where it came from.
   */
  const postSale = useCallback(
    async (body: unknown, key: string) => {
      try {
        return await api.post<unknown>('/api/v1/sales', body, { idempotencyKey: key });
      } catch (error) {
        const said = error instanceof Error ? error.message : '';
        if (!/no open shift/i.test(said)) throw error;
        await api.post('/api/v1/shifts/open', {
          branchId,
          openingCash: 0,
          notes: 'Opened from the owner app to take a sale.',
        });
        return api.post<unknown>('/api/v1/sales', body, { idempotencyKey: key });
      }
    },
    [api, branchId]
  );

  const sell = useCallback(async () => {
    if (busy || lines.length === 0) return;
    setBusy(true);
    setProblem(null);
    const key = generateIdempotencyKey();
    const body = {
      branchId,
      lines: lines.map((line) => ({ itemId: line.item.id, quantity: line.units, unitPrice: line.eachCents / 100 })),
      payments: plan.ok ? plan.payments : [],
      ...(method === 'cash' && received.trim() !== '' ? { cashReceived: receivedCents / 100 } : {}),
      ...(method === 'customer_credit' && customer ? { customerId: customer.id } : {}),
      clientSoldAt: new Date().toISOString(),
    };
    try {
      await postSale(body, key);
      const sold = {
        lines: lines.map((line) => ({
          name: line.item.name,
          units: line.units,
          cents: lineCents(line.units, line.eachCents / 100) ?? 0,
        })),
        totalCents,
        method,
        changeCents: method === 'cash' ? changeCents : 0,
        code: method === 'cash' ? '' : code.trim().toUpperCase(),
      };
      const said = `Sold ${units} ${units === 1 ? 'item' : 'items'} · ${formatKes(totalCents)}`;
      setReceipt(sold);
      setLines([]);
      setPaying(false);
      setReceived('');
      setCode('');
      onSold?.(said);
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'The server did not take the sale.');
    } finally {
      setBusy(false);
    }
  }, [busy, changeCents, code, lines, method, onSold, plan, postSale, received, receivedCents, totalCents, units]);

  return (
    <View style={styles.fill}>
      <View style={styles.shelf}>
        <ItemPicker
          api={api}
          branchId={branchId}
          onPick={add}
          onRemove={remove}
          cards
          columns={2}
          nameLines={0}
          categories={categories}
          onCategory={setCategoryId}
          {...(categoryId ? { categoryId } : {})}
          {...(!categoryId && featured.length > 0 ? { featured } : {})}
          inBasket={Object.fromEntries(lines.map((line) => [line.item.id, line.units]))}
          placeholder="Find something to sell"
          {...(renderScanner ? { renderScanner } : {})}
        />
      </View>

      {problem && !paying ? (
        <MartText variant="meta" color={MART.danger} style={styles.shelfProblem}>
          {problem}
        </MartText>
      ) : null}

      {units > 0 ? (
        <Pressable
          onPress={() => setShowing((on) => !on)}
          accessibilityRole="button"
          accessibilityLabel={showing ? 'Hide the basket' : 'Show the basket'}
          style={styles.basketRow}
        >
          <Ionicons name={showing ? 'chevron-down' : 'chevron-up'} size={14} color={MART.inkMuted} />
          <MartText variant="meta" color={MART.inkMuted}>
            {showing ? 'Hide what is in this sale' : `See what is in this sale · ${units} ${units === 1 ? 'item' : 'items'}`}
          </MartText>
        </Pressable>
      ) : null}

      {showing && units > 0 ? (
        <View style={styles.basket}>
          {lines.map((line) => (
            <View key={line.item.id} style={styles.basketLine}>
              <MartText variant="label" style={styles.basketName}>
                {line.units > 1 ? `${line.units} × ` : ''}
                {line.item.name}
              </MartText>
              <MartText variant="label">{formatKes(lineCents(line.units, line.eachCents / 100) ?? 0)}</MartText>
              <Pressable
                onPress={() => remove(line.item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Take one ${line.item.name} out`}
              >
                <Ionicons name="remove-circle-outline" size={18} color={MART.inkQuiet} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.bar}>
        <View style={styles.barText}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {units === 0 ? 'Nothing yet' : `${units} ${units === 1 ? 'item' : 'items'}`}
          </MartText>
          <MartText variant="title" numberOfLines={1} adjustsFontSizeToFit>
            {formatKes(totalCents)}
          </MartText>
        </View>
        <Pressable
          onPress={() => {
            if (lines.some((line) => line.eachCents <= 0)) {
              setProblem('One of these has no price. Price it in the catalogue first.');
              return;
            }
            setPaying(true);
          }}
          disabled={units === 0}
          accessibilityRole="button"
          accessibilityLabel="Take payment"
          style={({ pressed }) => [styles.go, units === 0 && styles.goOff, pressed && styles.pressed]}
        >
          <MartText variant="label" color={units === 0 ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
            Charge
          </MartText>
        </Pressable>
      </View>

      <Sheet visible={receipt !== null} onClose={() => setReceipt(null)} title="Sale taken">
        <View style={styles.sheetBody}>
          <View style={styles.paper}>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.paperEyebrow}>
              RECEIPT
            </MartText>
            {receipt?.lines.map((line) => (
              <View key={line.name} style={styles.billRow}>
                <MartText variant="meta" color={MART.inkMuted} style={styles.billName}>
                  {line.units > 1 ? `${line.units} × ` : ''}
                  {line.name}
                </MartText>
                <MartText variant="label">{formatKes(line.cents)}</MartText>
              </View>
            ))}
            <View style={styles.paperRule} />
            <View style={styles.billRow}>
              <MartText variant="title" style={styles.billName}>
                Total
              </MartText>
              <MartText variant="title">{formatKes(receipt?.totalCents ?? 0)}</MartText>
            </View>
            <MartText variant="meta" color={MART.inkQuiet}>
              {receipt?.method === 'cash'
                ? `Cash${(receipt?.changeCents ?? 0) > 0 ? ` · change ${formatKes(receipt.changeCents)}` : ''}`
                : `M-Pesa${receipt?.code ? ` · ${receipt.code}` : ''}`}
            </MartText>
          </View>
          <Pressable onPress={() => setReceipt(null)} style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
            <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
              Done
            </MartText>
          </Pressable>
        </View>
      </Sheet>

      <Sheet visible={paying} onClose={() => !busy && setPaying(false)} title="Take payment">
        <View style={styles.sheetBody}>
          <View style={styles.bill}>
            {lines.map((line) => (
              <View key={line.item.id} style={styles.billRow}>
                <MartText variant="meta" color={MART.inkMuted} style={styles.billName}>
                  {line.units > 1 ? `${line.units} × ` : ''}
                  {line.item.name}
                </MartText>
                <MartText variant="label" numberOfLines={1}>
                  {formatKes(lineCents(line.units, line.eachCents / 100) ?? 0)}
                </MartText>
              </View>
            ))}
          </View>

          <View style={styles.modes}>
            {(['cash', 'mpesa_manual', ...(canCredit ? (['customer_credit'] as const) : [])] as const).map((mode) => {
              const on = method === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setMethod(mode);
                    setProblem(null);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.mode, on && styles.modeOn]}
                >
                  <MartText variant="label" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                    {mode === 'cash' ? 'Cash' : mode === 'mpesa_manual' ? 'M-Pesa' : 'Credit'}
                  </MartText>
                </Pressable>
              );
            })}
          </View>

          {method === 'customer_credit' ? (
            <>
              <View style={styles.amountRow}>
                <MartText variant="shelf" color={MART.inkQuiet}>
                  CUSTOMER'S NUMBER
                </MartText>
                <TextInput
                  value={creditPhone}
                  onChangeText={(next) => {
                    setCreditPhone(next);
                    setCustomer(null);
                    setProblem(null);
                  }}
                  keyboardType="phone-pad"
                  placeholder="0712 345 678"
                  placeholderTextColor={MART.inkQuiet}
                  style={styles.phoneInput}
                  accessibilityLabel="Customer's phone number"
                />
              </View>
              {customer ? (
                <MartText variant="meta" color={MART.success}>
                  {`On ${customer.name}'s tab`}
                </MartText>
              ) : adding ? (
                <>
                  <MartText variant="meta" color={MART.inkMuted}>
                    No customer has that number. Add them:
                  </MartText>
                  <TextInput
                    value={newName}
                    onChangeText={(next) => {
                      setNewName(next);
                      setProblem(null);
                    }}
                    placeholder="Customer's name"
                    placeholderTextColor={MART.inkQuiet}
                    autoCapitalize="words"
                    style={[styles.input, styles.nameInput]}
                    accessibilityLabel="Customer's name"
                  />
                  <Pressable
                    onPress={() => void addCustomer()}
                    disabled={busy || !newName.trim()}
                    style={({ pressed }) => [styles.quickChip, styles.lookup, (busy || !newName.trim()) && styles.goOff, pressed && styles.pressed]}
                  >
                    <MartText variant="meta" color={MART.inkMuted}>
                      {busy ? 'Adding…' : 'Add customer and use their tab'}
                    </MartText>
                  </Pressable>
                </>
              ) : (
                <Pressable onPress={() => void findCustomer()} style={({ pressed }) => [styles.quickChip, styles.lookup, pressed && styles.pressed]}>
                  <MartText variant="meta" color={MART.inkMuted}>
                    Find customer
                  </MartText>
                </Pressable>
              )}
            </>
          ) : (
            <View style={styles.amountRow}>
              <MartText variant="shelf" color={MART.inkQuiet}>
                {method === 'cash' ? 'NOTES RECEIVED' : 'M-PESA CODE'}
              </MartText>
              <TextInput
                value={method === 'cash' ? received : code}
                onChangeText={method === 'cash' ? setReceived : setCode}
                keyboardType={method === 'cash' ? 'decimal-pad' : 'default'}
                autoCapitalize="characters"
                placeholder={method === 'cash' ? String(totalCents / 100) : 'Code from the customer (optional)'}
                placeholderTextColor={MART.inkQuiet}
                style={styles.input}
                accessibilityLabel={method === 'cash' ? 'Notes received' : 'M-Pesa code'}
              />
            </View>
          )}

          {method === 'cash' ? (
            <View style={styles.quickCash}>
              {cashSuggestions(totalCents)
                .slice(0, 3)
                .map((cents) => (
                  <Pressable
                    key={cents}
                    onPress={() => setReceived(String(cents / 100))}
                    style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}
                  >
                    <MartText variant="meta" color={MART.inkMuted}>
                      {formatKes(cents)}
                    </MartText>
                  </Pressable>
                ))}
            </View>
          ) : null}
          {method === 'cash' && received.trim() !== '' ? (
            <MartText variant="meta" color={short ? MART.danger : MART.inkMuted}>
              {short ? `${formatKes(totalCents - receivedCents)} short` : `Change ${formatKes(changeCents)}`}
            </MartText>
          ) : null}
          {codeProblem || planProblem ? (
            <MartText variant="meta" color={MART.danger}>
              {codeProblem ?? planProblem}
            </MartText>
          ) : null}
          {problem ? (
            <MartText variant="meta" color={MART.danger}>
              {problem}
            </MartText>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={() => setPaying(false)} disabled={busy} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
              <MartText variant="label" color={MART.inkMuted}>
                Cancel
              </MartText>
            </Pressable>
            <Pressable
              onPress={() => void sell()}
              disabled={busy || short || !plan.ok || (method === 'customer_credit' && !customer)}
              style={({ pressed }) => [styles.confirm, (busy || short || !plan.ok) && styles.goOff, pressed && styles.pressed]}
            >
              <MartText variant="label" color={busy || short || !plan.ok || (method === 'customer_credit' && !customer) ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
                {busy ? 'Selling…' : `Take ${formatKes(totalCents)}`}
              </MartText>
            </Pressable>
          </View>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: { fontSize: 18, minWidth: 220 },
  lookup: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  phoneInput: { fontSize: 22, fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, color: MART.ink, textAlign: 'center', minWidth: 200, paddingVertical: 4 },
  quickCash: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: MART.paperSunken },
  paper: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  paperEyebrow: { letterSpacing: 1.2 },
  paperRule: { height: 1, backgroundColor: MART.border, marginVertical: 4 },
  fill: { flex: 1, backgroundColor: MART.paper },
  shelf: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 10,
    paddingLeft: 14,
    borderRadius: 24,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    ...SHADOW.floating,
  },
  barText: { flex: 1, gap: 2 },
  go: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: RADIUS.pill ?? 999,
    backgroundColor: MART.fallbackPrimary,
  },
  goOff: { backgroundColor: tint(MART.fallbackPrimary, 0.35) },
  pressed: { opacity: 0.85 },
  basketRow: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10 },
  basket: { marginHorizontal: 12, marginBottom: 8, padding: 10, gap: 8, borderRadius: 16, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  basketLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  basketName: { flex: 1 },
  shelfProblem: { paddingHorizontal: 16, paddingBottom: 6 },
  bill: { gap: 6 },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  billName: { flex: 1 },
  sheetBody: { gap: SPACE.md, paddingTop: SPACE.xs },
  modes: { flexDirection: 'row', gap: 6, padding: 3, borderRadius: 999, backgroundColor: MART.paperSunken },
  mode: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  modeOn: { backgroundColor: MART.fallbackPrimary },
  amountRow: { alignItems: 'center', gap: 2 },
  input: { fontSize: 34, fontFamily: FONT.bold, fontWeight: WEIGHT.bold, color: MART.ink, textAlign: 'center', minWidth: 180, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: SPACE.sm },
  cancel: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: MART.paperSunken },
  confirm: { flex: 2, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: MART.fallbackPrimary },
});
