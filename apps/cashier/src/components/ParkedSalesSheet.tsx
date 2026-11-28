import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText } from '@kiosk/staff';
import { cancelDraft, listDrafts, openDraft, type DraftSummary } from '../api/draft-api';
import type { CartLine } from '../lib/cart';
import { BottomSheet } from './BottomSheet';

function kes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ago(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

/**
 * The parked sales waiting on this branch. A cashier opens this to pick up a sale someone (maybe
 * another till) parked earlier — its lines load into the basket and the parked copy is cleared, so
 * two tills never ring the same parked sale twice. Throwing one away clears it on the server too.
 */
export function ParkedSalesSheet({
  api,
  branchId,
  visible,
  cartCount,
  parking,
  onPark,
  onClose,
  onResume,
}: {
  api: ApiClient;
  branchId: string;
  visible: boolean;
  /** How many lines are in the live basket — a non-empty one can be parked from here. */
  cartCount: number;
  parking: boolean;
  /** Park the live basket. */
  onPark: () => void;
  onClose: () => void;
  /** The chosen parked sale's lines, to load into the basket. */
  onResume: (lines: CartLine[]) => void;
}) {
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setProblem(null);
    listDrafts(api, branchId).then(setDrafts, () => {
      setDrafts([]);
      setProblem('Could not read parked sales. Check the connection.');
    });
  };

  useEffect(() => {
    if (visible) {
      setDrafts(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const resume = async (draft: DraftSummary) => {
    setBusyId(draft.id);
    try {
      const detail = await openDraft(api, draft.id);
      // Hand the lines back first, then clear the parked copy so it cannot be resumed twice.
      onResume(detail.lines);
      await cancelDraft(api, draft.id, 'resumed to a till').catch(() => undefined);
      onClose();
    } catch {
      Alert.alert('Could not open it', 'That parked sale could not be opened. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const discard = (draft: DraftSummary) => {
    Alert.alert('Throw away this parked sale?', 'It will be cleared for every till. This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Throw away',
        style: 'destructive',
        onPress: () => {
          setBusyId(draft.id);
          cancelDraft(api, draft.id, 'discarded')
            .then(() => load())
            .catch(() => Alert.alert('Could not clear it', 'Try again.'))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
        <View style={styles.content}>
          <View style={styles.head}>
            <View>
              <MartText variant="title">Parked sales</MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                Waiting on this branch — pick one up
              </MartText>
            </View>
            <Pressable onPress={load} hitSlop={8} style={styles.refresh} accessibilityLabel="Refresh">
              <Ionicons name="refresh" size={18} color={MART.fallbackPrimary} />
            </Pressable>
          </View>

          {cartCount > 0 ? (
            <Pressable
              onPress={() => {
                onPark();
                onClose();
              }}
              disabled={parking}
              style={({ pressed }) => [styles.parkBar, (pressed || parking) && styles.pressed]}
            >
              <Ionicons name="pause-circle" size={18} color={MART.fallbackPrimary} />
              <MartText variant="label" color={MART.fallbackPrimary} style={{ flex: 1 }}>
                {parking ? 'Parking the basket…' : `Park the basket in front (${cartCount} ${cartCount === 1 ? 'item' : 'items'})`}
              </MartText>
              <Ionicons name="chevron-forward" size={16} color={MART.fallbackPrimary} />
            </Pressable>
          ) : null}

          <FlatList
            data={drafts ?? []}
            keyExtractor={(d) => d.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              drafts === null ? (
                <ActivityIndicator color={MART.fallbackPrimary} style={{ marginVertical: SPACE.xxxl }} />
              ) : (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name={problem ? 'cloud-offline-outline' : 'pause-circle-outline'} size={26} color={MART.inkQuiet} />
                  </View>
                  <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyText}>
                    {problem ?? 'No parked sales. Park one from the basket to pick it up later.'}
                  </MartText>
                </View>
              )
            }
            renderItem={({ item }) => {
              const busy = busyId === item.id;
              return (
                <View style={styles.row}>
                  <View style={styles.ticket}>
                    <MartText variant="shelf" color={MART.fallbackPrimary}>
                      #{item.ticketNumber}
                    </MartText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <MartText variant="heading">{kes(item.grandTotal)}</MartText>
                    <MartText variant="meta" color={MART.inkQuiet}>
                      {item.lineCount} {item.lineCount === 1 ? 'item' : 'items'}
                      {item.createdByName ? ` · ${item.createdByName}` : ''} · {ago(item.createdAt)}
                    </MartText>
                  </View>
                  {busy ? (
                    <ActivityIndicator size="small" color={MART.fallbackPrimary} />
                  ) : (
                    <>
                      <Pressable onPress={() => discard(item)} hitSlop={6} style={styles.discard} accessibilityLabel="Throw away">
                        <Ionicons name="trash-outline" size={18} color={MART.danger} />
                      </Pressable>
                      <Pressable onPress={() => void resume(item)} style={({ pressed }) => [styles.resume, pressed && styles.pressed]}>
                        <MartText variant="shelf" color={MART.fallbackPrimary}>
                          RESUME
                        </MartText>
                        <Ionicons name="arrow-forward" size={14} color={MART.fallbackPrimary} />
                      </Pressable>
                    </>
                  )}
                </View>
              );
            }}
          />
        </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(22,24,15,0.4)', justifyContent: 'flex-end' },
  // A native page sheet fills the card the system hands it; its own scrim, grip and top radius are gone.
  // The shell owns the ground, the padding and the grabber; this is just the column inside it.
  content: { gap: SPACE.xs },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: tint(MART.fallbackPrimary, 0.4),
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
  },
  list: { gap: SPACE.sm, paddingBottom: SPACE.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  ticket: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  discard: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: tint(MART.fallbackPrimary, 0.4),
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
  },
  pressed: { opacity: 0.75 },
  empty: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', maxWidth: 260 },
});
