import React, { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MART, MartText, RADIUS, SPACE } from '@kiosk/staff';
import { CARD_SURFACE, CashierButton } from '../components/CashierPrimitives';
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
          <MartText variant="body" style={styles.problem}>
            {failure.words}
          </MartText>
          {failure.denied ? null : <CashierButton title="Try again" variant="secondary" onPress={() => void load()} />}
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullToRefresh()} />}
        ListEmptyComponent={
          failure?.denied ? null : orders === null && !failure ? (
            <MartText variant="meta" color={MART.inkQuiet}>Loading...</MartText>
          ) : orders !== null ? (
            <MartText variant="meta" color={MART.inkQuiet}>No open web orders for this branch.</MartText>
          ) : null
        }
        renderItem={({ item: order }) => {
          const step = mayAdvance ? nextStep(order) : null;
          const age = placedWords(order, now);
          return (
            <View style={[CARD_SURFACE, styles.order]}>
              <View style={styles.top}>
                <MartText variant="title" style={styles.code}>
                  {order.code}
                </MartText>
                <MartText variant="body" style={order.paid ? styles.paid : styles.unpaid}>
                  {statusLabel(order)}
                </MartText>
              </View>
              <MartText variant="body">{order.customer}</MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                {orderTotalWords(order)}
                {age ? ` - ${age}` : ''}
              </MartText>
              {!order.paid ? <MartText variant="meta">Not paid yet. Payment is taken online or by the owner.</MartText> : null}
              <View style={styles.buttons}>
                {order.phone ? (
                  <CashierButton title={`Call ${order.phone}`} variant="secondary" onPress={() => void dial(order)} style={styles.button} />
                ) : null}
                {step ? (
                  <CashierButton
                    title={acting === order.id ? 'Working...' : step.label}
                    onPress={() => ask(order)}
                    disabled={acting !== null}
                    style={styles.button}
                  />
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MART.paper, paddingTop: SPACE.sm },
  list: { padding: SPACE.md, gap: SPACE.md },
  order: { gap: SPACE.xs, padding: SPACE.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { marginBottom: 0 },
  paid: { color: MART.success },
  unpaid: { color: MART.inkMuted },
  buttons: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  button: { flex: 1 },
  failure: { padding: SPACE.md, gap: SPACE.sm },
  problem: { color: MART.danger },
});
