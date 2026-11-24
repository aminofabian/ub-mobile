import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { itemLabel, itemsPath, readItemsPage, type ApiClient, type StockItem } from '@kiosk/core';
import { Field, Message, Panel, ScreenHeader, SkeletonRows } from '../../components/owner-ui';
import { kesOrDash } from '../../lib/owner-money';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, RADIUS, SPACE, tint } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

const REFRESH_MS = 120_000;
const PAGE = 60;
const TYPING_PAUSE_MS = 400;

type Props = { api: ApiClient; branchId: string };

async function loadItems(api: ApiClient, branchId: string, search: string): Promise<StockItem[]> {
  const path = itemsPath({ branchId, size: PAGE, page: 0, ...(search ? { search } : {}) });
  const page = readItemsPage(await api.get<unknown>(path), { page: 0, size: PAGE });
  return page?.items ?? [];
}

/** The shop's catalogue, read-only: what it sells and what each item costs and sells for. */
export function OwnerCatalogueScreen({ api, branchId }: Props) {
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(typed.trim()), TYPING_PAUSE_MS);
    return () => clearTimeout(t);
  }, [typed]);

  const list = useLoaded(() => loadItems(api, branchId, query), REFRESH_MS, true, query);
  const loaded = list.loaded;
  const items = loaded.state === 'ok' ? loaded.value : [];

  const header = (
    <Appear delay={0} style={{ gap: SPACE.lg, paddingBottom: SPACE.lg }}>
      <ScreenHeader
        title="Catalogue"
        trailing={
          loaded.state === 'ok' ? (
            <View style={styles.countPill}>
              <MartText variant="title" color={MART.fallbackPrimary}>
                {items.length}
                {items.length === PAGE ? '+' : ''}
              </MartText>
              <MartText variant="shelf" color={MART.inkQuiet}>
                {items.length === 1 ? 'ITEM' : 'ITEMS'}
              </MartText>
            </View>
          ) : null
        }
      />
      <Field
        icon="search-outline"
        label="Find an item"
        placeholder="Name or code"
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </Appear>
  );


  if (loaded.state === 'loading') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          {header}
          <SkeletonRows count={6} />
        </View>
      </View>
    );
  }

  if (loaded.state === 'denied' || loaded.state === 'failed') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <Message
          icon={loaded.state === 'denied' ? 'lock-closed-outline' : 'cloud-offline-outline'}
          title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load the catalogue'}
          body={loaded.words}
          {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void list.reload() } } : {})}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        query ? (
          <Message icon="search-outline" title="Nothing matches that" body={`No item's name or code matches "${query}".`} />
        ) : (
          <Message icon="pricetags-outline" title="No items yet" body="Items added to the shop will show here." />
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACE.sm }} />}
      renderItem={({ item }) => <CatalogueRow item={item} />}
    />
  );
}

function CatalogueRow({ item }: { item: StockItem }) {
  const margin =
    item.buyingCents !== null && item.sellingCents !== null && item.sellingCents > 0
      ? Math.round(((item.sellingCents - item.buyingCents) / item.sellingCents) * 100)
      : null;
  return (
    <Panel style={styles.row}>
      <View style={{ flex: 1, gap: SPACE.xxs }}>
        <MartText variant="heading" numberOfLines={1}>
          {itemLabel(item)}
        </MartText>
        <View style={styles.meta}>
          {item.sku ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              {item.sku}
            </MartText>
          ) : null}
          {!item.sellable ? (
            <View style={[styles.tag, { backgroundColor: tint(MART.inkQuiet, 0.14) }]}>
              <MartText variant="shelf" color={MART.inkMuted}>
                NOT FOR SALE
              </MartText>
            </View>
          ) : null}
          {margin !== null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              {margin}% margin
            </MartText>
          ) : null}
        </View>
      </View>
      <View style={styles.prices}>
        <MartText variant="price">{kesOrDash(item.sellingCents)}</MartText>
        {item.buyingCents !== null ? (
          <MartText variant="meta" color={MART.inkQuiet}>
            cost {kesOrDash(item.buyingCents)}
          </MartText>
        ) : null}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  padded: { paddingHorizontal: GUTTER, paddingTop: GUTTER },
  content: { padding: GUTTER, paddingBottom: SPACE.xxxl },
  countPill: {
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm },
  tag: { paddingHorizontal: SPACE.sm, paddingVertical: 1, borderRadius: RADIUS.pill },
  prices: { alignItems: 'flex-end', gap: SPACE.xxs },
});
