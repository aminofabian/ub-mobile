import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import { countLine, fetchBatch, finishBatch } from '../api/count-cycle-api';
import { batchIsClosed, batchProgress, isCounted, lineDifference, type Batch, type BatchLine } from '../lib/count-cycle';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'BatchCount'>;

type Phase = { name: 'loading' } | { name: 'failed'; words: string } | { name: 'ready'; batch: Batch };

type Filter = 'todo' | 'done' | 'all';

function matches(line: BatchLine, text: string): boolean {
  if (!text) return true;
  const needle = text.trim().toLowerCase();
  return (
    line.itemName.toLowerCase().includes(needle) ||
    (line.itemSku ?? '').toLowerCase().includes(needle) ||
    (line.barcode ?? '').toLowerCase().includes(needle) ||
    (line.aisle ?? '').toLowerCase().includes(needle)
  );
}

function qty(n: number | null): string {
  if (n === null) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

/**
 * Counting one batch of the full count. Each line is an item; tapping it opens a small entry to type how many are on
 * the shelf. Counts go to the server one line at a time. When every line is counted the batch can be finished, which
 * closes it for review.
 */
export function BatchCountScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const { api, mayCount, mayClose, renderScanner } = useStockSession();
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [filter, setFilter] = useState<Filter>('todo');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<BatchLine | null>(null);
  const [typed, setTyped] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const batch = await fetchBatch(api, sessionId);
      if (!batch) {
        setPhase({ name: 'failed', words: 'The server sent something the app could not read.' });
        return;
      }
      setPhase({ name: 'ready', batch });
    } catch (error) {
      setPhase({ name: 'failed', words: readFailureWords(error) });
    }
  }, [api, sessionId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        if (live) await load();
      })();
      return () => {
        live = false;
      };
    }, [load])
  );

  const batch = phase.name === 'ready' ? phase.batch : null;
  const lines = batch?.lines ?? [];

  useEffect(() => {
    if (!batch || batchIsClosed(batch.status)) return;
    if (editing && batch.lines.some((line) => line.lineId === editing.lineId)) return;
    const next = batch.lines.find((line) => !isCounted(line));
    if (!next) return;
    setEditing(next);
    setTyped(qty(next.countedQty));
  }, [batch, editing]);
  const shown = useMemo(() => {
    const byFilter = lines.filter((l) => (filter === 'todo' ? !isCounted(l) : filter === 'done' ? isCounted(l) : true));
    return byFilter.filter((l) => matches(l, search));
  }, [lines, filter, search]);

  const openEntry = useCallback((line: BatchLine) => {
    setEditing(line);
    setTyped(qty(line.countedQty));
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    const value = Number(typed.trim());
    if (!typed.trim() || !Number.isFinite(value) || value < 0) {
      Alert.alert('Enter a number', 'Type how many are on the shelf (0 or more).');
      return;
    }
    setSaving(true);
    try {
      const updated = await countLine(api, sessionId, editing.lineId, value);
      if (updated) {
        setPhase({ name: 'ready', batch: updated });
        const index = updated.lines.findIndex((line) => line.lineId === editing.lineId);
        const next =
          updated.lines.slice(index + 1).find((line) => !isCounted(line)) ??
          updated.lines.find((line) => !isCounted(line));
        setEditing(next ?? null);
        setTyped(next ? qty(next.countedQty) : '');
      } else {
        setEditing(null);
        setTyped('');
      }
    } catch (error) {
      Alert.alert('Could not save the count', readFailureWords(error));
    } finally {
      setSaving(false);
    }
  }, [api, editing, sessionId, typed]);

  const onScan = useCallback(
    (code: string) => {
      setScanning(false);
      const found = lines.find((l) => l.barcode && l.barcode === code);
      if (!found) {
        Alert.alert('Not in this batch', 'That item is not one of this batch’s lines. Search by name instead.');
        return;
      }
      openEntry(found);
    },
    [lines, openEntry]
  );

  const onFinish = useCallback(() => {
    const toCount = lines.filter((l) => !isCounted(l)).length;
    const go = () =>
      void (async () => {
        setFinishing(true);
        try {
          await finishBatch(api, sessionId);
          navigation.goBack();
        } catch (error) {
          Alert.alert('Could not finish the batch', readFailureWords(error));
        } finally {
          setFinishing(false);
        }
      })();
    if (toCount > 0) {
      Alert.alert(
        'Finish with items left?',
        `${toCount} ${toCount === 1 ? 'item is' : 'items are'} not counted yet. Finish anyway?`,
        [
          { text: 'Keep counting', style: 'cancel' },
          { text: 'Finish', style: 'destructive', onPress: go },
        ]
      );
      return;
    }
    go();
  }, [api, lines, navigation, sessionId]);

  if (phase.name === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={MART.fallbackPrimary} />
      </View>
    );
  }
  if (phase.name === 'failed') {
    return (
      <View style={styles.centerPad}>
        <Ionicons name="cloud-offline-outline" size={40} color={MART.inkQuiet} />
        <MartText variant="heading" style={styles.centerText}>
          Could not load the batch
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
          {phase.words}
        </MartText>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
            Try again
          </MartText>
        </Pressable>
      </View>
    );
  }

  const b = phase.batch;
  const progress = batchProgress(b);
  const canFinish = (mayCount || mayClose) && !batchIsClosed(b.status) && b.countedCount > 0;

  return (
    <View style={styles.fill}>
      <View style={styles.top}>
        <View style={styles.progressHead}>
          <MartText variant="label">
            Batch {b.batchNumber} · {b.countedCount} of {b.totalCount}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {Math.round(progress * 100)}%
          </MartText>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        <View style={styles.chips}>
          {(['todo', 'done', 'all'] as Filter[]).map((key) => {
            const on = filter === key;
            const label = key === 'todo' ? 'To count' : key === 'done' ? 'Counted' : 'All';
            return (
              <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, on && styles.chipOn]}>
                <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                  {label}
                </MartText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={MART.inkQuiet} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search this batch"
              placeholderTextColor={MART.inkQuiet}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          {renderScanner ? (
            <Pressable onPress={() => setScanning(true)} style={styles.scanBtn} accessibilityLabel="Scan a barcode">
              <Ionicons name="barcode-outline" size={20} color={MART.ink} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(l) => l.lineId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
            {lines.length === 0 ? 'This batch has no items.' : 'Nothing here. Try another filter.'}
          </MartText>
        }
        renderItem={({ item }) => {
          const counted = isCounted(item);
          const diff = lineDifference(item);
          return (
            <Pressable
              onPress={() => openEntry(item)}
              style={[styles.lineRow, editing?.lineId === item.lineId && styles.lineOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: editing?.lineId === item.lineId }}
            >
              <View style={[styles.lineMark, { backgroundColor: counted ? MART.successSurface : MART.paperSunken }]}>
                <Ionicons
                  name={counted ? 'checkmark' : 'ellipse-outline'}
                  size={16}
                  color={counted ? MART.success : MART.inkQuiet}
                />
              </View>
              <View style={styles.lineBody}>
                <MartText variant="heading" numberOfLines={1}>
                  {item.itemName}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {[item.aisle ? `Aisle ${item.aisle}` : null, item.barcode || item.itemSku].filter(Boolean).join(' · ') || 'On this batch'}
                </MartText>
              </View>
              <View style={styles.lineRight}>
                <MartText variant="title" color={counted ? MART.ink : MART.inkQuiet}>
                  {counted ? qty(item.countedQty) : '—'}
                </MartText>
                {counted && diff !== null && diff !== 0 ? (
                  <MartText variant="meta" color={diff < 0 ? MART.danger : MART.success}>
                    {diff > 0 ? `+${diff}` : String(diff)}
                  </MartText>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {batchIsClosed(b.status) ? (
        <View style={styles.footer}>
          <MartText variant="meta" color={MART.inkQuiet}>
            This batch is finished. A manager posts it from the batch list.
          </MartText>
        </View>
      ) : (
        <View style={styles.footer}>
          {editing ? (
            <View style={styles.dock}>
              <View style={{ flex: 1, gap: 2 }}>
                <MartText variant="label" numberOfLines={1}>
                  {editing.itemName}
                </MartText>
                {b.showsSystemStock && editing.systemQty !== null ? (
                  <MartText variant="meta" color={MART.inkQuiet}>
                    System says {editing.systemQty}
                  </MartText>
                ) : (
                  <MartText variant="meta" color={MART.inkQuiet}>
                    How many are on the shelf
                  </MartText>
                )}
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="One fewer"
                  onPress={() => setTyped((current) => String(Math.max(0, (Number(current) || 0) - 1)))}
                  style={styles.step}
                >
                  <MartText variant="title">−</MartText>
                </Pressable>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={MART.inkQuiet}
                  accessibilityLabel={`Count for ${editing.itemName}`}
                  style={styles.stepInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="One more"
                  onPress={() => setTyped((current) => String((Number(current) || 0) + 1))}
                  style={styles.step}
                >
                  <MartText variant="title">+</MartText>
                </Pressable>
              </View>
            </View>
          ) : (
            <MartText variant="meta" color={MART.inkQuiet}>
              Every item in this batch has a count.
            </MartText>
          )}
          <View style={styles.footerActions}>
            {editing ? (
              <Pressable onPress={() => void save()} disabled={saving} style={[styles.primary, styles.footerFill, saving && styles.dim]}>
                {saving ? (
                  <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
                ) : (
                  <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                    Save and next
                  </MartText>
                )}
              </Pressable>
            ) : null}
            {canFinish ? (
              <Pressable onPress={onFinish} disabled={finishing} style={[editing ? styles.quiet : styles.primary, styles.footerFill, finishing && styles.dim]}>
                <MartText variant="label" color={editing ? MART.ink : onFill(MART.fallbackPrimary).primary}>
                  {finishing ? 'Finishing…' : 'Finish batch'}
                </MartText>
              </Pressable>
            ) : null}
          </View>
          {canFinish ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              {lines.filter((line) => !isCounted(line)).length === 0
                ? 'All counted. Finish hands this batch to a manager.'
                : 'Finish now and anything still open goes to the front of the next batch.'}
            </MartText>
          ) : mayCount || mayClose ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Count at least one product to finish this batch.
            </MartText>
          ) : null}
        </View>
      )}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {renderScanner ? renderScanner({ onBarcode: onScan, onClose: () => setScanning(false) }) : <View />}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper, padding: GUTTER, gap: SPACE.sm },
  centerText: { textAlign: 'center' },
  retry: {
    marginTop: SPACE.md,
    backgroundColor: MART.fallbackPrimary,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  top: {
    padding: GUTTER,
    paddingBottom: SPACE.sm,
    backgroundColor: MART.paperElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
    gap: SPACE.sm,
  },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barTrack: { height: 8, borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: RADIUS.pill, backgroundColor: MART.fallbackPrimary },
  chips: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  searchRow: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: MART.paper,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 46,
  },
  searchInput: { flex: 1, color: MART.ink, fontSize: 15, paddingVertical: SPACE.sm },
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingBottom: SPACE.xxxl },
  empty: { textAlign: 'center', padding: SPACE.xxl },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  lineOn: { backgroundColor: tint(MART.fallbackPrimary, 0.12) },
  lineMark: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  lineBody: { flex: 1, gap: SPACE.xxs },
  lineRight: { alignItems: 'flex-end', gap: SPACE.xxs, minWidth: 48 },
  footer: {
    padding: GUTTER,
    gap: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  dock: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  step: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInput: {
    width: 64,
    minHeight: 44,
    textAlign: 'center',
    fontSize: 20,
    color: MART.ink,
    backgroundColor: MART.paper,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
  },
  footerActions: { flexDirection: 'row', gap: SPACE.sm },
  footerFill: { flex: 1 },
  quiet: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  half: { flex: 1 },
  dim: { opacity: 0.55 },
  backdrop: { flex: 1, backgroundColor: 'rgba(28,29,27,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: MART.paperElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: GUTTER,
    paddingBottom: SPACE.xxl,
    gap: SPACE.md,
  },
  entryInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    fontSize: 22,
    color: MART.ink,
    backgroundColor: MART.paper,
  },
  sheetRow: { flexDirection: 'row', gap: SPACE.md },
});
