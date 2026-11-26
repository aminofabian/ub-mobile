import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cleanDisplayText, fetchDepartments, formatKes, generateIdempotencyKey, itemLabel, QTY_SCALE, type DepartmentOption, type StockItem } from '@kiosk/core';
import { CardGloss, FlyToCart, Gloss, ItemPicker, MartText, WeightSheet, type Flight, useKept, MART, RADIUS as MART_RADIUS, SPACE as MART_SPACE, onFill, tint, zoneFor } from '@kiosk/staff';
import { Banner, Button, Card, Chip, Field, FONT, Text, theme } from '@kiosk/ui';
import { addItem, basketProblemWords, basketTotalCents, claimBasket, emptyBasket } from '../lib/basket';
import { MAX_DRAFTS, dropDraft, draftsFor, parkDraft, resumeDraft } from '../lib/drafts';
import { forwardsOf, leftByOthers, unsentFor } from '../lib/forward';
import { planPick } from '../lib/pick';
import { basketHeadline, lastSentSale, lineSummary, queueNotes, queueSummary, saleHeadline, saleStatus, signOutWords } from '../lib/sale-words';
import { useGrocerySession } from '../lib/session';
import { useNow } from '../lib/useNow';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { basketKeeperFor, draftsKeeperFor, forwardKeeperFor } from '../store/invoice-store';

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
      <View style={{ flex: 1 }}>
        <Text style={homeStyles.actionTitle}>{title}</Text>
        <Text variant="muted">{subtitle}</Text>
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
  const { branchName, modes, signOut } = useGrocerySession();
  return (
    <View style={homeStyles.fill}>
      <View style={homeStyles.hero}>
        <Text style={homeStyles.heroEyebrow}>GROCERY{branchName ? ` · ${branchName.toUpperCase()}` : ''}</Text>
        <Text style={homeStyles.heroTitle}>Stock jobs</Text>
        <Text style={homeStyles.heroSub}>Update what is on the shelf and write off what cannot be sold.</Text>
      </View>
      <ScrollView contentContainerStyle={homeStyles.body}>
        {modes.includes('stockEdit') ? (
          <HomeAction
            icon="create-outline"
            title="Edit stock"
            subtitle="Set how many are on the shelf"
            accent={MART.fallbackPrimary}
            onPress={() => navigation.getParent()?.navigate('StockTab' as never)}
          />
        ) : null}
        {modes.includes('spoils') ? (
          <HomeAction
            icon="trash-outline"
            title="Write off"
            subtitle="Spoiled, expired or broken stock"
            accent={MART.danger}
            onPress={() => navigation.getParent()?.navigate('StockTab' as never)}
          />
        ) : null}
        {!modes.includes('stockEdit') && !modes.includes('spoils') ? (
          <Banner tone="info">
            You are signed in, but the shop has not switched on any job for you here yet. Ask the owner to allow selling
            or stock edits.
          </Banner>
        ) : null}
        <Pressable onPress={() => void signOut()} style={homeStyles.signOut}>
          <Text style={{ fontFamily: FONT.medium, color: MART.danger }}>Sign out</Text>
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
  const { api, tenantId, userId, branchId, branchName, modes, renderScanner, signOut } = useGrocerySession();
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

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const index = departmentId === null ? 0 : departments.findIndex((department) => department.id === departmentId) + 1;
    const x = tabX.current[index];
    if (x !== undefined) navRef.current?.scrollTo({ x: Math.max(0, x - 12), animated: true });
  }, [departmentId, departments]);

  useEffect(() => {
    let alive = true;
    fetchDepartments(api).then(
      (list) => alive && setDepartments(list),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [api]);
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

  return (
    <View style={styles.fill}>
      <Gloss />
      <View style={[styles.top, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={styles.head}>
          <View style={styles.plaque}>
            <MartText variant="label" color={MART.fallbackPrimary} style={styles.plaqueMark}>
              {initialsOf(branchName ?? 'Counter')}
            </MartText>
          </View>
          <View style={styles.headText}>
            <MartText variant="heading" numberOfLines={1} style={styles.headTitle}>
              {branchName ?? 'Your counter'}
            </MartText>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.headSub}>
              GROCERY COUNTER
            </MartText>
          </View>
          <Pressable onPress={confirmSignOut} hitSlop={8} style={styles.signOutChip} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={16} color={MART.inkMuted} />
          </Pressable>
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
          (
            <Pressable
              onPress={() => navigation.getParent()?.navigate('SalesTab' as never)}
              accessibilityRole="button"
              accessibilityLabel={`${notes[0].text}. Open the sales waiting to send.`}
              style={({ pressed }) => [styles.notice, pressed && styles.noticePressed]}
            >
              <Ionicons name="alert-circle-outline" size={14} color={MART.danger} />
              <MartText variant="meta" color={MART.danger} numberOfLines={1} style={styles.noticeText}>
                {notes.length === 1 ? notes[0].text : `${notes[0].text} +${notes.length - 1}`}
              </MartText>
              <Ionicons name="chevron-forward" size={12} color={MART.danger} />
            </Pressable>
          )
        ) : null}
        {others > 0 ? (
          <Banner tone="info">{`${others} ${others === 1 ? 'sale' : 'sales'} made by someone else ${others === 1 ? 'is' : 'are'} waiting on this phone. They go when that person signs in.`}</Banner>
        ) : null}
        {lastSale ? <Banner tone="ok">{`Last sale ${saleHeadline(lastSale)}. ${saleStatus(lastSale, now).words}`}</Banner> : null}
        {note && note.tone === 'warn' ? <Banner tone={note.tone}>{note.text}</Banner> : null}
      </View>

      <WeightSheet
        key={weighing?.id ?? 'none'}
        visible={weighing !== null}
        name={weighing ? itemLabel(weighing) : ''}
        perUnitCents={weighing?.sellingCents ?? null}
        onCancel={() => weighing && dropWeighing(weighing.id)}
        onConfirm={(thousandths) => {
          if (!weighing) return null;
          const problem = add(weighing, thousandths);
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
        {[{ id: null as string | null, label: 'All', colour: MART.fallbackPrimary }, ...departments.map((d) => ({ id: d.id, label: d.label, colour: d.color ?? zoneFor(d.label) }))].map((tab, index) => {
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
              accessibilityLabel={tab.id ? `${tab.label} department` : 'All departments'}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              <View style={styles.tabLead}>
                {on ? <View style={[styles.tabDot, { backgroundColor: tab.colour }]} /> : null}
                <MartText variant="label" color={on ? MART.ink : MART.inkMuted} numberOfLines={1} style={styles.tabLabel}>
                  {tab.label}
                </MartText>
              </View>
              <View style={[styles.tabRule, on && { backgroundColor: tab.colour }]} />
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
          inBasket={inBasketById}
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
        <View style={styles.barText}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {toWeigh.length > 1
              ? `${toWeigh.length - 1} more to weigh`
              : basket.lines.length === 0
                ? drafts.length > 0
                  ? `${drafts.length} ${drafts.length === 1 ? 'basket' : 'baskets'} parked above`
                  : 'In this sale'
                : `${basket.lines.length} ${basket.lines.length === 1 ? 'line' : 'lines'}`}
          </MartText>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <MartText variant="title" numberOfLines={1} adjustsFontSizeToFit style={styles.barTitle}>
              {basket.lines.length === 0 ? 'Nothing yet' : formatKes(totalCents)}
            </MartText>
          </Animated.View>
        </View>
        {basket.lines.length > 0 ? (
          <Pressable
            onPress={() => void park()}
            accessibilityRole="button"
            accessibilityLabel="Park this basket"
            style={({ pressed }) => [styles.parkPill, pressed && styles.goPressed]}
          >
            <MartText variant="label" color={MART.ink}>
              Park
            </MartText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => navigation.navigate('Finalize')}
          disabled={basket.lines.length === 0 || !basketKept.ready}
          accessibilityRole="button"
          accessibilityLabel="Open the basket"
          style={({ pressed }) => [styles.goBtn, (basket.lines.length === 0 || !basketKept.ready) && styles.goBtnOff, pressed && styles.goPressed]}
        >
          <MartText variant="label" color={basket.lines.length === 0 ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
            Basket
          </MartText>
          <View style={styles.goDisc}>
            <Ionicons name="arrow-forward" size={15} color={MART.fallbackPrimary} />
          </View>
        </Pressable>
      </View>

      {note?.tone === 'ok' ? (
        <Animated.View style={[styles.toast, { bottom: 100 }]} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={15} color={MART.success} />
          <MartText variant="label" color={MART.ink} numberOfLines={1} style={styles.toastText}>
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
  fill: { flex: 1, backgroundColor: theme.colors.background },
  top: { paddingHorizontal: theme.spacing.md, paddingTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
  plaque: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
  },
  plaqueMark: { letterSpacing: -0.5 },
  headText: { flex: 1, gap: 0 },
  headTitle: { letterSpacing: -0.2 },
  headSub: { letterSpacing: 1.1 },
  readyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  readyLead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  readyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: MART.success },
  readyTitle: { fontFamily: FONT.bold, fontSize: 18, letterSpacing: -0.3, color: MART.ink },
  signOutChip: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(22,24,15,0.92)',
  },
  toastText: { flex: 1, color: MART.paper },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    marginHorizontal: 12,
    marginTop: 2,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: tint(MART.danger, 0.06),
  },
  noticePressed: { opacity: 0.8 },
  noticeText: { flex: 1 },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingRight: 16, paddingBottom: 8 },
  // A horizontal rail in a column must be told its height, or it takes the screen's.
  // A top navigation: labels on a hairline, an underline marking where you are.
  navWrap: { borderBottomWidth: 1, borderBottomColor: MART.border, paddingBottom: 0 },
  aisleRail: { flexGrow: 0 },
  aisles: { paddingHorizontal: 12, gap: 4, alignItems: 'flex-end' },
  tab: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6, alignItems: 'center', gap: 7 },
  tabLead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabDot: { width: 6, height: 6, borderRadius: 999 },
  tabPressed: { opacity: 0.55 },
  tabLabel: { fontSize: 13.5, letterSpacing: -0.15 },
  tabRule: { height: 2.5, alignSelf: 'stretch', borderRadius: 2, backgroundColor: 'transparent' },
  aisle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  aisleOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  aisleDot: { width: 8, height: 8, borderRadius: 999 },
  retry: { marginTop: theme.spacing.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 30,
    backgroundColor: MART.paperElevated,
    shadowColor: MART.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  drafts: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  draftsLabel: { letterSpacing: 1.1, marginRight: 2 },
  draftName: { maxWidth: 150 },
  draftCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  draftPressed: { backgroundColor: MART.paperSunken, transform: [{ scale: 0.97 }] },
  parkPill: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  weighCard: { borderRadius: 24, overflow: 'hidden', backgroundColor: MART.paperElevated, padding: 16 },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingLeft: 20,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: MART.fallbackPrimary,
  },
  goBtnOff: { backgroundColor: MART.paperSunken },
  goPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  goDisc: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paperSunken },
  barText: { flex: 1, marginRight: theme.spacing.md },
  barTitle: { fontFamily: FONT.semibold },
});

const homeStyles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  hero: {
    backgroundColor: MART.fallbackPrimary,
    paddingHorizontal: MART_SPACE.xl,
    paddingTop: 64,
    paddingBottom: MART_SPACE.xxl,
    borderBottomLeftRadius: MART_RADIUS.xl,
    borderBottomRightRadius: MART_RADIUS.xl,
    gap: MART_SPACE.xxs,
  },
  heroEyebrow: { fontFamily: FONT.semibold, fontSize: 10.5, letterSpacing: 0.5, color: onFill(MART.fallbackPrimary).secondary },
  heroTitle: { fontFamily: FONT.bold, fontSize: 26, letterSpacing: -0.5, color: onFill(MART.fallbackPrimary).primary, marginTop: MART_SPACE.xxs },
  heroSub: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 21, color: onFill(MART.fallbackPrimary).secondary, marginTop: MART_SPACE.xs },
  body: { padding: MART_SPACE.xl, gap: MART_SPACE.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MART_SPACE.md,
    padding: MART_SPACE.lg,
    backgroundColor: MART.paperElevated,
    borderRadius: MART_RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
  },
  pressed: { opacity: 0.7 },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: MART_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { fontFamily: FONT.semibold, fontSize: 15, letterSpacing: -0.2, color: MART.ink },
  signOut: {
    marginTop: MART_SPACE.sm,
    paddingVertical: MART_SPACE.md,
    borderRadius: MART_RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
  },
});
