import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { Chip, Field, Message, Notice, Row, SkeletonRows } from '../../components/owner-ui';
import { MAX_TABS, totalOwedCents, type CreditTab } from '../../lib/credit';
import { fetchTabs } from '../../lib/owner-api';
import { kesOrDash } from '../../lib/owner-money';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, SPACE } from '../../theme/mart';
import { MartText } from '../../theme/mart-ui';

const REFRESH_MS = 60_000;
/** How long the owner stops typing before the list is asked for again. */
const TYPING_PAUSE_MS = 450;

type Props = {
  api: ApiClient;
  /** Opens one customer's tab. */
  onOpenTab: (tab: CreditTab) => void;
};

/**
 * Who owes the shop money, the biggest tab first, with a search by name or phone. Tapping a tab opens it, where a
 * payment is recorded. The server's list is not paged, so the app keeps the biggest three hundred and says how many it
 * left out; a search narrows it.
 *
 * It is one list in every state (loading, not allowed, failed, ready), with the search box in the list's header. The
 * box must stay the same piece of the screen while the list under it changes: when the loading state was a different
 * tree, the box was thrown away each time typing paused and the keyboard closed under the owner's thumb.
 */
export function OwnerCreditScreen({ api, onOpenTab }: Props) {
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');

  // The list is asked for once typing pauses, not on every letter.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(typed.trim()), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const list = useLoaded(() => fetchTabs(api, query), REFRESH_MS, true, query);
  const loaded = list.loaded;
  const shown = loaded.state === 'ok' ? loaded.value : null;

  // The running total only reads once there is at least one tab; an empty list speaks through the centred
  // empty state below, not a stray line above the search box.
  const hasTabs = shown !== null && shown.tabs.length > 0;
  const header = (
    <View style={{ gap: SPACE.lg, paddingBottom: SPACE.lg }}>
      <Field icon="search-outline" label="Find a customer" placeholder="Name or phone" value={typed} onChangeText={setTyped} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      {hasTabs ? (
        <MartText variant="meta" color={MART.inkQuiet} style={{ marginLeft: SPACE.xs }}>
          {`${shown!.tabs.length === 1 ? '1 person owes' : `${shown!.tabs.length} people owe`} ${kesOrDash(totalOwedCents(shown!.tabs))}${query ? ' (matching your search)' : ''}`}
        </MartText>
      ) : null}
      {loaded.state === 'ok' && loaded.stale ? <Notice tone="warn">Could not refresh. This is the last list read.</Notice> : null}
      {shown && shown.omitted > 0 ? (
        <Notice tone="info">
          {`${shown.omitted} smaller ${shown.omitted === 1 ? 'tab is' : 'tabs are'} not shown here. Search for a customer by name or phone to find them. The total above only counts the ${MAX_TABS} shown.`}
        </Notice>
      ) : null}
    </View>
  );

  // What sits under the search box when there are no rows to show: the grey bars, or why there is nothing.
  const empty =
    loaded.state === 'loading' ? (
      <SkeletonRows />
    ) : loaded.state === 'denied' || loaded.state === 'failed' ? (
      <Message
        icon={loaded.state === 'denied' ? 'lock-closed-outline' : 'cloud-offline-outline'}
        title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load the list'}
        body={loaded.words}
        {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void list.reload() } } : {})}
      />
    ) : query ? (
      <Message icon="search-outline" title="Nobody matches that" body={`No customer's name or phone matches "${query}".`} />
    ) : (
      <Message icon="happy-outline" title="All settled" body="Nobody owes the shop anything right now." />
    );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={shown?.tabs ?? []}
      keyExtractor={(tab) => tab.customerId}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={() => void list.refresh()} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={() => <View style={{ height: SPACE.md }} />}
      renderItem={({ item }) => (
        <Row
          icon="person-outline"
          title={item.name}
          subtitle={item.phone}
          right={
            <>
              <MartText variant="price">{kesOrDash(item.owedCents)}</MartText>
              {item.suspended ? <Chip label="Credit stopped" tone="warn" /> : null}
            </>
          }
          accessibilityLabel={`${item.name}, owes ${kesOrDash(item.owedCents)}${item.suspended ? ', credit stopped' : ''}`}
          onPress={() => onOpenTab(item)}
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
  content: {
    padding: GUTTER,
    paddingBottom: SPACE.xxxl,
  },
});
