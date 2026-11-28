import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fetchDepartments,
  formatKes,
  generateIdempotencyKey,
  itemLabel,
  QTY_SCALE,
  setItemWeighed,
  visibleDepartments,
  type DepartmentOption,
  type StockItem,
} from '@kiosk/core';
import {
  FlyToCart,
  Gloss,
  ItemPicker,
  MartText,
  PressableScale,
  WeightSheet,
  type Flight,
  useKept,
  FONT,
  WEIGHT,
  MART,
  RADIUS,
  SHADOW,
  SPACE,
  onFill,
  tint,
  zoneFor,
} from '@kiosk/staff';
import { Banner, Button, Text } from '@kiosk/ui';
import { addItem, basketProblemWords, basketTotalCents, claimBasket, emptyBasket, removeLine, setQuantity } from '../lib/basket';
import { MAX_DRAFTS, dropDraft, draftsFor, parkDraft, resumeDraft } from '../lib/drafts';
import { forwardsOf, leftByOthers, unsentFor } from '../lib/forward';
import { planPick, unitsFromThousandths } from '../lib/pick';
import { lastSentSale, lineSummary, queueNotes, queueSummary, saleHeadline, saleStatus, signOutWords } from '../lib/sale-words';
import { AMBER } from '../theme/amber';
import { useGrocerySession } from '../lib/session';
import { useNow } from '../lib/useNow';
import { openTab } from '../navigation/root-nav';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { basketKeeperFor, draftsKeeperFor, forwardKeeperFor } from '../store/invoice-store';

const TABULAR = { fontVariant: ['tabular-nums'] as Array<'tabular-nums'> };

type Props = NativeStackScreenProps<GroceryStackParamList, 'Builder'>;

type Note = { tone: 'ok' | 'warn'; text: string };

/** The two letters that stand for the counter, the same rule the cashier's plaque uses. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? 'G') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

/**
 * The counter. Scan or search to put things in the basket; one scanned item goes in at once, and one sold by weight
 * asks how much first. What the phone has not yet been able to send is said here, above the items, so a sale is never
 * quietly missing.
 */
/** A big tappable action card for the stock-only home: an icon, a title and a quiet line under it. */
function HomeAction({
  icon,
  title,
  subtitle,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [homeStyles.action, pressed && homeStyles.pressed]}
    >
      <View style={[homeStyles.actionIcon, { backgroundColor: tint(accent, 0.16) }]}>
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <MartText variant="heading">{title}</MartText>
        <MartText variant="meta" color={AMBER.inkQuiet}>
          {subtitle}
        </MartText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
    </Pressable>
  );
}

/**
 * What a clerk who may not sell sees instead of the counter: the stock jobs the shop lets them do. No basket, no
 * selling — just the work they are here for. Selling needs `grocery.invoices.create`; this person does not have it.
 */
function StockOnlyHome({ navigation }: Props) {
  const { branchName, modes, mayOrder, signOut } = useGrocerySession();
  const openStock = (screen: 'EditStock' | 'Spoils' | 'Order') => {
    openTab('StockTab', screen);
  };
  return (
    <View style={homeStyles.fill}>
      <Gloss />
      <View style={homeStyles.hero}>
        <MartText variant="shelf" color={onFill(MART.fallbackPrimary).secondary} style={homeStyles.heroEyebrow}>
          {branchName ? branchName.toUpperCase() : 'GROCERY'}
        </MartText>
        <MartText variant="display" color={onFill(MART.fallbackPrimary).primary} style={homeStyles.heroTitle}>
          Stock jobs
        </MartText>
        <MartText variant="body" color={onFill(MART.fallbackPrimary).secondary} style={homeStyles.heroSub}>
          Update what is on the shelf, write off what cannot be sold, and order for your department.
        </MartText>
      </View>
      <ScrollView contentContainerStyle={homeStyles.body}>
        {modes.includes('stockEdit') ? (
          <HomeAction
            icon="create-outline"
            title="Edit stock"
            subtitle="Set how many are on the shelf"
            accent={MART.fallbackPrimary}
            onPress={() => openStock('EditStock')}
          />
        ) : null}
        {modes.includes('spoils') ? (
          <HomeAction
            icon="trash-outline"
            title="Write off"
            subtitle="Spoiled, expired or broken stock"
            accent={MART.danger}
            onPress={() => openStock('Spoils')}
          />
        ) : null}
        {mayOrder ? (
          <HomeAction
            icon="cart-outline"
            title="Order"
            subtitle="Place a supplier order for your department"
            accent={AMBER.primary}
            onPress={() => openStock('Order')}
          />
        ) : null}
        {!modes.includes('stockEdit') && !modes.includes('spoils') && !mayOrder ? (
          <Banner tone="info">
            You are signed in, but the shop has not switched on any job for you here yet. Ask the owner to allow selling
            or stock edits.
          </Banner>
        ) : null}
        <Pressable onPress={() => void signOut()} style={homeStyles.signOut} accessibilityRole="button" accessibilityLabel="Sign out">
          <MartText variant="label" color={MART.danger}>
            Sign out
          </MartText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function InvoiceBuilderScreen(props: Props) {
  const { maySell } = useGrocerySession();
  if (!maySell) return <StockOnlyHome {...props} />;
  return <SellCounter {...props} />;
}

function SellCounter({ navigation }: Props) {
  const { api, tenantId, userId, branchId, branchName, modes, mayOrder, renderScanner, signOut, user } =
    useGrocerySession();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const basketKeeper = useMemo(() => basketKeeperFor(tenantId), [tenantId]);
  const draftsKeeper = useMemo(() => draftsKeeperFor(tenantId), [tenantId]);
  const draftsKept = useKept(draftsKeeper);
  const forwardKeeper = useMemo(() => forwardKeeperFor(tenantId), [tenantId]);
  const basketKept = useKept(basketKeeper);
  const forwardKept = useKept(forwardKeeper);
  const [toWeigh, setToWeigh] = useState<StockItem[]>([]);
  /** The shop's departments, and which one the shelf is narrowed to. */
  const [flights, setFlights] = useState<Flight[]>([]);
  const barBox = useRef<View>(null);
  const nextFlight = useRef(0);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  /** Where each tab starts, so the chosen one can be brought into view. */
  const navRef = useRef<ScrollView>(null);
  const tabX = useRef<number[]>([]);
  const showAllTab = departments.length > 1;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const index = !showAllTab
      ? 0
      : departmentId === null
        ? 0
        : departments.findIndex((department) => department.id === departmentId) + 1;
    const x = tabX.current[index];
    if (x !== undefined) navRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
  }, [departmentId, departments, showAllTab]);

  useEffect(() => {
    let alive = true;
    fetchDepartments(api).then(
      (list) => {
        if (!alive) return;
        const visible = visibleDepartments(list, user);
        setDepartments(visible);
        // One assigned department: lock the shelf to it (no misleading "All").
        if (visible.length === 1) {
          setDepartmentId(visible[0]!.id);
          return;
        }
        setDepartmentId((current) => (current && visible.some((d) => d.id === current) ? current : null));
      },
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [api, user]);
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    if (note?.tone !== 'ok') return undefined;
    const timer = setTimeout(() => setNote(null), 2200);
    return () => clearTimeout(timer);
  }, [note]);

  // Coming back to the counter from another screen, the last scan's message is old news.
  useFocusEffect(
    useCallback(() => {
      setNote(null);
    }, [])
  );

  const owner = useMemo(() => ({ ownerId: userId, branchId }), [userId, branchId]);
  const basket = useMemo(() => claimBasket(basketKept.value, owner, now), [basketKept.value, owner, now]);

  const totalCents = basketTotalCents(basket);
  const pulse = useRef(new Animated.Value(1)).current;
  const lastTotal = useRef(totalCents);
  useEffect(() => {
    if (lastTotal.current === totalCents) return;
    lastTotal.current = totalCents;
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 110, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [totalCents, pulse]);

  const [focusSignal, setFocusSignal] = useState(0);

  const inBasketById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of basket.lines) {
      counts[line.itemId] = (counts[line.itemId] ?? 0) + Math.round(line.quantityUnits / QTY_SCALE);
    }
    return counts;
  }, [basket.lines]);

  const mine = useMemo(() => forwardsOf(forwardKept.value, userId), [forwardKept.value, userId]);
  const notes = queueNotes(queueSummary(mine, now));
  const lastSale = lastSentSale(mine, now);
  const others = leftByOthers(forwardKept.value, userId);
  const unsent = unsentFor(forwardKept.value, userId);
  const readFailed = basketKept.failed || forwardKept.failed;

  /** Puts `units` of an item in the basket. Returns what stopped it, or null when it went in. */
  const add = useCallback(
    (item: StockItem, units: number): string | null => {
      if (!basketKeeper.isLoaded()) return 'The basket is still opening. Try again in a moment.';
      const at = Date.now();
      const base = claimBasket(basketKeeper.get(), owner, at);
      const result = addItem(base, item, units, at, generateIdempotencyKey());
      if (!result.ok) return basketProblemWords[result.why];
      basketKeeper.update(() => result.basket);
      const line = result.basket.lines.find((candidate) => candidate.lineId === result.lineId);
      setNote({ tone: 'ok', text: line ? `Added ${line.name}: ${lineSummary(line)}` : 'Added.' });
      return null;
    },
    [basketKeeper, owner]
  );

  const onPick = useCallback(
    (item: StockItem) => {
      const plan = planPick(item);
      if (plan.kind === 'refuse') {
        setNote({ tone: 'warn', text: `${itemLabel(item)}: ${basketProblemWords[plan.why]}` });
      } else if (plan.kind === 'weigh') {
        setNote(null);
        setToWeigh((queue) => (queue.some((queued) => queued.id === item.id) ? queue : [...queue, item]));
      } else {
        const problem = add(item, plan.units);
        if (problem) setNote({ tone: 'warn', text: `${itemLabel(item)}: ${problem}` });
      }
    },
    [add]
  );

  /** One fewer of this product on the shelf card. Weighed lines come out whole; unit lines step by one. */
  const onRemove = useCallback(
    (item: StockItem) => {
      const at = Date.now();
      const current = claimBasket(basketKeeper.get(), owner, at);
      const line = current.lines.find((candidate) => candidate.itemId === item.id);
      if (!line) return;
      if (line.weighed || line.quantityUnits <= QTY_SCALE) {
        basketKeeper.update(() => removeLine(current, line.lineId, at));
        return;
      }
      const result = setQuantity(current, line.lineId, line.quantityUnits - QTY_SCALE, at);
      if (result.ok) basketKeeper.update(() => result.basket);
    },
    [basketKeeper, owner]
  );

  // Parked baskets belong to this person at this branch, and age out with the working basket.
  const drafts = useMemo(() => draftsFor(draftsKept.value, userId, now), [draftsKept.value, userId, now]);

  /** Parks what is on the counter, nameless: the first line names it, as the web counter does. */
  const park = useCallback(() => {
    const result = parkDraft(draftsKept.value, claimBasket(basketKeeper.get(), owner, Date.now()), '', Date.now());
    if (!result.ok) {
      setNote({ tone: 'warn', text: result.why === 'full' ? `No room for more than ${MAX_DRAFTS} parked baskets. Pick one up first.` : 'There is nothing in the basket to park.' });
      return;
    }
    draftsKeeper.update(() => result.state);
    basketKeeper.update(() => emptyBasket(owner, Date.now()));
    setNote({ tone: 'ok', text: 'Parked. Pick it up from the rail below.' });
  }, [basketKeeper, draftsKeeper, draftsKept.value, owner]);

  /** Takes a parked basket back: what is on the counter is parked in its place, so nothing is lost either way. */
  const pickUpDraft = useCallback(
    async (id: string) => {
      const at = Date.now();
      const current = claimBasket(basketKeeper.get(), owner, at);
      const resumed = resumeDraft(draftsKept.value, id, owner.ownerId, at);
      if (!resumed) return;
      const parked = current.lines.length > 0 ? parkDraft(resumed.state, current, '', at) : { ok: true as const, state: resumed.state };
      if (!parked.ok) {
        setNote({ tone: 'warn', text: `No room for more than ${MAX_DRAFTS} parked baskets. Throw one away first.` });
        return;
      }
      draftsKeeper.update(() => parked.state);
      basketKeeper.update(() => claimBasket(resumed.draft.basket, owner, at));
      setNote({ tone: 'ok', text: `Picked up ${resumed.draft.name}.` });
    },
    [basketKeeper, draftsKeeper, draftsKept.value, owner]
  );

  const dropDraftAt = useCallback(
    (id: string) => {
      const draft = draftsFor(draftsKept.value, userId, Date.now()).find((candidate) => candidate.id === id);
      if (!draft) return;
      Alert.alert('Throw this basket away?', `${draft.name} — ${draft.basket.lines.length} ${draft.basket.lines.length === 1 ? 'line' : 'lines'}.`, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Throw away', style: 'destructive', onPress: () => draftsKeeper.update((state) => dropDraft(state, id)) },
      ]);
    },
    [draftsKeeper, draftsKept.value, userId]
  );

  const weighing = toWeigh[0] ?? null;
  const dropWeighing = useCallback((id: string) => setToWeigh((queue) => queue.filter((queued) => queued.id !== id)), []);

  const confirmSignOut = useCallback(() => {
    const said = signOutWords(unsentFor(forwardKeeper.get(), userId), claimBasket(basketKeeper.get(), owner, Date.now()).lines.length);
    if (said === null) {
      void signOut();
      return;
    }
    Alert.alert('Sign out?', said, [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [basketKeeper, forwardKeeper, owner, signOut, userId]);

  const openMenu = useCallback(() => {
    const actions: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: 'Sales waiting to send', onPress: () => navigation.getParent()?.navigate('SalesTab' as never) },
      { text: 'Stock', onPress: () => navigation.getParent()?.navigate('StockTab' as never) },
    ];
    if (mayOrder) {
      actions.push({
        text: 'Order',
        onPress: () => openTab('StockTab', 'Order'),
      });
    }
    actions.push(
      { text: 'Sign out', style: 'destructive', onPress: () => void confirmSignOut() },
      { text: 'Close', style: 'cancel' },
    );
    Alert.alert(branchName ?? 'Your counter', 'Grocery counter', actions);
  }, [branchName, confirmSignOut, mayOrder, navigation]);


  return (
    <View style={styles.fill}>
      <Gloss />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.head}>
          <View style={styles.plaque}>
            <MartText variant="label" color={AMBER.primaryDeep} style={styles.plaqueMark}>
              {initialsOf(branchName ?? 'Counter')}
            </MartText>
          </View>
          <View style={styles.headText}>
            <MartText variant="title" numberOfLines={1} style={styles.headTitle}>
              {branchName ?? 'Your counter'}
            </MartText>
          </View>
        </View>

        {readFailed ? (
          <Banner tone="danger">
            <Text variant="caption">What is kept on this phone could not be read, so selling is paused. Nothing has been lost.</Text>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => {
                basketKept.retry();
                forwardKept.retry();
              }}
              style={styles.retry}
            />
          </Banner>
        ) : null}
        {notes.length > 0 ? (
          <Pressable
            onPress={() => navigation.getParent()?.navigate('SalesTab' as never)}
            accessibilityRole="button"
            accessibilityLabel={`${notes[0].text}. Open sales waiting to send.`}
            style={({ pressed }) => [styles.notice, pressed && styles.noticePressed]}
          >
            <View style={styles.noticeDot} />
            <MartText variant="meta" color={MART.inkMuted} numberOfLines={1} style={styles.noticeText}>
              {notes.length === 1
                ? 'Sale waiting to send — open Sales'
                : `${notes.length} sales waiting — open Sales`}
            </MartText>
            <Ionicons name="chevron-forward" size={12} color={MART.inkQuiet} />
          </Pressable>
        ) : null}
        {others > 0 ? (
          <Banner tone="info">{`${others} ${others === 1 ? 'sale' : 'sales'} made by someone else ${others === 1 ? 'is' : 'are'} waiting on this phone. They go when that person signs in.`}</Banner>
        ) : null}
        {lastSale ? (
          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1} style={styles.lastSale}>
            {`Last sale ${saleHeadline(lastSale)} · ${saleStatus(lastSale, now).words}`}
          </MartText>
        ) : null}
        {note && note.tone === 'warn' ? <Banner tone={note.tone}>{note.text}</Banner> : null}
      </View>

      <WeightSheet
        key={weighing?.id ?? 'none'}
        visible={weighing !== null}
        name={weighing ? itemLabel(weighing) : ''}
        perUnitCents={weighing?.sellingCents ?? null}
        onCancel={() => weighing && dropWeighing(weighing.id)}
        onNotWeighed={
          weighing
            ? async () => {
                const result = await setItemWeighed(api, weighing.id, false);
                if (!result.ok) return result.words;
                dropWeighing(weighing.id);
                setNote({ tone: 'ok', text: `${itemLabel(weighing)} is no longer sold by weight.` });
                return null;
              }
            : undefined
        }
        onConfirm={(thousandths) => {
          if (!weighing) return null;
          // WeightSheet is in thousandths; the basket is in ten-thousandths (QTY_SCALE).
          const problem = add(weighing, unitsFromThousandths(thousandths));
          if (!problem) dropWeighing(weighing.id);
          return problem;
        }}
      />

      <View style={styles.navWrap}>
        <ScrollView
          ref={navRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.aisleRail}
          contentContainerStyle={styles.aisles}
          keyboardShouldPersistTaps="handled"
        >
        {[
          ...(showAllTab
            ? [{ id: null as string | null, label: 'All', colour: AMBER.primary }]
            : []),
          ...departments.map((d) => ({
            id: d.id as string | null,
            label: d.label,
            colour: d.color ?? zoneFor(d.label),
          })),
        ].map((tab, index) => {
          const on = departmentId === tab.id;
          return (
            <Pressable
              key={tab.id ?? 'all'}
              onPress={() => setDepartmentId(tab.id)}
              onLayout={(event) => {
                tabX.current[index] = event.nativeEvent.layout.x;
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.id ? `${tab.label} department` : 'All assigned departments'}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.tabPressed]}
            >
              <MartText
                variant="label"
                color={on ? AMBER.primaryDeep : AMBER.inkMuted}
                numberOfLines={1}
                style={[styles.tabLabel, on ? styles.tabLabelOn : null]}
              >
                {tab.label}
              </MartText>
            </Pressable>
          );
        })}
        </ScrollView>
      </View>

      <View style={styles.fill}>
        <ItemPicker
          api={api}
          branchId={branchId}
          onPick={onPick}
          onRemove={onRemove}
          inBasket={inBasketById}
          focusSignal={focusSignal}
          showFilter
          showAdd
          accent={AMBER.primary}
          onPickRect={(rect) => {
            const initials = rect.name
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((word) => word[0])
              .join('')
              .toUpperCase();
            barBox.current?.measureInWindow((bx, by, bw, bh) => {
              setFlights((before) => [
                ...before,
                {
                  id: ++nextFlight.current,
                  initials,
                  colour: zoneFor(rect.name),
                  from: { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
                  to: { x: bx + 54, y: by + 44 },
                },
              ]);
            });
          }}
          cards
          {...(departmentId ? { itemTypeId: departmentId } : {})}
          continuous
          scanNote={note ? note.text : null}
          scanTone={note ? note.tone : 'ok'}
          {...(renderScanner ? { renderScanner } : {})}
        />
      </View>

      {drafts.length > 0 ? (
        <View style={styles.drafts}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.draftsLabel}>
            PARKED
          </MartText>
          {drafts.map((draft) => (
            <Pressable
              key={draft.id}
              onPress={() => void pickUpDraft(draft.id)}
              onLongPress={() => dropDraftAt(draft.id)}
              accessibilityRole="button"
              accessibilityLabel={`Pick up ${draft.name}, ${draft.basket.lines.length} lines. Long press to throw it away.`}
              style={({ pressed }) => [styles.draftChip, pressed && styles.draftPressed]}
            >
              <MartText variant="label" numberOfLines={1} style={styles.draftName}>
                {draft.name}
              </MartText>
              <View style={styles.draftCount}>
                <MartText variant="shelf" color={MART.inkMuted}>
                  {draft.basket.lines.length}
                </MartText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Above the tab bar only — the tab already owns the home-indicator inset. */}
      <View ref={barBox} style={styles.bar}>
        {basket.lines.length > 0 ? (
          <PressableScale
            onPress={() => void park()}
            scaleTo={0.95}
            style={styles.side}
            accessibilityRole="button"
            accessibilityLabel="Park this basket"
          >
            <Ionicons name="pause-outline" size={18} color={MART.ink} />
          </PressableScale>
        ) : null}
        <View style={styles.barText}>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.barMeta}>
            {toWeigh.length > 1
              ? `${toWeigh.length - 1} more to weigh`
              : basket.lines.length === 0
                ? drafts.length > 0
                  ? `${drafts.length} parked`
                  : 'Empty'
                : basket.lines.length === 1
                  ? '1 item'
                  : `${basket.lines.length} items`}
          </MartText>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <MartText variant="title" numberOfLines={1} adjustsFontSizeToFit style={[styles.barTitle, TABULAR]}>
              {basket.lines.length === 0 ? 'KES 0.00' : formatKes(totalCents)}
            </MartText>
          </Animated.View>
        </View>
        <PressableScale
          onPress={() => navigation.navigate('Finalize')}
          disabled={basket.lines.length === 0 || !basketKept.ready}
          scaleTo={0.97}
          style={[
            styles.goBtn,
            basket.lines.length === 0 ? styles.goBtnIdle : styles.goBtnReady,
            !basketKept.ready && styles.dim,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open the basket"
        >
          <MartText
            variant="label"
            color={basket.lines.length === 0 ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}
            style={styles.nextLabel}
          >
            Next
          </MartText>
        </PressableScale>
      </View>

      {note?.tone === 'ok' ? (
        <Animated.View style={[styles.toast, { bottom: 100 }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={15} color={MART.success} />
          <MartText variant="label" color={MART.paper} numberOfLines={1} style={styles.toastText}>
            {note.text}
          </MartText>
        </Animated.View>
      ) : null}

      {/* Last, so the ghost flies over the shelf and lands on the bar rather than behind them. */}
      <FlyToCart flights={flights} onDone={(id) => setFlights((before) => before.filter((flight) => flight.id !== id))} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: AMBER.page },
  top: { paddingHorizontal: SPACE.md, paddingTop: 2 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AMBER.card,
    borderWidth: 1,
    borderColor: AMBER.line,
  },
  menuPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  headCentred: { alignItems: 'center' },
  addItem: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: AMBER.wash,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingBottom: SPACE.xs },
  plaque: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
    ...SHADOW.card,
  },
  plaqueMark: { letterSpacing: -0.5 },
  headText: { flex: 1, gap: 0 },
  headTitle: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, letterSpacing: -0.3 },
  signOutChip: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken },
  toast: {
    position: 'absolute',
    left: SPACE.md,
    right: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 40,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(22,24,15,0.92)',
    ...SHADOW.card,
  },
  toastText: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    marginHorizontal: SPACE.md,
    marginTop: 4,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  noticeDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: MART.danger },
  noticePressed: { opacity: 0.75 },
  noticeText: { flex: 1 },
  lastSale: { marginHorizontal: SPACE.md, marginTop: SPACE.xs, marginBottom: 2 },
  navWrap: { paddingBottom: SPACE.xs },
  aisleRail: { flexGrow: 0 },
  aisles: { paddingHorizontal: SPACE.md, gap: SPACE.sm, alignItems: 'center', paddingVertical: SPACE.xs },
  tab: {
    minHeight: 36,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabOn: { backgroundColor: AMBER.wash, borderColor: AMBER.wash },
  tabPressed: { opacity: 0.75 },
  tabLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, fontSize: 14, letterSpacing: -0.15 },
  tabLabelOn: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  retry: { marginTop: SPACE.sm },
  barCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AMBER.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: AMBER.line,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    width: '96%',
    maxWidth: 760,
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    ...SHADOW.floating,
  },
  side: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barMeta: { fontSize: 11 },
  dim: { opacity: 0.5 },
  drafts: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingBottom: SPACE.sm },
  draftsLabel: { letterSpacing: 1.1, marginRight: 2 },
  draftName: { maxWidth: 150 },
  draftCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  draftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  draftPressed: { backgroundColor: MART.paperSunken, transform: [{ scale: 0.97 }] },
  goBtn: {
    minHeight: 42,
    minWidth: 96,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 14, letterSpacing: -0.2 },
  goBtnIdle: {
    backgroundColor: MART.paperSunken,
  },
  goBtnReady: {
    backgroundColor: MART.fallbackPrimary,
  },
  barText: { flex: 1, gap: 1 },
  barTitle: { fontFamily: FONT.bold, fontWeight: WEIGHT.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
});

const homeStyles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: AMBER.page },
  hero: {
    backgroundColor: MART.fallbackPrimary,
    paddingHorizontal: SPACE.xl,
    paddingTop: 64,
    paddingBottom: SPACE.xxl,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    gap: SPACE.xxs,
  },
  heroEyebrow: { letterSpacing: 0.5 },
  heroTitle: { marginTop: SPACE.xxs },
  heroSub: { marginTop: SPACE.xs },
  body: { padding: SPACE.xl, gap: SPACE.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.lg,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },
  pressed: { opacity: 0.7 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    marginTop: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
  },
});
