import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { Gloss, FONT, MART, MartText, RADIUS, SPACE, WEIGHT, onFill } from '@kiosk/staff';
import { Banner, Button, Text } from '@kiosk/ui';
import { MartListRow } from '../components/MartListRow';
import { fetchInvoices } from '../api/grocery-api';
import { sortInvoices, stateWords, type GroceryInvoice, type InvoiceState } from '../lib/invoices';
import { invoiceSubtitle, invoiceTitle, invoiceTone } from '../lib/sale-words';
import { useGrocerySession } from '../lib/session';
import { useNow } from '../lib/useNow';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Invoices'>;

type Filter = 'waiting' | 'paid' | 'all';

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

function stateOf(filter: Filter): InvoiceState | undefined {
  if (filter === 'waiting') return 'pending_payment';
  return filter === 'paid' ? 'paid' : undefined;
}

/**
 * Invoices at the till: waiting, paid, or all — filter pills and MART list rows.
 */
export function InvoiceListScreen({ navigation }: Props) {
  const { api, branchId } = useGrocerySession();
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('waiting');
  const [invoices, setInvoices] = useState<GroceryInvoice[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(
    async (which: Filter) => {
      latest.current += 1;
      const mine = latest.current;
      setLoading(true);
      try {
        const list = await fetchInvoices(api, branchId, stateOf(which));
        if (mine !== latest.current) return;
        if (list === null) {
          setFailed('The server sent something the app could not read.');
        } else {
          setInvoices(sortInvoices(list));
          setFailed(null);
        }
      } catch (error) {
        if (mine === latest.current) setFailed(readFailureWords(error));
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    },
    [api, branchId]
  );

  useFocusEffect(
    useCallback(() => {
      void load(filter);
    }, [load, filter])
  );

  const choose = (next: Filter) => {
    if (next === filter) return;
    setInvoices(null);
    setFailed(null);
    setFilter(next);
  };

  return (
    <View style={styles.fill}>
      <Gloss />
      <View style={styles.chips}>
        {FILTERS.map((entry) => {
          const on = filter === entry.key;
          return (
            <Pressable
              key={entry.key}
              onPress={() => choose(entry.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <MartText
                variant="label"
                color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                style={[styles.chipLabel, on && styles.chipLabelOn]}
              >
                {entry.label}
              </MartText>
            </Pressable>
          );
        })}
      </View>
      {failed ? (
        <Banner tone="danger" style={styles.banner}>
          <Text variant="caption">{failed}</Text>
          <Button title="Try again" variant="secondary" onPress={() => void load(filter)} style={styles.retry} />
        </Banner>
      ) : null}
      <FlatList
        style={styles.fill}
        contentContainerStyle={styles.list}
        data={invoices ?? []}
        keyExtractor={(invoice) => invoice.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={loading && invoices !== null} onRefresh={() => void load(filter)} tintColor={MART.fallbackPrimary} />}
        renderItem={({ item }) => (
          <MartListRow
            title={invoiceTitle(item)}
            subtitle={invoiceSubtitle(item, now)}
            right={stateWords[item.state]}
            rightTone={invoiceTone(item)}
            onPress={() => navigation.navigate('Invoice', { invoiceId: item.id })}
          />
        )}
        ListEmptyComponent={
          loading || failed || invoices === null ? null : (
            <View style={styles.empty}>
              <MartText variant="title" style={styles.emptyTitle}>
                {filter === 'waiting' ? 'Nothing waiting' : filter === 'paid' ? 'No paid invoices' : 'No invoices yet'}
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyCopy}>
                {filter === 'waiting'
                  ? 'Invoices waiting for payment at the till show up here.'
                  : filter === 'paid'
                    ? 'Paid invoices for this branch will list here.'
                    : 'Send a sale from the counter to raise the first invoice.'}
              </MartText>
            </View>
          )
        }
        ListFooterComponent={loading && invoices === null ? <ActivityIndicator style={styles.spinner} color={MART.fallbackPrimary} /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  chipOn: { backgroundColor: MART.fallbackPrimary },
  chipLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  chipLabelOn: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  banner: { marginHorizontal: SPACE.md },
  retry: { marginTop: SPACE.sm },
  list: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.xxxl, paddingTop: SPACE.xs },
  sep: { height: SPACE.sm },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xl, gap: SPACE.sm },
  emptyTitle: { textAlign: 'center' },
  emptyCopy: { textAlign: 'center', maxWidth: 280 },
  spinner: { padding: SPACE.lg },
});
