import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatQty, itemLabel, type ApiClient, type CategoryOption, type StockItem } from '@kiosk/core';
import { Banner, Button, Chip, Text } from '@kiosk/ui';
import { MartText } from '../theme/mart-ui';
import { tint, zoneFor } from '../theme/mart';
import { useItemSearch } from '../hooks/useItemSearch';
import { ShelfTile } from './ShelfTile';
import { FONT, MART, RADIUS, SPACE, WEIGHT, onFill } from '../theme/mart';

/** Draws the camera and calls `onBarcode` for each code it reads. Passed in by the apps that ship the camera module. */
export type ScannerRenderer = (props: { onBarcode: (value: string) => void; onClose: () => void }) => React.ReactElement;

export type ItemFilter = 'all' | 'low' | 'out';

/** The same code read again within this long is the camera still pointing at it, not a second item. */
const SAME_CODE_MS = 2500;

type Props = {
  api: ApiClient;
  branchId: string;
  onPick: (item: StockItem) => void;
  /** Take one unit out of the basket for this item (cards only). */
  onRemove?: (item: StockItem) => void;
  renderScanner?: ScannerRenderer;
  /** Offer "Low" and "Out" beside "All". */
  withFilters?: boolean;
  /** Which filter is chosen when the finder opens. */
  initialFilter?: ItemFilter;
  /** Show nothing until something is typed. */
  idle?: boolean;
  /** Draw the items as the till's glossy tiles, instead of a list of rows. */
  cards?: boolean;
  /** How many tiles share a row. Two leaves room for a photo and a full name. */
  columns?: 2 | 3;
  /** Lines a tile name may use before it is cut. Zero lets the name wrap in full. */
  nameLines?: number;
  /** Pinned above the shelf when nothing is being searched — the shop's best sellers. */
  featured?: StockItem[];
  /** Departments to offer as chips. Omitted when the shop has none. */
  categories?: CategoryOption[];
  /** The department currently narrowing the shelf, or null for the whole shop. */
  categoryId?: string;
  onCategory?: (id: string | null) => void;
  /** Narrow the shelf to one department (an item type). */
  itemTypeId?: string;
  /** How many of each product are already in the basket, by item id. Cards show the count. */
  inBasket?: Record<string, number>;
  /** Bump this to put the cursor in the search field (the header's "Add item"). */
  focusSignal?: number;
  /** Draw the small filter circle inside the search field; it cycles in stock / low / all. */
  showFilter?: boolean;
  /** Float an add button over the grid's foot: scans when a camera is available, else goes to the field. */
  showAdd?: boolean;
  /** The app's accent, for the filter circle and the add button. */
  accent?: string;
  /** Where a card was on screen when it was tapped, for a flight to the basket. */
  onPickRect?: (rect: { x: number; y: number; w: number; h: number; name: string }) => void;
  /** Keep the camera open after each scan, so a basket can be scanned in one go. */
  continuous?: boolean;
  /** Said under the camera after each scan in `continuous` mode. */
  scanNote?: string | null;
  /** How loudly `scanNote` is said: `warn` for a scan that did not go in. */
  scanTone?: 'ok' | 'warn';
  placeholder?: string;
};

/**
 * Finds items by name, code or barcode and hands the one that was tapped or scanned to `onPick`. It reads the shop's
 * items as they are now: a failed read is said to be one, never shown as "no items".
 */
export function ItemPicker({ api, branchId, onPick, onRemove, renderScanner, withFilters = false, initialFilter = 'all', idle = false, continuous = false, scanNote = null, scanTone = 'ok', placeholder = 'Name, code or barcode', cards = false, columns = 3, nameLines = 2, featured, categories, categoryId, onCategory, itemTypeId, onPickRect, inBasket, focusSignal = 0, showFilter = false, showAdd = false, accent, }: Props) {
  const [filter, setFilter] = useState<ItemFilter>(initialFilter);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const search = useItemSearch(api, branchId, {
    ...(filter === 'low' ? { lowStock: true } : {}),
    ...(filter === 'out' ? { zeroStock: true } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(itemTypeId ? { itemTypeId } : {}),
    idle,
  });
  const { lookup, setQuery } = search;
  const input = useRef<TextInput>(null);
  const featuredIds = useMemo(() => new Set((featured ?? []).map((item) => item.id)), [featured]);
  const showFeatured = cards && !search.query && (featured?.length ?? 0) > 0;
  const rows = showFeatured ? search.items.filter((item) => !featuredIds.has(item.id)) : search.items;

  useEffect(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);

  const onBarcode = useCallback(
    async (value: string) => {
      const now = Date.now();
      if (last.current && last.current.code === value && now - last.current.at < SAME_CODE_MS) return;
      last.current = { code: value, at: now };
      if (!continuous) setScanning(false);
      const found = await lookup(value);
      if (found === null) setMessage('Could not look that code up. Check the signal and try again.');
      else if (found.length === 0) setMessage(`No item has the code ${value}.`);
      else if (found.length === 1 && found[0]) {
        setMessage(null);
        onPick(found[0]);
      } else {
        setMessage(null);
        setScanning(false);
        setQuery(value);
      }
    },
    [continuous, lookup, onPick, setQuery]
  );

  return (
    <View style={styles.fill}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={17} color={MART.inkQuiet} />
          <TextInput
            ref={input}
            value={search.query}
            onChangeText={search.setQuery}
            placeholder={placeholder}
            placeholderTextColor={MART.inkQuiet}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel={placeholder}
          />
          {showFilter ? (
            <Pressable
              onPress={() => setFilter(filter === 'all' ? 'low' : filter === 'low' ? 'out' : 'all')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={filter === 'all' ? 'Filter: all items' : filter === 'low' ? 'Filter: low stock' : 'Filter: out of stock'}
              style={[styles.filterDot, filter !== 'all' && { backgroundColor: accent ?? MART.fallbackPrimary }]}
            >
              <Ionicons name="options-outline" size={15} color={filter === 'all' ? MART.inkMuted : MART.paper} />
            </Pressable>
          ) : null}
          {search.query ? (
            <Pressable onPress={() => search.setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color={MART.inkQuiet} />
            </Pressable>
          ) : null}
        </View>
        {renderScanner ? (
          <Pressable
            onPress={() => setScanning(true)}
            accessibilityRole="button"
            accessibilityLabel="Scan a barcode"
            style={({ pressed }) => [styles.scanBtn, pressed && styles.scanPressed]}
          >
            <Ionicons name="barcode-outline" size={20} color={MART.paper} />
          </Pressable>
        ) : null}
      </View>
      {categories && categories.length > 0 && onCategory ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cats}>
          <Pressable
            onPress={() => onCategory(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !categoryId }}
            style={[styles.cat, !categoryId && styles.catOn]}
          >
            <MartText variant="label" color={!categoryId ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
              All
            </MartText>
          </Pressable>
          {categories.map((category) => {
            const on = categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => onCategory(on ? null : category.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.cat, on && styles.catOn]}
              >
                <MartText variant="label" numberOfLines={1} color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                  {category.name}
                </MartText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {showAdd ? (
        <Pressable
          onPress={() => (renderScanner ? setScanning(true) : input.current?.focus())}
          accessibilityRole="button"
          accessibilityLabel="Add an item"
          style={({ pressed }) => [styles.fab, accent ? { backgroundColor: accent } : null, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={26} color={MART.paper} />
        </Pressable>
      ) : null}
      <View style={styles.controls}>
        {withFilters ? (
          <View style={styles.chips}>
            <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Low" selected={filter === 'low'} onPress={() => setFilter('low')} />
            <Chip label="Out" selected={filter === 'out'} onPress={() => setFilter('out')} />
          </View>
        ) : null}
      </View>
      {message ? <Banner tone="warn">{message}</Banner> : null}
      {search.failed ? (
        <Banner tone="danger">
          <Text variant="caption">{search.failed === 'network' ? 'Could not load items. Check the signal.' : 'The server sent something the app could not read.'}</Text>
          <Button title="Try again" variant="secondary" onPress={search.reload} style={styles.retry} />
        </Banner>
      ) : null}
      <FlatList
        style={styles.fill}
        data={rows}
        keyExtractor={(item, index) => `${item.id}:${index}`}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={search.loadMore}
        {...(cards
          ? {
              numColumns: columns,
              key: `cols-${columns}`,
              columnWrapperStyle: styles.gridRow,
              contentContainerStyle: styles.grid,
            }
          : {})}
        ListHeaderComponent={
          showFeatured && featured ? (
            <BestSellers
              items={featured}
              nameLines={nameLines}
              inBasket={inBasket}
              onPick={onPick}
              {...(onRemove ? { onRemove } : {})}
            />
          ) : null
        }
        renderItem={({ item }) =>
          cards ? (
            <ShelfTile
              item={{
                name: itemLabel(item),
                priceCents: item.sellingCents,
                onHandUnits: item.onHandUnits,
                weighed: item.weighed,
                imageUrl: item.imageUrl,
                ...(inBasket?.[item.id] ? { inBasket: inBasket[item.id] } : {}),
              }}
              columns={columns}
              nameLines={nameLines}
              onPress={() => onPick(item)}
              onAdd={() => onPick(item)}
              {...(onRemove ? { onRemove: () => onRemove(item) } : {})}
              {...(onPickRect ? { onPressRect: (rect) => onPickRect({ ...rect, name: itemLabel(item) }) } : {})}
              disabled={!item.active || !item.sellable}
            />
          ) : (
            <PickerRow
              item={item}
              disabled={!item.active || !item.sellable}
              onPress={() => onPick(item)}
            />
          )
        }
        ListEmptyComponent={
          search.loading || search.failed || showFeatured ? null : (
            <Text variant="muted" style={styles.empty}>
              {idle && !search.query ? 'Type a name or scan a barcode.' : 'No items found.'}
            </Text>
          )
        }
        ListFooterComponent={search.loading ? <ActivityIndicator style={styles.spinner} color={MART.fallbackPrimary} /> : null}
      />
      {renderScanner ? (
        <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
          <View style={styles.fill}>
            {renderScanner({ onBarcode: (value) => void onBarcode(value), onClose: () => setScanning(false) })}
            {continuous && (scanNote || message) ? (
              <View style={styles.scanNote} pointerEvents="none">
                <Banner tone={message ? 'warn' : scanTone}>{message ?? scanNote ?? ''}</Banner>
              </View>
            ) : null}
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

/** The shop's fastest sellers, as wide cards you can add from without hunting the grid. */
function BestSellers({
  items,
  nameLines,
  inBasket,
  onPick,
  onRemove,
}: {
  items: StockItem[];
  nameLines: number;
  inBasket?: Record<string, number>;
  onPick: (item: StockItem) => void;
  onRemove?: (item: StockItem) => void;
}) {
  return (
    <View style={styles.feature}>
      <MartText variant="heading" style={styles.featureTitle}>
        Best sellers
      </MartText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRow}>
        {items.map((item) => (
          <View key={item.id} style={styles.featureCard}>
            <ShelfTile
              frame="rail"
              columns={2}
              nameLines={nameLines > 0 ? Math.min(nameLines, 4) : 4}
              item={{
                name: itemLabel(item),
                priceCents: item.sellingCents,
                onHandUnits: item.onHandUnits,
                weighed: item.weighed,
                imageUrl: item.imageUrl,
                ...(inBasket?.[item.id] ? { inBasket: inBasket[item.id] } : {}),
              }}
              onPress={() => onPick(item)}
              onAdd={() => onPick(item)}
              {...(onRemove ? { onRemove: () => onRemove(item) } : {})}
              disabled={!item.active || !item.sellable}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** One item in a list: its photo or mark, its name, one quiet line, and what the shelf holds. */
function PickerRow({
  item,
  disabled,
  onPress,
}: {
  item: StockItem;
  disabled: boolean;
  onPress: () => void;
}) {
  const zone = zoneFor(item.name);
  const words = [item.sku, item.barcode, item.active && item.sellable ? null : 'Not for sale'].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${itemLabel(item)}${item.onHandUnits === null ? '' : `, ${formatQty(item.onHandUnits)} on hand`}`}
      style={({ pressed }) => [styles.pickerRow, disabled && styles.pickerRowOff, pressed && styles.pickerRowPressed]}
    >
      <View style={[styles.pickerMark, { backgroundColor: tint(zone, 0.16) }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.pickerPhoto} resizeMode="cover" />
        ) : (
          <MartText variant="shelf" color={tint(MART.ink, 0.6)}>
            {(itemLabel(item).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('') || '?').toUpperCase()}
          </MartText>
        )}
      </View>
      <View style={styles.pickerBody}>
        <MartText variant="label" numberOfLines={2}>
          {itemLabel(item)}
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
          {words || 'No code'}
        </MartText>
      </View>
      <View style={styles.pickerFigure}>
        <MartText variant="shelf" color={MART.inkMuted}>
          {item.onHandUnits === null ? 'NOT COUNTED' : `${formatQty(item.onHandUnits)} ON HAND`}
        </MartText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: 9,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  pickerRowOff: { opacity: 0.5 },
  pickerRowPressed: { opacity: 0.9 },
  pickerMark: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pickerPhoto: { width: '100%', height: '100%' },
  feature: { paddingTop: SPACE.sm, gap: SPACE.xs },
  featureTitle: { paddingHorizontal: SPACE.xs },
  featureRow: { gap: SPACE.sm, paddingVertical: SPACE.xs, paddingRight: SPACE.sm },
  featureCard: { width: 176 },
  cats: { gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingTop: SPACE.sm },
  cat: {
    maxWidth: 180,
    paddingHorizontal: SPACE.md,
    minHeight: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  catOn: { backgroundColor: MART.fallbackPrimary },
  pickerBody: { flex: 1, gap: 1 },
  pickerFigure: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: MART.paperSunken },
  fill: { flex: 1 },
  grid: { paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm, gap: SPACE.sm, paddingBottom: SPACE.xxl },
  gridRow: { gap: SPACE.sm },
  filterDot: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paperSunken },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.fallbackPrimary,
    shadowColor: MART.ink,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 5,
  },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingTop: SPACE.sm },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MART.borderStrong,
  },
  searchInput: { flex: 1, minHeight: 40, fontFamily: FONT.regular, fontWeight: WEIGHT.regular, fontSize: 15, color: MART.ink, paddingVertical: 0 },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.fallbackPrimary,
  },
  scanPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: SPACE.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, paddingTop: SPACE.xs },
  retry: { marginTop: SPACE.sm },
  empty: { textAlign: 'center', padding: SPACE.xl, color: MART.inkQuiet },
  spinner: { padding: SPACE.md },
  scanNote: { position: 'absolute', left: SPACE.md, right: SPACE.md, top: 56 },
});
