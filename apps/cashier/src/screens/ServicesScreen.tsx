import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchServiceBook } from '../api/service-api';
import { ServiceSheet } from '../components/ServiceSheet';
import { cartCents, type CartLine } from '../lib/cart';
import { formatMoney } from '../lib/money';
import { CHECK_WAIT_MS, SEARCH_WAIT_OFFLINE_MS, waitFor } from '../lib/reach';
import { durationWords, priceWords, searchServices } from '../lib/service-sale';
import { basketWords, NO_PERFORMERS_WORDS, SERVICE_NOT_ADDED_WORDS, serviceAddedWords, servicesView } from '../lib/service-words';
import { usePosStore } from '../store/pos-store';
import { reachSink, useReach } from '../store/reach-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Services'> & {
  api: ApiClient;
  /** The shop's id: a list read for one shop is never used for another. */
  tenantId: string;
};

/** The shop's services, to put in the basket with who did them and what the customer chose. */
export function ServicesScreen({ navigation, api, tenantId }: Props) {
  const book = usePosStore((state) => state.serviceBook);
  const cart = usePosStore((state) => state.cart);
  const setServiceBook = usePosStore((state) => state.setServiceBook);
  const addServiceLine = usePosStore((state) => state.addServiceLine);

  const mine = book && book.tenantId === tenantId ? book : null;
  const [typed, setTyped] = useState('');
  // The first read starts as soon as the screen opens, so the first thing shown is "Loading", never a failure.
  const [loading, setLoading] = useState(true);
  // What went wrong in the latest read. The list on screen, if there is one, is then the one read before.
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  // The service being added, by id: the sheet shows it as the list now has it, and closes when the list no longer does.
  const [picking, setPicking] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  // The newest read wins: a slow answer to an older one never replaces what is on screen.
  const latest = useRef(0);

  const load = useCallback(async () => {
    latest.current += 1;
    const mark = latest.current;
    setLoading(true);
    setFailed(null);
    try {
      const wait = useReach.getState().offline ? SEARCH_WAIT_OFFLINE_MS : CHECK_WAIT_MS;
      const fresh = await waitFor(() => fetchServiceBook(api, tenantId, Date.now()), wait, reachSink);
      if (mark !== latest.current) return;
      setServiceBook(fresh);
    } catch (error) {
      if (mark !== latest.current) return;
      setFailed({ error });
    } finally {
      if (mark === latest.current) setLoading(false);
    }
  }, [api, tenantId, setServiceBook]);

  useEffect(() => {
    void load();
    return () => {
      // Leaving the screen: an answer that arrives later has nowhere to go.
      latest.current += 1;
    };
  }, [load]);

  const shown = useMemo(() => (mine ? searchServices(mine.services, typed) : []), [mine, typed]);
  const picked = useMemo(() => (mine && picking !== null ? (mine.services.find((service) => service.id === picking) ?? null) : null), [mine, picking]);
  useEffect(() => {
    if (picking !== null && picked === null) setPicking(null);
  }, [picking, picked]);
  const total = cartCents(cart);
  const view = servicesView({
    book: mine ? { asOf: mine.asOf, services: mine.services.length, performers: mine.performers.length } : null,
    shown: shown.length,
    typed,
    loading,
    failed,
  });

  const onAdd = (line: CartLine): string | null => {
    if (!addServiceLine(line)) return SERVICE_NOT_ADDED_WORDS;
    setPicking(null);
    setAdded(serviceAddedWords(line.name, line.service?.performerName ?? ''));
    return null;
  };

  const empty =
    view.instead === null ? null : view.instead.kind === 'failed' ? (
      <View style={styles.failed}>
        <Text variant="caption" style={styles.problem}>
          {view.instead.words}
        </Text>
        <Button title="Try again" variant="secondary" onPress={() => void load()} />
      </View>
    ) : (
      <Text variant="muted">{view.instead.words}</Text>
    );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search services"
        value={typed}
        onChangeText={(text) => {
          setAdded(null);
          setTyped(text);
        }}
        returnKeyType="search"
        accessibilityLabel="Search services"
      />

      {view.above ? (
        <View style={styles.stale} accessibilityRole="alert">
          <Text variant="caption" style={view.above.kind === 'problem' ? styles.problem : undefined}>
            {view.above.words}
          </Text>
          <Button title="Try again" variant="secondary" onPress={() => void load()} disabled={loading} style={styles.again} />
        </View>
      ) : null}
      {view.noPerformers ? (
        <Text variant="caption" style={styles.problem}>
          {NO_PERFORMERS_WORDS}
        </Text>
      ) : null}
      {added ? (
        <Text variant="caption" style={styles.added} accessibilityRole="alert">
          {added}
        </Text>
      ) : null}

      <FlatList
        data={shown}
        keyExtractor={(service) => service.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text variant="h2">Services</Text>}
        renderItem={({ item }) => {
          const duration = durationWords(item.durationMinutes);
          const price = priceWords(item);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                setAdded(null);
                setPicking(item.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={[item.name, duration, price].filter(Boolean).join(', ')}
            >
              <View style={styles.rowName}>
                <Text variant="body">{item.name}</Text>
                {duration ? <Text variant="muted">{duration}</Text> : null}
              </View>
              <Text variant="caption">{price}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={empty}
      />

      <View style={styles.footer}>
        <Text variant="body" style={styles.basket}>
          {basketWords(cart.length, total === null ? null : formatMoney(total))}
        </Text>
        <Button title="Back to basket" onPress={() => navigation.goBack()} />
      </View>

      <ServiceSheet service={picked} performers={mine?.performers ?? []} onCancel={() => setPicking(null)} onAdd={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.md, gap: theme.spacing.sm },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 48,
    backgroundColor: theme.colors.background,
  },
  stale: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, gap: theme.spacing.sm },
  again: { alignSelf: 'flex-start' },
  problem: { color: theme.colors.danger },
  added: { color: theme.colors.primaryDark },
  failed: { gap: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowName: { flex: 1 },
  footer: { gap: theme.spacing.sm, paddingTop: theme.spacing.sm },
  basket: { textAlign: 'center' },
});
