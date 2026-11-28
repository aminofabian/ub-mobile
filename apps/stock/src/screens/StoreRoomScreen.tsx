import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { itemLabel, readFailureWords, type StockItem } from '@kiosk/core';
import { GUTTER, ItemPicker, MartButton, MartText, MART, RADIUS, SPACE, tint } from '@kiosk/staff';
import { createStoreRow, fetchStoreRows, fetchStoreSettings, linkStoreRow } from '../api/store-room-api';
import { useStockSession } from '../lib/session';
import { matchesQuery, rowByBarcode, rowForProduct, shownCount, writeOutcome, type StoreMode, type StoreRow, type StoreSettings } from '../lib/store-room';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'StoreRoom'>;

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'ready'; rows: StoreRow[]; settings: StoreSettings };

/** The back room: what is tracked, and where a delivery counted into the store room shows up. */
export function StoreRoomScreen({ navigation }: Props) {
  const { api, branchId, mayCatalog, renderScanner } = useStockSession();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ words: string; tone: 'quiet' | 'danger' } | null>(null);

  const load = useCallback(async () => {
    const [settings, rows] = await Promise.all([fetchStoreSettings(api), fetchStoreRows(api, branchId)]);
    if (!settings || !rows) return null;
    return { settings, rows };
  }, [api, branchId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        try {
          const next = await load();
          if (!live) return;
          setLoaded(next ? { state: 'ready', ...next } : { state: 'failed', words: 'The server sent something the app could not read.' });
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [load, attempt])
  );

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await load();
      if (next) setLoaded({ state: 'ready', ...next });
    } catch (error) {
      setLoaded({ state: 'failed', words: readFailureWords(error) });
    } finally {
      setRefreshing(false);
    }
  };

  const rows = loaded.state === 'ready' ? loaded.rows : [];
  const mode: StoreMode = loaded.state === 'ready' ? loaded.settings.mode : null;
  const canAdd = mode != null && mayCatalog;
  const visible = useMemo(() => rows.filter((row) => matchesQuery(row, query)), [rows, query]);

  const openBarcode = (code: string) => {
    const row = rowByBarcode(rows, code);
    setScanning(false);
    if (row) {
      setNotice(null);
      navigation.navigate('StoreRow', { storeItemId: row.id });
      return;
    }
    if (!canAdd) {
      setNotice({
        words: mode == null ? 'Choose how the store room works on the web before adding anything.' : 'That barcode is not in the store room.',
        tone: 'quiet',
      });
      return;
    }
    setNotice({ words: 'That barcode is not in the store room.', tone: 'quiet' });
    setAdding(true);
  };

  const addProduct = async (item: StockItem) => {
    const existing = rowForProduct(rows, item);
    if (existing) {
      setAdding(false);
      if (existing.itemId == null) {
        try {
          await linkStoreRow(api, branchId, existing.id, item.id);
        } catch (error) {
          const outcome = writeOutcome(error);
          setNotice({ words: outcome.kind === 'lost' ? 'Could not reach the server. Check the signal and try again.' : outcome.words, tone: 'danger' });
          return;
        }
      }
      navigation.navigate('StoreRow', { storeItemId: existing.id });
      return;
    }
    try {
      const created = await createStoreRow(api, branchId, { name: itemLabel(item), barcode: item.barcode, itemId: item.id });
      setAdding(false);
      if (!created) {
        setNotice({ words: 'The server sent something the app could not read.', tone: 'danger' });
        return;
      }
      navigation.navigate('StoreRow', { storeItemId: created.id });
    } catch (error) {
      const outcome = writeOutcome(error);
      setNotice({ words: outcome.kind === 'lost' ? 'Could not reach the server. Check the signal and try again.' : outcome.words, tone: 'danger' });
    }
  };

  if (loaded.state === 'loading') {
    return (
      <View style={styles.center}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading the store room…
        </MartText>
      </View>
    );
  }

  if (loaded.state === 'failed') {
    return (
      <View style={styles.body}>
        <MartText variant="meta" color={MART.danger}>
          {loaded.words}
        </MartText>
        <MartButton
          label="Try again"
          onPress={() => {
            setLoaded({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <FlatList
        data={visible}
        keyExtractor={(row) => row.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={MART.fallbackPrimary} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Name or barcode"
                placeholderTextColor={MART.inkQuiet}
                autoCorrect={false}
                accessibilityLabel="Search the store room"
                style={styles.search}
              />
              {renderScanner ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Scan a barcode" onPress={() => setScanning(true)} style={styles.iconBtn}>
                  <Ionicons name="barcode-outline" size={22} color={MART.ink} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="What moved today" onPress={() => navigation.navigate('StoreToday')} style={styles.today}>
                <MartText variant="label" color={MART.fallbackPrimaryLift}>
                  Today
                </MartText>
              </Pressable>
            </View>
            {mode == null ? (
              <View style={styles.notice}>
                <MartText variant="meta" color={MART.ink}>
                  This shop has not chosen whether the store room follows the till. Choose that on the web before anything can be written from here.
                </MartText>
              </View>
            ) : null}
            {notice ? (
              <MartText variant="meta" color={notice.tone === 'danger' ? MART.danger : MART.inkQuiet}>
                {notice.words}
              </MartText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
            {query.trim()
              ? 'Nothing matches that.'
              : canAdd
                ? 'Nothing in the store room yet. Count a delivery into it from Deliveries, or add a product below.'
                : 'Nothing in the store room yet. Count a delivery into it from Deliveries.'}
          </MartText>
        }
        renderItem={({ item }) => {
          const count = shownCount(item, mode);
          const detail = [item.barcode, item.expiryDate ? `Expires ${item.expiryDate}` : null, count.followsShelf ? 'Same as the shelf' : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${count.text}`}
              onPress={() => navigation.navigate('StoreRow', { storeItemId: item.id })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <MartText variant="label" numberOfLines={1}>
                  {item.name}
                </MartText>
                {detail ? (
                  <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                    {detail}
                  </MartText>
                ) : null}
              </View>
              <MartText variant="heading" color={count.text === '—' ? MART.inkQuiet : MART.ink}>
                {count.text}
              </MartText>
            </Pressable>
          );
        }}
      />
      {canAdd ? (
        <View style={styles.add}>
          <MartButton label="Add from catalogue" onPress={() => setAdding(true)} />
        </View>
      ) : null}
      {scanning && renderScanner ? (
        <Modal animationType="slide" onRequestClose={() => setScanning(false)}>
          {renderScanner({ onBarcode: openBarcode, onClose: () => setScanning(false) })}
        </Modal>
      ) : null}
      {adding ? (
        <Modal animationType="slide" onRequestClose={() => setAdding(false)}>
          <View style={styles.picker}>
            <Pressable accessibilityRole="button" onPress={() => setAdding(false)} style={styles.close}>
              <MartText variant="label" color={MART.fallbackPrimary}>
                Close
              </MartText>
            </Pressable>
            <ItemPicker
              api={api}
              branchId={branchId}
              idle
              placeholder="Find a product to add"
              onPick={(item) => void addProduct(item)}
              {...(renderScanner ? { renderScanner } : {})}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper },
  body: { flex: 1, padding: GUTTER, gap: SPACE.md, backgroundColor: MART.paper },
  list: { paddingHorizontal: GUTTER, paddingBottom: 120, gap: 6 },
  header: { gap: SPACE.md, marginBottom: SPACE.sm, paddingTop: SPACE.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  search: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    color: MART.ink,
    fontSize: 16,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
  },
  today: { minHeight: 44, paddingHorizontal: SPACE.sm, alignItems: 'center', justifyContent: 'center' },
  notice: { padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: tint(MART.warning, 0.14) },
  empty: { textAlign: 'center', padding: SPACE.xl, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: 10,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowText: { flex: 1, gap: 2 },
  pressed: { opacity: 0.9 },
  add: { position: 'absolute', left: GUTTER, right: GUTTER, bottom: SPACE.lg },
  picker: { flex: 1, backgroundColor: MART.paper, paddingTop: 56 },
  close: { paddingHorizontal: GUTTER, paddingBottom: SPACE.sm, alignSelf: 'flex-end' },
});
