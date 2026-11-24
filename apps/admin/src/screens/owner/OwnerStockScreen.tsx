import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { formatQty, itemLabel, type ApiClient, type StockItem } from '@kiosk/core';
import { Message, Notice, Row, Segmented, SkeletonRows } from '../../components/owner-ui';
import type { OwnerAccess } from '../../lib/owner-access';
import { fetchStockCounts, fetchStockList, STOCK_LIST_SIZE } from '../../lib/owner-api';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, SPACE } from '../../theme/mart';
import { MartText } from '../../theme/mart-ui';

const REFRESH_MS = 60_000;

type Which = 'out' | 'low';

type Props = {
  api: ApiClient;
  branchId: string;
  branchName: string | null;
  access: OwnerAccess;
  /** Opens the screen that sets how much of an item is on the shelf. */
  onOpenItem: (itemId: string) => void;
};

function onHandWords(item: StockItem): string {
  return item.onHandUnits === null ? '—' : `${formatQty(item.onHandUnits)}${item.unitType ? ` ${item.unitType}` : ''}`;
}

/**
 * The items that need stocking at the branch the owner is signed in at: the ones that are out, and the ones running
 * low. Someone who may set stock opens an item and says how many are on the shelf (the same screen the Stock app uses,
 * which works the number out from the shelf as the server reports it and never sends a change twice). The stock take
 * is not on this phone yet.
 */
export function OwnerStockScreen({ api, branchId, branchName, access, onOpenItem }: Props) {
  const [which, setWhich] = useState<Which>('out');
  const counts = useLoaded(() => fetchStockCounts(api, branchId), REFRESH_MS);
  const list = useLoaded(() => fetchStockList(api, branchId, which), REFRESH_MS, true, which);

  const known = counts.loaded.state === 'ok' ? counts.loaded.value : null;
  const options = [
    { key: 'out', label: known ? `Out · ${known.out}` : 'Out' },
    { key: 'low', label: known ? `Running low · ${known.low}` : 'Running low' },
  ] as const;

  const shown = list.loaded.state === 'ok' ? list.loaded.value : null;

  const refreshAll = async () => {
    await Promise.all([counts.reload(), list.refresh()]);
  };

  const header = (
    <View style={{ gap: SPACE.md }}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {branchName ? `At ${branchName}` : 'At this branch'}
      </MartText>
      <Segmented options={options} value={which} onChange={setWhich} />
      {list.loaded.state === 'ok' && list.loaded.stale ? <Notice tone="warn">Could not refresh. This is the last list read.</Notice> : null}
    </View>
  );

  const footer = (
    <View style={{ gap: SPACE.md, paddingTop: SPACE.sm }}>
      {shown && shown.more ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          {`The first ${STOCK_LIST_SIZE} are shown here. Search to find the rest.`}
        </MartText>
      ) : null}
      <MartText variant="meta" color={MART.inkQuiet}>
        {access.writeStock ? 'Tap an item to say how many are on the shelf. ' : ''}A full stock take is done in the Stock app.
      </MartText>
    </View>
  );

  if (list.loaded.state === 'loading') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <View style={styles.padded}>
          <SkeletonRows />
        </View>
      </View>
    );
  }

  if (list.loaded.state === 'denied' || list.loaded.state === 'failed') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <Message
          title={list.loaded.state === 'denied' ? 'Not allowed' : 'Could not load the list'}
          body={list.loaded.words}
          {...(list.loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void list.reload() } } : {})}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={shown?.items ?? []}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void refreshAll()} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        <Message
          icon="checkmark-circle-outline"
          title={which === 'out' ? 'Nothing is out' : 'Nothing is running low'}
          body="Every item at this branch is above its level."
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACE.md }} />}
      renderItem={({ item }) => (
        <Row
          icon={which === 'out' ? 'alert-circle-outline' : 'pricetag-outline'}
          title={itemLabel(item)}
          subtitle={item.sku ? `Code ${item.sku}` : null}
          right={
            <MartText variant="price" color={which === 'out' ? MART.danger : MART.ink}>
              {onHandWords(item)}
            </MartText>
          }
          accessibilityLabel={`${itemLabel(item)}, ${item.onHandUnits === null ? 'quantity not known' : `${onHandWords(item)} on hand`}${item.sku ? `, code ${item.sku}` : ''}`}
          {...(access.writeStock ? { onPress: () => onOpenItem(item.id) } : {})}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  padded: {
    paddingHorizontal: GUTTER,
    paddingTop: GUTTER,
  },
  content: {
    padding: GUTTER,
    paddingBottom: SPACE.xxxl,
  },
});
