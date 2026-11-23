import React, { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { advanceWebOrder, fetchWebOrders } from '../api/pos-api';
import { NoticeBar } from '../components/NoticeBar';
import { mayAdvanceWebOrders } from '../lib/shop-flags';
import type { TillPerson } from '../lib/till-person';
import {
  confirmWords,
  describeAdvanceFailure,
  describeListFailure,
  nextStep,
  openOrdersFor,
  orderTotalWords,
  placedWords,
  statusLabel,
  type WebOrder,
} from '../lib/web-orders';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'WebOrders'> & {
  api: ApiClient;
  branchId: string;
  person: TillPerson;
};

/** Orders are waiting on people, so the list is looked at again while it is on screen. */
const REFRESH_EVERY_MS = 30_000;

export function WebOrdersScreen({ api, branchId, person }: Props) {
  const [orders, setOrders] = useState<WebOrder[] | null>(null);
  const [failure, setFailure] = useState<{ denied: boolean; words: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const mayAdvance = mayAdvanceWebOrders(person.permissions);

  // The newest answer wins: a slow older one never replaces a newer list.
  const latest = useRef(0);
  const load = useCallback(async () => {
    latest.current += 1;
    const mine = latest.current;
    try {
      const read = await fetchWebOrders(api);
      if (mine !== latest.current) return;
      setOrders(read);
      setFailure(null);
      setNow(Date.now());
    } catch (error) {
      if (mine !== latest.current) return;
      setFailure(describeListFailure(error));
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), REFRESH_EVERY_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  const pullToRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const take = async (order: WebOrder) => {
    const step = nextStep(order);
    if (!step || acting !== null) return;
    setActing(order.id);
    try {
      await advanceWebOrder(api, order.id, step.to);
      setNotice([`${order.code}: ${step.label.toLowerCase()} done.`]);
    } catch (error) {
      const failed = describeAdvanceFailure(error);
      setNotice([failed.words]);
    } finally {
      // Looked at again whether it worked or not: what is on screen may be out of date.
      await load();
      setActing(null);
    }
  };

  const ask = (order: WebOrder) => {
    const step = nextStep(order);
    if (!step) return;
    const words = confirmWords(order, step);
    Alert.alert(words.title, words.message, [
      { text: 'Not yet', style: 'cancel' },
      { text: words.button, onPress: () => void take(order) },
    ]);
  };

  const dial = async (order: WebOrder) => {
    try {
      await Linking.openURL(`tel:${order.phone}`);
    } catch {
      setNotice([`This phone cannot make calls. The number is ${order.phone}.`]);
    }
  };

  const shown = orders ? openOrdersFor(orders, branchId) : [];

  return (
    <View style={styles.container}>
      <NoticeBar notes={notice} onDismiss={() => setNotice([])} />
      {failure ? (
        <View style={styles.failure}>
          <Text variant="body" style={styles.problem}>
            {failure.words}
          </Text>
          {failure.denied ? null : <Button title="Try again" variant="secondary" onPress={() => void load()} />}
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} />}
        ListEmptyComponent={
          failure?.denied ? null : orders === null && !failure ? (
            <Text variant="muted">Loading...</Text>
          ) : orders !== null ? (
            <Text variant="muted">No open web orders for this branch.</Text>
          ) : null
        }
        renderItem={({ item: order }) => {
          const step = mayAdvance ? nextStep(order) : null;
          const age = placedWords(order, now);
          return (
            <Card style={styles.order}>
              <View style={styles.top}>
                <Text variant="h2" style={styles.code}>
                  {order.code}
                </Text>
                <Text variant="body" style={order.paid ? styles.paid : styles.unpaid}>
                  {statusLabel(order)}
                </Text>
              </View>
              <Text variant="body">{order.customer}</Text>
              <Text variant="muted">
                {orderTotalWords(order)}
                {age ? ` - ${age}` : ''}
              </Text>
              {!order.paid ? <Text variant="caption">Not paid yet. Payment is taken online or by the owner.</Text> : null}
              <View style={styles.buttons}>
                {order.phone ? (
                  <Button title="Call" variant="secondary" onPress={() => void dial(order)} style={styles.button} />
                ) : null}
                {step ? (
                  <Button
                    title={acting === order.id ? 'Working...' : step.label}
                    onPress={() => ask(order)}
                    disabled={acting !== null}
                    style={styles.button}
                  />
                ) : null}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.sm },
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  order: { gap: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { marginBottom: 0 },
  paid: { color: theme.colors.success },
  unpaid: { color: theme.colors.textMuted },
  buttons: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  button: { flex: 1 },
  failure: { padding: theme.spacing.md, gap: theme.spacing.sm },
  problem: { color: theme.colors.danger },
});
