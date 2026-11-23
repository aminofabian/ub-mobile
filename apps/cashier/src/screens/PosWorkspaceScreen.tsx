import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import { BarcodeScanner } from '@kiosk/barcode';
import { generateIdempotencyKey, type ApiClient } from '@kiosk/core';
import { fetchFreshItems, fetchShopFlags, fetchWebOrders, searchItems } from '../api/pos-api';
import { CartPanel } from '../components/CartPanel';
import { HeldBasketsSheet } from '../components/HeldBasketsSheet';
import { NoticeBar } from '../components/NoticeBar';
import { PricePrompt } from '../components/PricePrompt';
import { WeightPrompt } from '../components/WeightPrompt';
import { cannotAdd, cartCents, lineThousandths, weighedItemOf, type CartItem, type CartLine } from '../lib/cart';
import { holdKeeperFor } from '../lib/hold-storage';
import { basketsOf } from '../lib/holds';
import { itemWords } from '../lib/item-words';
import { toCents } from '../lib/money';
import { prepareRecall } from '../lib/recall-flow';
import { pickScanned } from '../lib/scan-result';
import { mayChangePrice, mayCreateProduct, mayListWebOrders } from '../lib/shop-flags';
import { holderOf, type TillPerson } from '../lib/till-person';
import {
  describeAddRefusal,
  describeItemsFailure,
  describeLoadedHolds,
  HOLD_NOT_SAVED,
  HOLDS_NOT_READ,
  holdRefusalWords,
  RECALL_REFUSED,
} from '../lib/till-words';
import { howToSell } from '../lib/weight';
import { openOrdersFor, waitingCount } from '../lib/web-orders';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Pos'> & {
  api: ApiClient;
  branchId: string;
  /** The shop's id, which the held baskets are kept under on this phone. */
  tenantId: string;
  person: TillPerson;
};

type Notice = { notes: string[]; tone: 'info' | 'warning'; barcode?: string };

/** How often the till looks for web orders while it is on screen. */
const WEB_ORDERS_EVERY_MS = 60_000;

export function PosWorkspaceScreen({ navigation, route, api, branchId, tenantId, person }: Props) {
  const {
    items,
    cart,
    flags,
    holds,
    holdsFor,
    setItems,
    setFlags,
    addToCart,
    addWeighed,
    reweigh,
    updateQuantity,
    changePrice,
    removeFromCart,
    replaceCart,
    loadHolds,
    holdCurrent,
    recallHold,
    discardHold,
  } = usePosStore();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [weighing, setWeighing] = useState<{ item: CartItem; mode: 'add' | 'replace' } | null>(null);
  const [pricing, setPricing] = useState<CartLine | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [heldAt, setHeldAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [holdsUnreadable, setHoldsUnreadable] = useState(false);
  const [holdsUnsaved, setHoldsUnsaved] = useState(false);
  const [waiting, setWaiting] = useState(0);

  const may = useMemo(
    () => ({
      price: mayChangePrice(flags, person.permissions),
      create: mayCreateProduct(flags, person.permissions),
      orders: mayListWebOrders(person.permissions),
    }),
    [flags, person.permissions]
  );
  const keeper = useMemo(() => holdKeeperFor(tenantId), [tenantId]);
  const canHold = holdsFor === tenantId;
  const mine = useMemo(
    () => (canHold ? basketsOf(holds, holderOf(person, branchId)) : []),
    [canHold, holds, person, branchId]
  );
  const totalCents = useMemo(() => cartCents(cart), [cart]);

  const tell = useCallback((notes: string[], tone: 'info' | 'warning' = 'info', barcode?: string) => {
    setNotice(notes.length > 0 ? { notes, tone, ...(barcode ? { barcode } : {}) } : null);
  }, []);

  // The newest search wins: a slow answer to an older one never replaces what is on screen.
  const latestLoad = useRef(0);
  const loadItems = useCallback(
    async (opts: { search?: string; barcode?: string } = {}): Promise<CartItem[] | null> => {
      latestLoad.current += 1;
      const mineLoad = latestLoad.current;
      setLoading(true);
      setProblem(null);
      try {
        const result = await searchItems(api, { ...opts, branchId });
        if (mineLoad !== latestLoad.current) return null;
        setItems(result);
        return result;
      } catch (error) {
        if (mineLoad === latestLoad.current) setProblem(describeItemsFailure(error));
        return null;
      } finally {
        if (mineLoad === latestLoad.current) setLoading(false);
      }
    },
    [api, branchId, setItems]
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // What the shop lets a till do. Left as it was when it cannot be read: the till then offers only what the
  // person's own permissions allow, and the server has the last word either way.
  useEffect(() => {
    let alive = true;
    fetchShopFlags(api).then(
      (read) => {
        if (alive) setFlags(read);
      },
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [api, setFlags]);

  // The baskets on this phone, read once for this shop. Until they have been, nothing can be held: a book that
  // failed to load and was then saved over would throw away every basket on the phone.
  useEffect(() => {
    if (holdsFor === tenantId) return undefined;
    let alive = true;
    setHoldsUnreadable(false);
    keeper.load(Date.now()).then(
      (parsed) => {
        if (!alive) return;
        loadHolds(parsed.book, tenantId);
        const notes = describeLoadedHolds(parsed);
        if (notes.length > 0) tell(notes, 'warning');
      },
      () => {
        if (alive) setHoldsUnreadable(true);
      }
    );
    return () => {
      alive = false;
    };
  }, [holdsFor, tenantId, keeper, loadHolds, tell]);

  // Web orders waiting on this branch, while the till is on screen and the person may see them.
  useFocusEffect(
    useCallback(() => {
      if (!may.orders) return undefined;
      let alive = true;
      const look = () => {
        fetchWebOrders(api).then(
          (orders) => {
            if (alive) setWaiting(waitingCount(orders, branchId));
          },
          () => undefined
        );
      };
      look();
      const timer = setInterval(look, WEB_ORDERS_EVERY_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [api, branchId, may.orders])
  );

  // A message left by the screen the person came back from (a product was added).
  const left = route.params?.notice;
  useEffect(() => {
    if (!left) return;
    tell([left]);
    navigation.setParams({ notice: undefined });
  }, [left, tell, navigation]);

  const add = (item: CartItem) => {
    const why = cannotAdd(item);
    if (why) {
      tell([why], 'warning');
      return;
    }
    if (howToSell(item).kind === 'kg') {
      setWeighing({ item, mode: 'add' });
      return;
    }
    if (!addToCart(item)) tell([describeAddRefusal(false)], 'warning');
  };

  const onBarcode = async (value: string) => {
    setShowScanner(false);
    const found = await loadItems({ barcode: value });
    if (found === null) return;
    const picked = pickScanned(found, value);
    if (picked.kind === 'one') {
      add(picked.item);
    } else if (picked.kind === 'none') {
      tell([`No product has the barcode ${value}.`], 'warning', value);
    } else {
      tell(['More than one product could be this one. Pick the right one from the list.'], 'warning');
    }
  };

  const confirmWeight = (thousandths: number): string | null => {
    if (!weighing) return null;
    const taken =
      weighing.mode === 'replace' ? reweigh(weighing.item.id, thousandths) : addWeighed(weighing.item, thousandths);
    if (!taken) return describeAddRefusal(true);
    setWeighing(null);
    return null;
  };

  const confirmPrice = (cents: number): string | null => {
    if (!pricing) return null;
    if (!changePrice(pricing.itemId, cents)) return 'That price could not be used.';
    setPricing(null);
    return null;
  };

  const backToShelfPrice = () => {
    const shelf = pricing?.shelfPrice;
    const cents = shelf === undefined ? null : toCents(shelf);
    if (pricing && cents !== null) changePrice(pricing.itemId, cents);
    setPricing(null);
  };

  const saveHolds = async () => {
    const landed = await keeper.save(usePosStore.getState().holds);
    setHoldsUnsaved(!landed);
  };

  const holdBasket = () => {
    if (!canHold) return;
    const result = holdCurrent(holderOf(person, branchId), Date.now(), generateIdempotencyKey());
    if (!result.ok) {
      tell([holdRefusalWords(result)], 'warning');
      return;
    }
    tell([`${result.basket.label} is on hold.`]);
    void saveHolds();
  };

  const openHeld = () => {
    setHeldAt(Date.now());
    setShowHeld(true);
  };

  const pickUp = async (id: string) => {
    const basket = mine.find((candidate) => candidate.id === id);
    if (!basket || busy) return;
    setBusy(true);
    try {
      const prepared = await prepareRecall(basket, (lines) => fetchFreshItems(api, lines, branchId));
      const recalled = recallHold(id, holderOf(person, branchId), Date.now(), generateIdempotencyKey());
      if (!recalled) {
        tell([RECALL_REFUSED], 'warning');
        return;
      }
      replaceCart(prepared.lines);
      setShowHeld(false);
      const notes = [...prepared.notes];
      if (recalled.parked) notes.unshift(`What you were ringing was put on hold as ${recalled.parked.label}.`);
      tell(notes, prepared.notes.length > 0 ? 'warning' : 'info');
      void saveHolds();
    } finally {
      setBusy(false);
    }
  };

  const throwAway = (id: string) => {
    discardHold(id, holderOf(person, branchId));
    void saveHolds();
  };

  const noticeAction =
    notice?.barcode && may.create
      ? {
          label: 'Add product',
          onPress: () => {
            const barcode = notice.barcode;
            setNotice(null);
            if (barcode) navigation.navigate('NewProduct', { barcode });
          },
        }
      : undefined;

  const weighingLine = weighing ? cart.find((line) => line.itemId === weighing.item.id) : undefined;
  const inBasket = weighingLine?.weighed ? lineThousandths(weighingLine) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search products"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void loadItems({ search })}
          returnKeyType="search"
          accessibilityLabel="Search products"
        />
        <Button title="Scan" onPress={() => setShowScanner(true)} />
      </View>

      {may.create || may.orders ? (
        <View style={styles.tools}>
          {may.create ? (
            <Button title="Add product" variant="secondary" onPress={() => navigation.navigate('NewProduct')} style={styles.tool} />
          ) : null}
          {may.orders ? (
            <Button
              title={waiting > 0 ? `Web orders (${waiting})` : 'Web orders'}
              variant="secondary"
              onPress={() => navigation.navigate('WebOrders')}
              style={styles.tool}
            />
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <NoticeBar notes={notice.notes} tone={notice.tone} action={noticeAction} onDismiss={() => setNotice(null)} />
      ) : null}
      {holdsUnreadable ? (
        <Text variant="caption" style={styles.problem}>
          {HOLDS_NOT_READ}
        </Text>
      ) : null}
      {holdsUnsaved ? (
        <Text variant="caption" style={styles.problem}>
          {HOLD_NOT_SAVED}
        </Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text variant="h2">Products</Text>}
        renderItem={({ item }) => {
          const words = itemWords(item);
          return (
            <TouchableOpacity
              style={[styles.productRow, words.blocked ? styles.blocked : null]}
              onPress={() => add(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${words.price}`}
            >
              <View style={styles.productName}>
                <Text variant="body">{item.name}</Text>
                {words.stock ? <Text variant="muted">{words.stock}</Text> : null}
                {words.blocked ? (
                  <Text variant="caption" style={styles.problem}>
                    {words.blocked}
                  </Text>
                ) : null}
              </View>
              <Text variant="caption">{words.price}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <Text variant="muted">Loading...</Text>
          ) : problem ? (
            <View style={styles.failed}>
              <Text variant="caption" style={styles.problem}>
                {problem}
              </Text>
              <Button title="Try again" variant="secondary" onPress={() => void loadItems({ search })} />
            </View>
          ) : (
            <Text variant="muted">No items</Text>
          )
        }
      />

      <CartPanel
        cart={cart}
        totalCents={totalCents}
        mayChangePrice={may.price}
        canHold={canHold && !busy}
        heldCount={mine.length}
        onUnits={updateQuantity}
        onReweigh={(line) => setWeighing({ item: weighedItemOf(line), mode: 'replace' })}
        onPrice={setPricing}
        onRemove={removeFromCart}
        onHold={holdBasket}
        onShowHeld={openHeld}
        onCheckout={() => navigation.navigate('Payment')}
      />

      <WeightPrompt
        item={weighing?.item ?? null}
        inBasket={inBasket}
        mode={weighing?.mode ?? 'add'}
        onCancel={() => setWeighing(null)}
        onConfirm={confirmWeight}
      />
      <PricePrompt line={pricing} onCancel={() => setPricing(null)} onConfirm={confirmPrice} onUseShelf={backToShelfPrice} />
      <HeldBasketsSheet
        visible={showHeld}
        baskets={mine}
        now={heldAt}
        busy={busy}
        onClose={() => setShowHeld(false)}
        onRecall={(id) => void pickUp(id)}
        onDiscard={throwAway}
      />

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner onBarcode={(r) => void onBarcode(r.value)} onClose={() => setShowScanner(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchRow: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 48,
  },
  tools: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  tool: { flex: 1, minHeight: 44, paddingVertical: theme.spacing.sm },
  productRow: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  productName: { flex: 1 },
  blocked: { opacity: 0.6 },
  problem: { color: theme.colors.danger, paddingHorizontal: theme.spacing.md },
  failed: { gap: theme.spacing.sm, padding: theme.spacing.md },
});
