import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { classifyWrite, formatQty, parseQty, qtyProblemWords, readFailureWords } from '@kiosk/core';
import { fetchSupplierItemLinks, fetchSuppliers } from '@kiosk/orders';
import { GUTTER, MartText, MART, RADIUS, Sheet, SPACE, tint, onFill, useKept } from '@kiosk/staff';
import { itemIdsOf, suppliersForCounting, type SupplierChoice } from '../lib/supplier-scope';
import type { BannerTone } from '@kiosk/ui';
import { closeTake, fetchActiveTake, fetchTake, findByCode, isAlreadyOpen, startTake } from '../api/stock-api';
import { todayOn } from '../lib/dates';
import { useCountSender } from '../lib/sender';
import { useStockSession } from '../lib/session';
import {
  claim,
  closeBlockedBy,
  decideStart,
  discardPending,
  filterRows,
  heldBy,
  lineForItem,
  mergeFresh,
  progressOf,
  retryRefused,
  rowsOf,
  typeCount,
  type HeldBy,
  type Row as TakeRow,
  type RowFilter,
  type StockTake,
} from '../lib/stock-take';
import { scopeKeeperFor, takeKeeperFor } from '../lib/take-store';
import { closeBlockedWords, differenceWords, FILTERS, heldWords, problemWords, typeFailureWords } from '../lib/take-words';

type Stage =
  | { name: 'loading' }
  | { name: 'failed'; words: string }
  | { name: 'choose' }
  | { name: 'stale'; stale: { id: string; date: string } }
  | { name: 'held_elsewhere'; count: number; by: HeldBy }
  | { name: 'list' };

type Note = { tone: BannerTone; text: string };

const SAME_CODE_MS = 2500;

function plainNumber(units: number): string {
  return formatQty(units).replace(/,/g, '');
}

function subtitleFor(row: TakeRow): string {
  const parts: string[] = [];
  if (row.line.aisle) parts.push(row.line.aisle);
  if (row.line.sku) parts.push(row.line.sku);
  if (row.line.systemUnits !== null) parts.push(`System ${formatQty(row.line.systemUnits)}`);
  if (row.difference !== null && row.difference !== 0) parts.push(`Difference ${differenceWords(row.difference, formatQty)}`);
  if (row.problem) parts.push(problemWords(row.problem));
  else if (row.unsent) parts.push('Not sent yet');
  else if (row.kind === 'confirmed') parts.push('Confirmed by a manager');
  return parts.join(' · ');
}

/**
 * Counting the shelves. What the server holds is read when the screen opens; every count typed goes onto this phone
 * first and is sent from there, so a count typed with no signal is kept and shown as "not sent" until the server has
 * it. Scanning a barcode looks the item up with the server and needs a signal; searching the list does not.
 */
export function StockTakeScreen() {
  const { api, tenantId, userId, branchId, branchName, mayCount, mayClose, renderScanner } = useStockSession();
  const keeper = useMemo(() => takeKeeperFor(tenantId), [tenantId]);
  const scopeKeeper = useMemo(() => scopeKeeperFor(tenantId), [tenantId]);
  const kept = useKept(keeper);
  const { flush } = useCountSender();

  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const [offline, setOffline] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<'morning' | 'evening'>(() => (new Date().getHours() < 12 ? 'morning' : 'evening'));
  const [filter, setFilter] = useState<RowFilter>('todo');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  /** The supplier the list is held to, when the count is being done by supplier. Null counts the whole shelf. */
  const [scope, setScope] = useState<{ id: string; name: string; itemIds: Set<string> } | null>(null);
  const [picking, setPicking] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierChoice[] | null>(null);
  const [scoping, setScoping] = useState(false);
  const working = useRef(false);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const guard = useCallback(async (job: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);

  /** Takes what the server says into the copy kept on the phone. Counts typed here that it has not taken stay. */
  const adopt = useCallback(
    (fresh: StockTake) => {
      let dropped = 0;
      keeper.update((current) => {
        const merged = mergeFresh(current, fresh, Date.now());
        dropped = merged.discarded;
        // Whoever opens the stock take takes the copy over, unless it is holding another person's counts.
        return claim(merged.copy, userId);
      });
      if (dropped > 0) setNote({ tone: 'warn', text: `${dropped} ${dropped === 1 ? 'count' : 'counts'} for an earlier stock take could not be kept.` });
    },
    [keeper, userId]
  );

  const refresh = useCallback(async () => {
    setOffline(null);
    const current = keeper.get();
    const waiting = current ? Object.keys(current.pending).length : 0;
    // Counts typed for another branch's stock take, or by another person, are never sent from here, and never thrown away without being asked.
    const held = heldBy(current, branchId, userId);
    if (current && held) {
      setStage({ name: 'held_elsewhere', count: waiting, by: held });
      return;
    }
    const usable = current && current.take.branchId === branchId && current.take.open ? current : null;
    try {
      if (current && waiting > 0 && current.take.branchId === branchId) {
        // Counts are waiting for this stock take: read it again, whatever it has become, and keep them.
        const fresh = await fetchTake(api, current.take.id);
        if (!fresh) throw new Error('unreadable');
        adopt(fresh);
        setStage({ name: 'list' });
        return;
      }
      const active = await fetchActiveTake(api, branchId, todayOn(Date.now()));
      if (!active) throw new Error('unreadable');
      const decision = decideStart(active);
      if (decision === 'continue' && active.take) {
        adopt(active.take);
        setStage({ name: 'list' });
      } else if (decision === 'offer_stale' && active.stale) {
        setStage({ name: 'stale', stale: active.stale });
      } else {
        setStage({ name: 'choose' });
      }
    } catch (error) {
      const words = error instanceof Error && error.message === 'unreadable' ? 'The server sent something the app could not read.' : readFailureWords(error);
      if (usable || (current && waiting > 0 && current.take.branchId === branchId)) {
        setStage({ name: 'list' });
        setOffline(`${words} Showing what is on this phone. Counts are kept and sent when the connection is back.`);
      } else {
        setStage({ name: 'failed', words });
      }
    }
  }, [adopt, api, branchId, keeper, userId]);

  /** Puts back the supplier this take was being counted for, if it still belongs to this take and still has products. */
  const restoreScope = useCallback(
    async (takeId: string) => {
      const keptScope = scopeKeeper.get();
      if (!keptScope || keptScope.takeId !== takeId) return;
      try {
        const links = await fetchSupplierItemLinks(api, keptScope.supplierId, { branchId });
        setScope({ id: keptScope.supplierId, name: keptScope.name, itemIds: itemIdsOf(links) });
      } catch {
        // A supplier whose products cannot be read is dropped quietly: the count itself is untouched.
        scopeKeeper.update(() => null);
      }
    },
    [api, branchId, scopeKeeper]
  );

  useEffect(() => {
    if (kept.ready) void guard(refresh);
  }, [kept.ready, guard, refresh]);

  const start = useCallback(
    () =>
      guard(async () => {
        setNote(null);
        try {
          const take = await startTake(api, { branchId, kind, date: todayOn(Date.now()) });
          if (!take) {
            setNote({ tone: 'danger', text: 'The server sent something the app could not read. Nothing was started.' });
            return;
          }
          adopt(take);
          setStage({ name: 'list' });
        } catch (error) {
          if (isAlreadyOpen(error)) {
            await refresh();
            return;
          }
          const failure = classifyWrite(error);
          if (failure.kind === 'refused') {
            setNote({ tone: 'danger', text: failure.words });
            return;
          }
          // No clear answer: look at what the server has now before anything is started a second time.
          await refresh();
          setNote({ tone: 'warn', text: 'There was no clear answer from the server. If the stock take was started, it is shown now.' });
        }
      }),
    [adopt, api, branchId, guard, kind, refresh]
  );

  const continueStale = useCallback(
    (id: string) =>
      guard(async () => {
        setNote(null);
        try {
          const take = await fetchTake(api, id);
          if (!take) {
            setNote({ tone: 'danger', text: 'The server sent something the app could not read.' });
            return;
          }
          adopt(take);
          setStage({ name: 'list' });
        } catch (error) {
          setNote({ tone: 'danger', text: readFailureWords(error) });
        }
      }),
    [adopt, api, guard]
  );

  // -------------------------------------------------------------------------------------------
  // Counting
  // -------------------------------------------------------------------------------------------

  const copy = kept.ready ? kept.value : null;
  const rows = useMemo(() => (copy ? rowsOf(copy) : []), [copy]);
  const scoped = useMemo(
    () => (scope ? rows.filter((row) => scope.itemIds.has(row.line.itemId)) : rows),
    [rows, scope]
  );
  const shown = useMemo(() => filterRows(scoped, { text: search, only: filter }), [scoped, search, filter]);
  const progress = copy ? progressOf(copy) : null;

  useEffect(() => {
    if (copy && copy.take.open) void restoreScope(copy.take.id);
  }, [copy?.take.id, copy?.take.open, restoreScope]);


  const chooseSupplier = useCallback(
    async (choice: { id: string; name: string }) => {
      setScoping(true);
      setNote(null);
      try {
        const links = await fetchSupplierItemLinks(api, choice.id, { branchId });
        setScope({ id: choice.id, name: choice.name, itemIds: itemIdsOf(links) });
        const current = keeper.get();
        if (current) scopeKeeper.update(() => ({ takeId: current.take.id, supplierId: choice.id, name: choice.name }));
        setPicking(false);
        setFilter('todo');
      } catch (error) {
        setNote({ tone: 'danger', text: error instanceof Error && error.message ? error.message : 'Could not read that supplier\'s products.' });
      } finally {
        setScoping(false);
      }
    },
    [api, branchId, keeper, scopeKeeper]
  );

  const beginEntry = useCallback(
    (lineId: string) => {
      const current = keeper.get();
      const row = current ? rowsOf(current).find((candidate) => candidate.line.id === lineId) : undefined;
      setEditing(lineId);
      setTyped(row && row.units !== null ? plainNumber(row.units) : '');
      setEntryError(null);
    },
    [keeper]
  );

  const saveCount = useCallback(() => {
    if (!editing) return;
    const entry = parseQty(typed, { allowZero: true });
    if (!entry.ok) {
      setEntryError(qtyProblemWords(entry.problem));
      return;
    }
    const outcome: { why: 'no_line' | 'locked' | 'closed' | 'held' | null } = { why: null };
    keeper.update((current) => {
      if (!current) return current;
      if (heldBy(current, branchId, userId)) {
        outcome.why = 'held';
        return current;
      }
      // Whoever types a count takes the copy over, unless it is holding another person's counts.
      const result = typeCount(claim(current, userId), editing, entry.units, Date.now());
      if (!result.ok) {
        outcome.why = result.why;
        return current;
      }
      return result.copy;
    });
    if (outcome.why) {
      setEntryError(typeFailureWords(outcome.why));
      return;
    }
    setEditing(null);
    setTyped('');
    setEntryError(null);
    void flush();
  }, [branchId, editing, flush, keeper, typed, userId]);

  const onBarcode = useCallback(
    async (value: string) => {
      const now = Date.now();
      if (lastScan.current && lastScan.current.code === value && now - lastScan.current.at < SAME_CODE_MS) return;
      lastScan.current = { code: value, at: now };
      setScanning(false);
      setNote(null);
      try {
        const items = await findByCode(api, branchId, value);
        if (!items) {
          setNote({ tone: 'danger', text: 'The server sent something the app could not read.' });
          return;
        }
        const current = keeper.get();
        const line = current ? items.map((item) => lineForItem(current, item.id)).find((candidate) => candidate !== null) ?? null : null;
        if (!line) {
          setNote({ tone: 'warn', text: items.length === 0 ? 'No item has that code.' : 'That item is not in this stock take.' });
          return;
        }
        beginEntry(line.id);
      } catch {
        setNote({ tone: 'danger', text: 'Could not look the code up. Scanning needs a signal. Search the list by name instead.' });
      }
    },
    [api, beginEntry, branchId, keeper]
  );

  const confirmDiscard = useCallback(
    (what: 'refused' | 'all') => {
      const current = keeper.get();
      if (!current) return;
      const count = what === 'all' ? Object.keys(current.pending).length : Object.values(current.pending).filter((entry) => entry.problem !== null).length;
      Alert.alert(
        'Discard counts?',
        `${count} ${count === 1 ? 'count' : 'counts'} typed on this phone will be thrown away and not sent.`,
        [
          { text: 'Keep them', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              keeper.update((latest) => (what === 'all' ? null : latest ? discardPending(latest) : latest));
              if (what === 'all') void guard(refresh);
            },
          },
        ]
      );
    },
    [guard, keeper, refresh]
  );

  const doClose = useCallback(
    (id: string) =>
      guard(async () => {
        setNote(null);
        try {
          const closed = await closeTake(api, id);
          const take = closed ?? (await fetchTake(api, id));
          if (take) adopt(take);
          setNote({ tone: 'ok', text: 'The stock take is closed.' });
        } catch (error) {
          const failure = classifyWrite(error);
          if (failure.kind === 'refused') {
            setNote({ tone: 'danger', text: failure.words });
            return;
          }
          try {
            const take = await fetchTake(api, id);
            if (take) adopt(take);
            setNote(take && !take.open ? { tone: 'ok', text: 'The stock take is closed.' } : { tone: 'warn', text: 'There was no clear answer and the stock take is still open. Check and try again.' });
          } catch {
            setNote({ tone: 'warn', text: 'There was no clear answer from the server. Open the stock take again to see whether it closed.' });
          }
        }
      }),
    [adopt, api, guard]
  );

  const askClose = useCallback(() => {
    const current = keeper.get();
    if (!current) return;
    const blocked = closeBlockedBy(current, mayClose);
    if (blocked) {
      setNote({ tone: 'warn', text: closeBlockedWords(blocked) });
      return;
    }
    Alert.alert('Close this stock take?', 'Counts can no longer be changed once it is closed.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Close it', style: 'destructive', onPress: () => void doClose(current.take.id) },
    ]);
  }, [doClose, keeper, mayClose]);

  // -------------------------------------------------------------------------------------------
  // What is shown
  // -------------------------------------------------------------------------------------------

  /** A note or a warning, as one quiet line: the screen's own voice, not a banner that pushes the list down. */
  const banners = (
    <>
      {note ? <Line tone={note.tone === 'ok' ? 'ok' : note.tone === 'danger' ? 'danger' : 'warn'} words={note.text} /> : null}
      {offline ? <Line tone="warn" words={offline} /> : null}
    </>
  );

  if (kept.failed) {
    return (
      <View style={[styles.body, styles.centre]}>
        <Line tone="danger" words="Could not read what is saved on this phone. Nothing was changed." />
        <Primary label="Try again" onPress={kept.retry} />
      </View>
    );
  }
  if (!kept.ready || stage.name === 'loading') {
    return (
      <View style={[styles.body, styles.centre]}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading the stock take…
        </MartText>
      </View>
    );
  }

  if (stage.name === 'failed') {
    return (
      <View style={styles.body}>
        {banners}
        <Line tone="danger" words={stage.words} />
        <Primary label="Try again" onPress={() => void guard(refresh)} disabled={busy} />
      </View>
    );
  }

  if (stage.name === 'held_elsewhere') {
    const words = heldWords(stage.by, stage.count);
    return (
      <View style={styles.body}>
        <View style={styles.card}>
          <MartText variant="title">{words.title}</MartText>
          <MartText variant="meta" color={MART.inkMuted}>
            {words.long}
          </MartText>
          <Primary label="Discard these counts" onPress={() => confirmDiscard('all')} danger />
        </View>
      </View>
    );
  }

  if (stage.name === 'stale') {
    return (
      <View style={styles.body}>
        {banners}
        <View style={styles.card}>
          <MartText variant="title">An earlier stock take is still open</MartText>
          <MartText variant="meta" color={MART.inkMuted}>
            The stock take of {stage.stale.date || 'an earlier day'} was never closed. Carry on with it, or start one for today.
          </MartText>
          <Primary label="Carry on with it" onPress={() => void continueStale(stage.stale.id)} disabled={busy} />
          {mayCount ? <Secondary label="Start today's instead" onPress={() => setStage({ name: 'choose' })} disabled={busy} /> : null}
        </View>
      </View>
    );
  }

  if (stage.name === 'choose') {
    return (
      <View style={styles.body}>
        {banners}
        <View style={styles.card}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            NOT STARTED
          </MartText>
          <MartText variant="title">No stock take is open</MartText>
          <MartText variant="meta" color={MART.inkMuted}>
            {branchName ? `at ${branchName}` : 'at this branch'} today
          </MartText>
          {mayCount ? (
            <>
              <View style={styles.chips}>
                {(['morning', 'evening'] as const).map((option) => (
                  <Chip key={option} label={option === 'morning' ? 'Morning' : 'Evening'} on={kind === option} onPress={() => setKind(option)} />
                ))}
              </View>
              <Primary label={busy ? 'Starting…' : 'Start stock take'} onPress={() => void start()} disabled={busy} />
            </>
          ) : (
            <MartText variant="meta" color={MART.inkQuiet}>
              Ask someone who counts stock to start one.
            </MartText>
          )}
        </View>
      </View>
    );
  }

  // stage.name === 'list'
  if (!copy) return null;
  const open = copy.take.open;
  const editingRow = editing ? rows.find((row) => row.line.id === editing) : undefined;
  const refused = progress ? progress.refused : 0;
  const done = progress ? progress.counted : 0;
  const total = progress ? progress.total : 0;
  const share = total > 0 ? Math.min(1, done / total) : 0;
  const scopedTotal = scoped.length;
  const scopedDone = scoped.filter((row) => row.units !== null).length;
  const scopedShare = scopedTotal > 0 ? Math.min(1, scopedDone / scopedTotal) : 0;

  return (
    <View style={styles.fill}>
      <View style={styles.top}>
        {/* How far the count has got, as a figure, a bar and the counts still on this phone. */}
        {progress ? (
          <View style={styles.progressCard}>
            <View style={styles.progressHead}>
              <MartText variant="title">{scope ? `${scopedDone} of ${scopedTotal}` : `${done} of ${total}`}</MartText>
              <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                {scope
                  ? scopedTotal > 0 && scopedDone === scopedTotal
                    ? `${scope.name} is done`
                    : `for ${scope.name}`
                  : done === total && total > 0
                    ? 'counted — ready to close'
                    : 'counted'}
              </MartText>
            </View>
            <View style={styles.track}>
              <View style={[styles.fillBar, { width: `${Math.round((scope ? scopedShare : share) * 100)}%` }]} />
            </View>
            {scope ? (
              <View style={styles.overall}>
                <View style={[styles.overallBar, { width: `${Math.round(share * 100)}%` }]} />
              </View>
            ) : null}
            <View style={styles.progressFoot}>
              {scope ? <Pill words={`${done} of ${total} on the shelf`} tone="ok" /> : null}
              {progress.confirmed > 0 ? <Pill words={`${progress.confirmed} confirmed`} tone="ok" /> : null}
              {progress.unsent > 0 ? <Pill words={`${progress.unsent} not sent`} tone="warn" /> : null}
              {refused > 0 ? <Pill words={`${refused} refused`} tone="danger" /> : null}
            </View>
          </View>
        ) : null}

        {scope && scopedTotal > 0 && scopedDone === scopedTotal && done < total ? (
          <View style={styles.doneRow}>
            <Ionicons name="checkmark-circle" size={16} color={MART.success} />
            <MartText variant="meta" color={MART.success} style={{ flex: 1 }}>
              {`${scope.name} is done. ${total - done} still to count on the shelf.`}
            </MartText>
            {open ? (
              <Pressable
                onPress={() => {
                  setScope(null);
                  scopeKeeper.update(() => null);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.doneAction, pressed && styles.pressed]}
              >
                <MartText variant="meta" color={MART.ink}>
                  Count the rest
                </MartText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {banners}
        {!open ? <Line tone="info" words="This stock take is closed. Counts can no longer be changed." /> : null}
        {refused > 0 ? (
          <View style={styles.inline}>
            {open ? (
              <Secondary
                label="Try again"
                onPress={() => {
                  keeper.update((latest) => (latest ? retryRefused(latest) : latest));
                  void flush();
                }}
                half
              />
            ) : null}
            <Secondary label="Discard them" onPress={() => confirmDiscard('refused')} half />
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setPicking(true);
            if (suppliers === null) {
              void fetchSuppliers(api)
                .then((rows) => setSuppliers(suppliersForCounting(rows)))
                .catch(() => setNote({ tone: 'danger', text: 'Could not read the suppliers.' }));
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={scope ? `Counting for ${scope.name}. Change supplier` : 'Count by supplier'}
          style={({ pressed }) => [styles.scope, scope && styles.scopeOn, pressed && styles.pressed]}
        >
          <Ionicons name={scope ? 'cube' : 'cube-outline'} size={15} color={scope ? onFill(MART.fallbackPrimary).primary : MART.inkMuted} />
          <MartText variant="meta" color={scope ? onFill(MART.fallbackPrimary).primary : MART.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
            {scope ? `Counting ${scope.name}` : 'Count by supplier'}
          </MartText>
          {scope ? (
            <Pressable
              onPress={() => {
                setScope(null);
                scopeKeeper.update(() => null);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Count the whole shelf instead"
            >
              <Ionicons name="close-circle" size={16} color={onFill(MART.fallbackPrimary).secondary} />
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={14} color={MART.inkQuiet} />
          )}
        </Pressable>

        <View style={styles.chips}>
              {FILTERS.map((option) => (
                <Chip key={option.key} label={option.label} on={filter === option.key} onPress={() => setFilter(option.key)} />
              ))}
            </View>
            <View style={styles.inline}>
              <View style={styles.search}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search the list"
                  placeholderTextColor={MART.inkQuiet}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                  accessibilityLabel="Search the stock take"
                />
              </View>
              {renderScanner && open ? (
                <Pressable
                  onPress={() => {
                    setNote(null);
                    setScanning(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Scan a barcode"
                  style={({ pressed }) => [styles.scan, pressed && styles.pressed]}
                >
                  <Ionicons name="barcode-outline" size={20} color={MART.paper} />
                </Pressable>
              ) : null}
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(row) => row.line.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        windowSize={9}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
            {rows.length === 0
              ? 'This stock take has no items.'
              : scoped.length === 0 && scope
                ? `${scope.name} has no products in this stock take. Count the whole shelf, or pick another supplier.`
                : 'Nothing here. Try another filter.'}
          </MartText>
        }
        renderItem={({ item: row }) => {
          const counted = row.units !== null;
          const tone = row.problem ? 'danger' : row.unsent ? 'warn' : row.kind === 'confirmed' ? 'ok' : 'quiet';
          return (
            <Pressable
              onPress={() => beginEntry(row.line.id)}
              disabled={!open || !mayCount || row.kind === 'confirmed'}
              accessibilityRole="button"
              accessibilityLabel={`${row.line.name}, ${counted ? `counted ${formatQty(row.units ?? 0)}` : 'to count'}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowBody}>
                <MartText variant="label" numberOfLines={1}>
                  {row.line.name}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {subtitleFor(row)}
                </MartText>
              </View>
              <View style={[styles.figure, tone === 'danger' && styles.figureDanger, tone === 'warn' && styles.figureWarn, tone === 'ok' && styles.figureOk]}>
                <MartText
                  variant="label"
                  color={tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : tone === 'ok' ? MART.success : MART.inkQuiet}
                >
                  {counted ? formatQty(row.units ?? 0) : 'To count'}
                </MartText>
              </View>
            </Pressable>
          );
        }}
      />

      {open && mayClose ? (
        <View style={styles.footer}>
          <Secondary label="Close the stock take" onPress={askClose} disabled={busy} />
        </View>
      ) : null}

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Count by supplier">
        <View style={styles.sheetBody}>
          <MartText variant="meta" color={MART.inkMuted}>
            The stock take stays one count of the whole shelf. Choosing a supplier holds the list to what that supplier
            sends, so a delivery can be walked without hunting through everything else.
          </MartText>
          {scoping ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Reading that supplier's products…
            </MartText>
          ) : null}
          {suppliers === null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Reading the suppliers…
            </MartText>
          ) : suppliers.length === 0 ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              No supplier is linked to this shop yet. Link products to a supplier on the web dashboard first.
            </MartText>
          ) : (
            <View style={styles.supplierList}>
              {suppliers.map((supplier) => (
                <Pressable
                  key={supplier.id}
                  onPress={() => void chooseSupplier(supplier)}
                  disabled={scoping}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.supplierRow, pressed && styles.pressed]}
                >
                  <MartText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                    {supplier.name}
                  </MartText>
                  <Ionicons name="chevron-forward" size={15} color={MART.inkQuiet} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </Sheet>

      <Sheet visible={editingRow !== undefined} onClose={() => { setEditing(null); setEntryError(null); }} title={editingRow?.line.name ?? 'Count'}>
        <View style={styles.sheetBody}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {editingRow?.line.systemUnits !== null && editingRow?.line.systemUnits !== undefined
              ? `The system holds ${formatQty(editingRow.line.systemUnits)}`
              : 'The system does not hold a figure for this'}
          </MartText>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            HOW MANY DID YOU COUNT?
          </MartText>
          <View style={styles.countRow}>
            <TextInput
              value={typed}
              onChangeText={(next) => {
                setTyped(next);
                setEntryError(null);
              }}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={saveCount}
              placeholder="0"
              placeholderTextColor={MART.inkQuiet}
              accessibilityLabel="How many did you count"
              style={styles.entryInput}
            />
            <Pressable
              onPress={saveCount}
              disabled={typed.trim() === ''}
              accessibilityRole="button"
              accessibilityLabel="Save this count"
              style={({ pressed }) => [styles.saveDisc, typed.trim() === '' && styles.off, pressed && styles.pressed]}
            >
              <Ionicons name="checkmark" size={26} color={MART.paper} />
            </Pressable>
          </View>
          {entryError ? (
            <MartText variant="meta" color={MART.danger}>
              {entryError}
            </MartText>
          ) : null}
          <Pressable
            onPress={() => {
              setEditing(null);
              setEntryError(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancelWord, pressed && styles.pressed]}
          >
            <MartText variant="meta" color={MART.inkQuiet}>
              {typed.trim() === '' ? 'Cancel' : `Cancel — leave ${editingRow?.line.name ?? 'this'} uncounted`}
            </MartText>
          </Pressable>
        </View>
      </Sheet>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {renderScanner ? renderScanner({ onBarcode: (value) => void onBarcode(value), onClose: () => setScanning(false) }) : <View />}
      </Modal>
    </View>
  );

  function Line({ tone, words }: { tone: 'ok' | 'warn' | 'danger' | 'info'; words: string }) {
    const colour = tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : tone === 'ok' ? MART.success : MART.inkMuted;
    return (
      <View style={[styles.line, { backgroundColor: tint(colour, 0.08) }]}>
        <Ionicons
          name={tone === 'danger' ? 'alert-circle' : tone === 'warn' ? 'warning' : tone === 'ok' ? 'checkmark-circle' : 'information-circle'}
          size={15}
          color={colour}
        />
        <MartText variant="meta" color={colour} style={{ flex: 1 }}>
          {words}
        </MartText>
      </View>
    );
  }

  function Pill({ words, tone }: { words: string; tone: 'ok' | 'warn' | 'danger' }) {
    const colour = tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : MART.success;
    return (
      <View style={[styles.pill, { backgroundColor: tint(colour, 0.12) }]}>
        <MartText variant="shelf" color={colour}>
          {words.toUpperCase()}
        </MartText>
      </View>
    );
  }

  function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
      >
        <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
          {label}
        </MartText>
      </Pressable>
    );
  }

  function Primary({ label, onPress, disabled, danger, half }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; half?: boolean }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, danger && styles.primaryDanger, half && styles.half, disabled && styles.off, pressed && styles.pressed]}
      >
        <MartText variant="label" color={onFill(danger ? MART.danger : MART.fallbackPrimary).primary}>
          {label}
        </MartText>
      </Pressable>
    );
  }

  function Secondary({ label, onPress, disabled, half }: { label: string; onPress: () => void; disabled?: boolean; half?: boolean }) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [styles.secondary, half && styles.half, disabled && styles.off, pressed && styles.pressed]}
      >
        <MartText variant="label" color={disabled ? MART.inkQuiet : MART.ink}>
          {label}
        </MartText>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  body: { flex: 1, padding: GUTTER, gap: SPACE.md, backgroundColor: MART.paper },
  centre: { alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: GUTTER, paddingTop: SPACE.md, gap: SPACE.sm },
  card: { padding: SPACE.md, gap: SPACE.sm, borderRadius: RADIUS.lg, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  eyebrow: { letterSpacing: 1.1 },

  progressCard: {
    gap: 8,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.sm },
  track: { height: 6, borderRadius: 999, backgroundColor: MART.paperSunken, overflow: 'hidden' },
  overall: { height: 3, borderRadius: 999, backgroundColor: MART.paperSunken, overflow: 'hidden', marginTop: -2 },
  overallBar: { height: 3, borderRadius: 999, backgroundColor: tint(MART.fallbackPrimary, 0.35) },
  fillBar: { height: 6, borderRadius: 999, backgroundColor: MART.fallbackPrimary },
  progressFoot: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },

  line: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  half: { flex: 1 },
  search: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  searchInput: { fontSize: 15, color: MART.ink, paddingVertical: 10, paddingTop: 10 },
  scan: { width: 46, height: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.fallbackPrimary },

  sheetBody: { gap: SPACE.sm, paddingTop: SPACE.xs },
  scope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.success, 0.1),
  },
  doneAction: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  scopeOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  supplierList: { gap: 4, paddingTop: SPACE.xs },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  saveDisc: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.fallbackPrimary,
  },
  cancelWord: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12 },
  entryUnused: {
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  entryInput: { flex: 1, fontSize: 40, fontWeight: '700', color: MART.ink, textAlign: 'center', paddingVertical: 6 },

  list: { padding: GUTTER, paddingTop: SPACE.sm, gap: 6, paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  rowBody: { flex: 1, gap: 1 },
  figure: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: MART.paperSunken },
  figureDanger: { backgroundColor: tint(MART.danger, 0.12) },
  figureWarn: { backgroundColor: tint(MART.warning, 0.14) },
  figureOk: { backgroundColor: tint(MART.success, 0.12) },
  empty: { textAlign: 'center', padding: SPACE.xl, lineHeight: 19 },

  footer: { paddingHorizontal: GUTTER, paddingBottom: 10, marginBottom: 56 },

  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: MART.fallbackPrimary },
  primaryDanger: { backgroundColor: MART.danger },
  secondary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  off: { backgroundColor: tint(MART.fallbackPrimary, 0.35), borderColor: MART.border },
  pressed: { opacity: 0.85 },
});
