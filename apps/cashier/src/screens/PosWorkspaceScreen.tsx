import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text } from '@kiosk/ui';
import { BarcodeScanner } from '@kiosk/barcode';
import { generateIdempotencyKey, type ApiClient } from '@kiosk/core';
import { FRESH_AT_ONCE, FRESH_WAIT_MS, fetchCategories, fetchFreshItems, fetchShopFlags, fetchWebOrders, searchItems, setShelfPrice, type Category } from '../api/pos-api';
import { CategoryFilter } from '../components/CategoryFilter';
import { fetchServiceBook } from '../api/service-api';
import { CartBar } from '../components/CartBar';
import { CARD_SURFACE, EmptyOrErrorState, TABULAR_NUMS } from '../components/CashierPrimitives';
import { InvoiceBell } from '../components/InvoiceBell';
import { ToolChip } from '../components/ToolChip';
import { ProductTile } from '../components/ProductTile';
import { HeldBasketsSheet } from '../components/HeldBasketsSheet';
import { NoticeBar } from '../components/NoticeBar';
import { PricePrompt } from '../components/PricePrompt';
import { WeightPrompt } from '../components/WeightPrompt';
import { VariantPicker } from '../components/VariantPicker';
import { useCatalogCopy } from '../hooks/useCatalogCopy';
import { cannotAdd, cartCents, handPriced, lineThousandths, weighedItemOf, type CartItem, type CartLine } from '../lib/cart';
import { catalogCopyFor } from '../lib/catalog-storage';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, PressableScale, RADIUS, SPACE, onFill, tint, MartText } from '@kiosk/staff';
import { compactCopyLine, copyLine, fromPhoneWords, NO_PRICE_LIST_WORDS } from '../lib/catalog-words';
import { findItems, NoPriceList, reloadAfterReconnect, type Want } from '../lib/find-items';
import { readStoredFlags } from '../lib/flags-keeper';
import { holdKeeperFor } from '../lib/hold-storage';
import { basketsOf } from '../lib/holds';
import { itemWords } from '../lib/item-words';
import { byTopSellers, loadTopSellers, recordSellerUse } from '../lib/top-sellers';
import { toCents } from '../lib/money';
import { OFFLINE_NEEDS_CONNECTION } from '../lib/offline-words';
import {
  batchWaitMs,
  CHECK_WAIT_MS,
  isNoAnswer,
  QUIET,
  RECALL_WAIT_MAX_MS,
  SEARCH_WAIT_MS,
  SEARCH_WAIT_OFFLINE_MS,
  waitFor,
} from '../lib/reach';
import { prepareRecall } from '../lib/recall-flow';
import { pickScanned } from '../lib/scan-result';
import { describeChanges, servicesChangedBeforePay } from '../lib/service-check';
import { mayChangePrice, mayCreateProduct, mayListWebOrders, maySellAirtime, mayShowServices, mayUseDrafts, type ShopFlags } from '../lib/shop-flags';
import { parkDraft } from '../api/draft-api';
import { ParkedSalesSheet } from '../components/ParkedSalesSheet';
import { holderOf, type TillPerson } from '../lib/till-person';
import {
  describeAddRefusal,
  describeHandPrices,
  describeItemsFailure,
  describeLoadedHolds,
  describeNoBarcode,
  HOLD_NOT_SAVED,
  HOLDS_NOT_READ,
  holdRefusalWords,
  RECALL_REFUSED,
  USE_SHELF_PRICES,
} from '../lib/till-words';
import { howToSell } from '../lib/weight';
import { openOrdersFor, waitingCount } from '../lib/web-orders';
import { usePosStore } from '../store/pos-store';
import { reachSink, useReach } from '../store/reach-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Pos'> & {
  api: ApiClient;
  branchId: string;
  /** The shop's id, which the held baskets are kept under on this phone. */
  tenantId: string;
  person: TillPerson;
  /** What the shop said about its settings: used, and kept on the phone for a till that starts with no connection. */
  learn: (flags: ShopFlags) => void;
};

/** `barcode`: a scan no product matched (the notice offers to add it). `fix`: what the notice's button does. */
type Notice = { notes: string[]; tone: 'info' | 'warning'; barcode?: string; fix?: 'shelf' };

/** How often the till looks for web orders while it is on screen. */
const WEB_ORDERS_EVERY_MS = 60_000;

export function PosWorkspaceScreen({ navigation, route, api, branchId, tenantId, person, learn }: Props) {
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
    putBackShelfPrices,
    removeFromCart,
    replaceCart,
    loadHolds,
    holdCurrent,
    recallHold,
    discardHold,
  } = usePosStore();

  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [weighing, setWeighing] = useState<{ item: CartItem; mode: 'add' | 'replace' } | null>(null);
  const [variantParent, setVariantParent] = useState<CartItem | null>(null);
  const [pricing, setPricing] = useState<CartLine | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [showParked, setShowParked] = useState(false);
  const [parking, setParking] = useState(false);
  const [heldAt, setHeldAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  // The till is looking at the shop for services that changed, before it goes to payment: the Checkout button says so.
  const [verifying, setVerifying] = useState(false);
  const [holdsUnreadable, setHoldsUnreadable] = useState(false);
  const [holdsUnsaved, setHoldsUnsaved] = useState(false);
  const [waiting, setWaiting] = useState(0);
  // Set while the products on screen are the phone's own saved list, and not what the shop just answered.
  const [fromPhone, setFromPhone] = useState<{ asOf: number; cut: boolean } | null>(null);
  const offline = useReach((state) => state.offline);
  const copy = useMemo(
    () => catalogCopyFor({ tenantId, branchId, api, offline: () => useReach.getState().offline }),
    [tenantId, branchId, api]
  );
  const copyState = useCatalogCopy(copy);

  const may = useMemo(
    () => ({
      price: mayChangePrice(flags, person.permissions),
      create: mayCreateProduct(flags, person.permissions),
      orders: mayListWebOrders(person.permissions),
      services: mayShowServices(flags, person.permissions),
      airtime: maySellAirtime(person.permissions),
      drafts: mayUseDrafts(person.permissions),
    }),
    [flags, person.permissions]
  );
  const keeper = useMemo(() => holdKeeperFor(tenantId), [tenantId]);
  const canHold = holdsFor === tenantId;
  // `heldAt` is when the list was last read against the clock: what has run out since is not listed.
  const mine = useMemo(
    () => (canHold ? basketsOf(holds, holderOf(person, branchId), heldAt) : []),
    [canHold, holds, person, branchId, heldAt]
  );
  const totalCents = useMemo(() => cartCents(cart), [cart]);

  const tell = useCallback((notes: string[], tone: 'info' | 'warning' = 'info', barcode?: string) => {
    setNotice(notes.length > 0 ? { notes, tone, ...(barcode ? { barcode } : {}) } : null);
  }, []);

  // The newest search wins: a slow answer to an older one never replaces what is on screen.
  const latestLoad = useRef(0);
  // What the list on screen was asked for, so that it can be asked again when the line comes back.
  const lastWant = useRef<Want>({});
  const loadItems = useCallback(
    async (opts: Want = {}, how: { askShop?: boolean } = {}) => {
      latestLoad.current += 1;
      const mineLoad = latestLoad.current;
      lastWant.current = opts;
      setLoading(true);
      setProblem(null);
      try {
        // The phone has to have been read before it can be said to have no list.
        await copy.load();
        // "Try again" asks the shop whatever the till believes: the answer is how it finds out the line is back.
        const down = useReach.getState().offline && !how.askShop;
        const found = await findItems({
          want: opts,
          ask: () => searchItems(api, { ...opts, branchId }),
          copy: copy.state().open,
          offline: down,
          waitMs: down ? SEARCH_WAIT_OFFLINE_MS : SEARCH_WAIT_MS,
          lost: reachSink.lost,
        });
        if (mineLoad !== latestLoad.current) return null;
        // Browsing (no search, scan or category): lead with this till's best-sellers, the shop's
        // own top products, the way the web till shows its "Top 24". A search shows matches as-is.
        const browsing = !opts.search && !opts.barcode && !opts.categoryId;
        setItems(browsing ? byTopSellers(tenantId, found.items) : found.items);
        setFromPhone(found.from === 'phone' ? { asOf: found.asOf, cut: found.cut } : null);
        return found;
      } catch (error) {
        if (mineLoad === latestLoad.current) {
          const words = error instanceof NoPriceList ? NO_PRICE_LIST_WORDS : describeItemsFailure(error);
          setProblem(words);
          // With products on screen the empty-list message is not drawn, and the list left there looks like the answer.
          if (usePosStore.getState().items.length > 0) tell([words], 'warning');
        }
        return null;
      } finally {
        if (mineLoad === latestLoad.current) setLoading(false);
      }
    },
    [api, branchId, copy, setItems, tell]
  );

  useEffect(() => {
    // Read the best-seller tally first, so the very first grid already leads with the top products.
    void loadTopSellers(tenantId).then(() => loadItems());
  }, [loadItems, tenantId]);

  // The shop's categories, for the filter above the grid. A failure just leaves no filter — the grid still shows everything.
  useEffect(() => {
    let alive = true;
    fetchCategories(api).then((read) => alive && setCategories(read), () => undefined);
    return () => {
      alive = false;
    };
  }, [api]);

  // Pick a category (or clear it): the grid is read again, filtered, keeping whatever is in the search box.
  const pickCategory = useCallback(
    (id: string | null) => {
      setCategoryId(id);
      void loadItems({ search: search.trim() || undefined, ...(id ? { categoryId: id } : {}) });
    },
    [loadItems, search]
  );

  // The line is back: a list that is the phone's own, or that could not be read, is read from the shop now, for what
  // was being looked for. Without this the prices on screen stay the phone's until the cashier searches again.
  const wasOffline = useRef(offline);
  useEffect(() => {
    const wasDown = wasOffline.current;
    wasOffline.current = offline;
    if (reloadAfterReconnect({ wasOffline: wasDown, offline, fromPhone: fromPhone !== null, failed: problem !== null })) {
      void loadItems(lastWant.current);
    }
  }, [offline, fromPhone, problem, loadItems]);

  // What the shop lets a till do. When the shop cannot be asked, what it said last time is used if that was within the
  // week; failing that the till offers only what the person's own permissions allow. The server has the last word.
  useEffect(() => {
    let alive = true;
    waitFor(() => fetchShopFlags(api), CHECK_WAIT_MS, reachSink).then(
      (read) => {
        if (alive) learn(read);
      },
      async (error) => {
        // Only a line that does not answer is a reason to use what the shop said last time: a "no" from the shop is
        // its answer, and the till then offers only what the person's own permissions allow.
        if (!isNoAnswer(error)) return;
        const kept = await readStoredFlags(tenantId, Date.now());
        if (alive && kept && Object.keys(usePosStore.getState().flags).length === 0) setFlags(kept);
      }
    );
    return () => {
      alive = false;
    };
  }, [api, tenantId, learn, setFlags]);

  // The phone's copy of the price list: made when there is none or it is old, and again the moment the line is back.
  useFocusEffect(
    useCallback(() => {
      void copy.makeIfDue();
    }, [copy, offline])
  );

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
        // With no connection there is nothing to look at, and a look that hangs would be left behind every minute.
        if (useReach.getState().offline) return;
        waitFor(() => fetchWebOrders(api), CHECK_WAIT_MS, reachSink).then(
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

  // What the screen the person came back from has to say: a notice (a product was added), a search to run at once (a
  // product that may have been added), or a fresh sale (the last one is over). The till under it is the one that is
  // used; it is never opened a second time.
  const left = route.params?.notice;
  const lookFor = route.params?.search;
  const fresh = route.params?.reload;
  useEffect(() => {
    if (left === undefined && lookFor === undefined && !fresh) return;
    navigation.setParams({ notice: undefined, search: undefined, reload: undefined });
    if (lookFor !== undefined) {
      setSearch(lookFor);
      void loadItems({ search: lookFor });
    } else if (fresh) {
      setSearch('');
      setNotice(null);
      void loadItems();
    }
    if (left) tell([left]);
  }, [left, lookFor, fresh, tell, navigation, loadItems]);

  // The bell was tapped: switch to the Invoices tab, where the forwarded counter invoices live and
  // can be paid. The tab navigator is this screen's own navigator (SellTab is its sibling), so a
  // plain navigate to InvoicesTab switches across. Typed `never` because the tab props are cast.
  const openCounterInvoices = useCallback(() => {
    (navigation as unknown as { navigate: (name: string) => void }).navigate('InvoicesTab');
  }, [navigation]);

  // Park the basket in front of the cashier to the server, then clear it, so a fresh customer can be
  // served and this one picked up again — on this till or another.
  const parkSale = useCallback(async () => {
    const current = usePosStore.getState().cart;
    if (current.length === 0 || parking) return;
    setParking(true);
    try {
      const { ticketNumber } = await parkDraft(api, branchId, current);
      usePosStore.getState().clearCart();
      tell([`Parked as #${ticketNumber}. Pick it up from Parked sales.`]);
    } catch {
      tell(['Could not park the sale. It is still here; check the connection.'], 'warning');
    } finally {
      setParking(false);
    }
  }, [api, branchId, parking, tell]);

  // Resume a parked sale: its lines become the basket. A basket already in front is parked first so
  // nothing is lost.
  const resumeDraft = useCallback(
    async (lines: CartLine[]) => {
      const current = usePosStore.getState().cart;
      if (current.length > 0) {
        try {
          await parkDraft(api, branchId, current);
        } catch {
          // If parking the current one fails, still resume — the cashier chose to.
        }
      }
      usePosStore.getState().replaceCart(lines);
    },
    [api, branchId]
  );

  const add = useCallback(
    (item: CartItem) => {
      // A family parent is not sold itself — tapping it asks which size.
      if (item.variantParent) {
        setVariantParent(item);
        return;
      }
      const why = cannotAdd(item);
      if (why) {
        tell([why], 'warning');
        return;
      }
      // What the till reaches for climbs the best-seller order for next time (and the next session).
      recordSellerUse(tenantId, item.id);
      if (howToSell(item).kind === 'kg') {
        // More of a line that is already there is weighed at that line's own price (it may be the cashier's), which is
        // the price the weight will be added at, not the shelf price on the list.
        const line = usePosStore.getState().cart.find((candidate) => candidate.itemId === item.id);
        setWeighing({ item: line?.weighed ? weighedItemOf(line) : item, mode: 'add' });
        return;
      }
      // A price from the phone's own list is marked with the list's age, so that the Payment screen can say so.
      if (!addToCart(item, fromPhone ? fromPhone.asOf : null)) tell([describeAddRefusal(false)], 'warning');
    },
    [tell, addToCart, fromPhone, tenantId]
  );

  // Each tile's quantity, read from one map built per cart change — so a cart change does not make every tile run
  // `cart.find`, which is what makes a long grid stutter while scrolling.
  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) map.set(line.itemId, line.quantity);
    return map;
  }, [cart]);

  const setQty = useCallback(
    (itemId: string, n: number) => (n <= 0 ? removeFromCart(itemId) : updateQuantity(itemId, n)),
    [removeFromCart, updateQuantity]
  );

  const renderTile = useCallback(
    ({ item }: { item: CartItem }) => (
      <ProductTile
        item={item}
        quantity={cartQtyById.get(item.id) ?? 0}
        weighed={howToSell(item).kind === 'kg'}
        onAdd={() => add(item)}
        onSetQuantity={(n) => setQty(item.id, n)}
      />
    ),
    [cartQtyById, add, setQty]
  );

  const onBarcode = async (value: string) => {
    setShowScanner(false);
    const found = await loadItems({ barcode: value });
    if (found === null) return;
    const picked = pickScanned(found.items, value);
    if (picked.kind === 'one') {
      add(picked.item);
    } else if (picked.kind === 'none') {
      // The phone's own list is only as new as it is: "not on it" is not "no such product", and a product cannot be added with no connection.
      const onPhone = found.from === 'phone';
      tell([describeNoBarcode(value, onPhone)], 'warning', onPhone ? undefined : value);
    } else {
      tell(['More than one product could be this one. Pick the right one from the list.'], 'warning');
    }
  };

  const confirmWeight = (thousandths: number): string | null => {
    if (!weighing) return null;
    const taken =
      weighing.mode === 'replace'
        ? reweigh(weighing.item.id, thousandths)
        : addWeighed(weighing.item, thousandths, fromPhone ? fromPhone.asOf : null);
    if (!taken) return describeAddRefusal(true);
    setWeighing(null);
    return null;
  };

  const confirmPrice = (cents: number, alsoShelf: boolean): string | null => {
    if (!pricing) return null;
    const itemId = pricing.itemId;
    if (!changePrice(itemId, cents)) return 'That price could not be used.';
    // Also writing the shop's shelf price: best-effort, so a failed write never blocks the sale. The
    // line is already at the new price either way.
    if (alsoShelf) {
      void setShelfPrice(api, itemId, cents / 100, branchId).catch(() => {
        tell(['The sale price was changed, but the shelf price could not be saved for the shop.'], 'warning');
      });
    }
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
    // Picking a basket up puts the one in front of the cashier on hold, and a sale with a service in it cannot be put on
    // hold. That is said now, not after the shop has been asked about every line of the basket being picked up.
    if (cart.some((line) => line.service !== undefined)) {
      setShowHeld(false);
      tell([holdRefusalWords({ ok: false, reason: 'service' })], 'warning');
      return;
    }
    setBusy(true);
    try {
      // With no connection the shop is not asked: every line stays as it was held, and the notice says so.
      const down = useReach.getState().offline;
      // Each line is looked up under its own time limit and every call tells the till what it heard, so the wait for the
      // whole basket is as long as the lookups may take and says nothing about the line when it runs out.
      const prepared = await prepareRecall(basket, (lines) =>
        down
          ? Promise.resolve({})
          : waitFor(
              () => fetchFreshItems(api, lines, branchId),
              batchWaitMs(lines.length, FRESH_WAIT_MS, FRESH_AT_ONCE, RECALL_WAIT_MAX_MS),
              QUIET
            )
      );
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

  // The server refuses a price that is not the shelf's from a person who may not set prices, and says so only after
  // the customer has paid. So the till says so first. True when it did.
  const refusedHandPrices = (lines: readonly CartLine[]): boolean => {
    const own = may.price ? [] : handPriced(lines);
    if (own.length === 0) return false;
    setNotice({ notes: [describeHandPrices(own)], tone: 'warning', fix: 'shelf' });
    return true;
  };

  const checking = useRef(false);

  const checkout = async () => {
    if (checking.current || refusedHandPrices(cart)) return;
    if (cart.some((line) => line.service !== undefined)) {
      // A service that has changed in the shop is refused only after the customer has paid. So it is looked at first.
      checking.current = true;
      setBusy(true);
      setVerifying(true);
      try {
        const changes = await servicesChangedBeforePay({
          cart: () => usePosStore.getState().cart,
          held: () => {
            const held = usePosStore.getState().serviceBook;
            return held && held.tenantId === tenantId ? held : null;
          },
          offline: () => useReach.getState().offline,
          read: () => waitFor(() => fetchServiceBook(api, tenantId, Date.now()), CHECK_WAIT_MS, reachSink),
          keep: (book) => usePosStore.getState().setServiceBook(book),
          now: Date.now,
        });
        if (changes.length > 0) {
          setNotice({ notes: [describeChanges(changes)], tone: 'warning' });
          return;
        }
        // What is in front of the cashier now, which they may have changed while the shop was being asked.
        if (refusedHandPrices(usePosStore.getState().cart)) return;
      } finally {
        checking.current = false;
        setBusy(false);
        setVerifying(false);
      }
    }
    // The cashier may have gone to another screen while the shop was being asked: payment is not put in front of them then.
    if (!navigation.isFocused()) return;
    navigation.navigate('Payment');
  };

  const noticeAction =
    notice?.fix === 'shelf'
      ? {
          label: USE_SHELF_PRICES,
          onPress: () => {
            putBackShelfPrices();
            setNotice(null);
          },
        }
      : notice?.barcode && may.create && !offline
        ? {
            label: 'Add product',
            onPress: () => {
              const barcode = notice.barcode;
              setNotice(null);
              if (barcode) navigation.navigate('NewProduct', { barcode });
            },
          }
        : undefined;
  const copyText = copyLine(copyState, Date.now());
  // The short "7 items · 08:36" on a normal day; the full sentence only when something needs saying.
  const copyShort = compactCopyLine(copyState, Date.now());

  const weighingLine = weighing ? cart.find((line) => line.itemId === weighing.item.id) : undefined;
  const inBasket = weighingLine?.weighed ? lineThousandths(weighingLine) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={[styles.searchField, searchFocused && styles.searchFieldFocused]}>
          <Ionicons name="search" size={18} color={searchFocused ? MART.fallbackPrimary : MART.inkQuiet} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            placeholderTextColor={MART.inkQuiet}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onSubmitEditing={() => void loadItems({ search, ...(categoryId ? { categoryId } : {}) })}
            returnKeyType="search"
            accessibilityLabel="Search products"
          />
          {search ? (
            <Pressable onPress={() => { setSearch(''); void loadItems(); }} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={MART.inkQuiet} />
            </Pressable>
          ) : null}
        </View>
        <PressableScale
          onPress={() => setShowScanner(true)}
          scaleTo={0.95}
          accessibilityRole="button"
          accessibilityLabel="Scan a barcode"
          style={styles.scanBtn}
        >
          <Ionicons name="barcode-outline" size={22} color={onFill(MART.fallbackPrimary).primary} />
        </PressableScale>
        <InvoiceBell onOpenInvoice={openCounterInvoices} />
      </View>

      {categories.length > 0 ? (
        <CategoryFilter categories={categories} selected={categoryId} onSelect={pickCategory} />
      ) : null}

      {copyShort ? (
        // Normal day: a quiet one-liner with an icon refresh — "Synced 7 items · 08:36".
        <View style={styles.syncRow}>
          <Ionicons name="cloud-done-outline" size={14} color={MART.inkQuiet} />
          <MartText variant="meta" color={MART.inkMuted} style={styles.syncText}>
            {copyShort}
          </MartText>
          <PressableScale
            onPress={() => void copy.make()}
            disabled={copyState.making !== null}
            accessibilityLabel="Refresh price list"
            accessibilityRole="button"
            hitSlop={8}
            style={[styles.syncBtn, copyState.making !== null && styles.syncBtnBusy]}
          >
            <Ionicons name="refresh" size={16} color={MART.fallbackPrimary} />
          </PressableScale>
        </View>
      ) : copyText ? (
        // Something to explain (offline, saving, cut list…): keep the full sentence and the button.
        <View style={styles.copyRow}>
          <MartText variant="meta" color={MART.inkMuted} style={styles.copyText}>
            {copyText}
          </MartText>
          <Button
            title="Update"
            variant="secondary"
            onPress={() => void copy.make()}
            disabled={copyState.making !== null}
            style={styles.update}
          />
        </View>
      ) : null}

      {may.create || may.orders || may.services || may.airtime || may.drafts ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.tools}
          >
            {may.create ? (
              <ToolChip icon="add-circle-outline" label="Add product" disabled={offline} onPress={() => navigation.navigate('NewProduct')} />
            ) : null}
            {may.drafts ? (
              <ToolChip
                icon="albums-outline"
                label="Parked sales"
                disabled={offline}
                onPress={() => setShowParked(true)}
              />
            ) : null}
            {may.airtime ? (
              <ToolChip icon="cellular-outline" label="Airtime" disabled={offline} onPress={() => navigation.navigate('Airtime')} />
            ) : null}
            {may.orders ? (
              <ToolChip
                icon="globe-outline"
                label="Web orders"
                badge={waiting > 0 ? waiting : undefined}
                disabled={offline}
                onPress={() => navigation.navigate('WebOrders')}
              />
            ) : null}
            {may.services ? (
              <ToolChip icon="cut-outline" label="Services" onPress={() => navigation.navigate('Services')} />
            ) : null}
          </ScrollView>
          {offline && (may.create || may.orders) ? (
            <MartText variant="meta" color={MART.inkQuiet} style={styles.needs}>
              {OFFLINE_NEEDS_CONNECTION}
            </MartText>
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
      {fromPhone ? (
        <View style={styles.stale} accessibilityRole="alert">
          <Text variant="caption">{fromPhoneWords(fromPhone.asOf, Date.now(), fromPhone.cut)}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        // Smooth scrolling: render a little ahead, recycle off-screen tiles, and batch work so a flick never stutters.
        // Three to a row means more tiles per screen, so the first render and each batch cover whole rows.
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          items.length > 0 ? (
            <View style={styles.gridHeader}>
              <MartText variant="title">{search.trim() ? 'Results' : categoryId ? 'In this aisle' : 'Best sellers'}</MartText>
              <MartText variant="meta" color={MART.inkQuiet} style={TABULAR_NUMS}>
                {items.length === 1 ? '1 product' : `${items.length} products`}
              </MartText>
            </View>
          ) : null
        }
        renderItem={renderTile}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletonWrap} accessibilityLabel="Reading the shelf">
              <View style={styles.skeletonGrid}>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <View key={idx} style={styles.skeletonTile}>
                    <View style={styles.skeletonThumb} />
                    <View style={styles.skeletonLineWide} />
                    <View style={styles.skeletonLineShort} />
                  </View>
                ))}
              </View>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
                Reading the shelf…
              </MartText>
            </View>
          ) : problem ? (
            <EmptyOrErrorState
              icon="cloud-offline-outline"
              title="Shelf not loaded"
              message={problem}
              actionLabel="Try again"
              actionIcon="refresh"
              onAction={() => void loadItems({ search }, { askShop: true })}
            />
          ) : (
            <EmptyOrErrorState
              icon="basket-outline"
              title={search.trim() ? 'Nothing matches' : 'No products yet'}
              message={search.trim() ? 'Try another name, or scan the barcode.' : 'Add a product, or pull the price list.'}
              actionLabel={search.trim() ? 'Clear search' : may.create && !offline ? 'Add product' : undefined}
              actionIcon={search.trim() ? 'close-circle-outline' : 'add-circle-outline'}
              onAction={
                search.trim()
                  ? () => {
                      setSearch('');
                      void loadItems(categoryId ? { categoryId } : {});
                    }
                  : may.create && !offline
                    ? () => navigation.navigate('NewProduct')
                    : undefined
              }
            />
          )
        }
      />

      <CartBar
        count={cart.length}
        totalCents={totalCents}
        canHold={canHold && !busy}
        heldCount={mine.length}
        checking={verifying}
        onHold={holdBasket}
        onShowHeld={openHeld}
        onCheckout={() => void checkout()}
      />

      <WeightPrompt
        item={weighing?.item ?? null}
        inBasket={inBasket}
        mode={weighing?.mode ?? 'add'}
        onCancel={() => setWeighing(null)}
        onConfirm={confirmWeight}
      />
      <VariantPicker
        api={api}
        parent={variantParent}
        onClose={() => setVariantParent(null)}
        onPick={(variant) => {
          setVariantParent(null);
          add(variant);
        }}
      />
      <ParkedSalesSheet
        api={api}
        branchId={branchId}
        visible={showParked}
        cartCount={cart.length}
        parking={parking}
        onPark={() => void parkSale()}
        onClose={() => setShowParked(false)}
        onResume={(lines) => void resumeDraft(lines)}
      />
      <PricePrompt line={pricing} canSetShelf={may.price} onCancel={() => setPricing(null)} onConfirm={confirmPrice} onUseShelf={backToShelfPrice} />
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
  container: { flex: 1, backgroundColor: MART.paper },
  // A clear top padding and the page background give the grid its own band, so the tools row above
  // (whose buttons carry an elevation shadow on Android) can never bleed onto the "Products" header.
  grid: {
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.lg,
    backgroundColor: MART.paper,
  },
  gridRow: { gap: SPACE.sm, marginBottom: SPACE.sm },
  gridHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.sm,
  },
  skeletonWrap: {
    paddingTop: SPACE.sm,
    gap: SPACE.md,
    alignItems: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    width: '100%',
  },
  skeletonTile: {
    width: '31.5%',
    ...CARD_SURFACE,
    padding: SPACE.sm,
    gap: SPACE.xs,
  },
  skeletonThumb: {
    width: '100%',
    aspectRatio: 1.7,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
  },
  skeletonLineWide: {
    height: 12,
    width: '82%',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    marginTop: SPACE.xxs,
  },
  skeletonLineShort: {
    height: 12,
    width: '54%',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  centerText: { textAlign: 'center', maxWidth: 260 },
  searchRow: {
    flexDirection: 'row',
    padding: SPACE.md,
    gap: SPACE.sm,
    alignItems: 'center',
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 50,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  // Focus lifts the field into the brand green with a soft ring — one clear "you are here" signal.
  searchFieldFocused: {
    borderColor: MART.fallbackPrimary,
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontFamily: FONT.regular, fontSize: 15, color: MART.ink, paddingVertical: 0 },
  scanBtn: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  tools: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  productRow: {
    padding: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: MART.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  copyText: { flex: 1 },
  update: { minHeight: 40, paddingVertical: SPACE.sm },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  syncText: { flex: 1, color: MART.inkMuted, fontSize: 13 },
  syncBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  syncBtnBusy: { opacity: 0.5 },
  needs: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.sm },
  stale: {
    marginHorizontal: SPACE.md,
    marginBottom: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    backgroundColor: tint(MART.warning, 0.12),
    borderColor: MART.warning,
  },
  productName: { flex: 1 },
  blocked: { opacity: 0.6 },
  problem: { color: MART.danger, paddingHorizontal: SPACE.md },
  failed: { gap: SPACE.sm, padding: SPACE.md },
});
