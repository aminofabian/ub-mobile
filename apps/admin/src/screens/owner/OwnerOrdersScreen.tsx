import React, { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { Chip, Message, Notice, OwnerButton, SkeletonRows, type NoticeTone } from '../../components/owner-ui';
import { createGate } from '../../lib/gate';
import { openLink } from '../../lib/open-link';
import {
  awaitingCount,
  confirmWords,
  describeStepFailure,
  groupOrders,
  nextStep,
  ORDERS_DENIED_WORDS,
  orderState,
  orderTotalWords,
  placedWords,
  stepDoneWords,
  type OwnerOrder,
  type Step,
} from '../../lib/orders';
import { advanceOrder, fetchOrders } from '../../lib/owner-api';
import { callUrl } from '../../lib/phone';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, HAIRLINE, MART, RADIUS, SHADOW, SPACE } from '../../theme/mart';
import { MartText } from '../../theme/mart-ui';

/** Orders are waiting on people, so the list is looked at again while it is on screen. */
const REFRESH_MS = 30_000;

type Item = { kind: 'head'; key: string; title: string; count: number } | { kind: 'order'; key: string; order: OwnerOrder };

/**
 * The shop's web orders, the ones waiting for the owner first. A paid order is moved along one step at a time (confirm
 * it, say it is ready, mark it handed over). The server answers 409 to a step already taken, so a step that got no
 * answer is safe to look at again: the list is read again after every try, whether it worked or not, and the screen
 * says what it finds. Taking payment, cancelling and messaging a customer are left to the web.
 */
export function OwnerOrdersScreen({ api }: { api: ApiClient }) {
  const { loaded, refreshing, refresh, reload } = useLoaded(() => fetchOrders(api), REFRESH_MS);
  const [acting, setActing] = useState<string | null>(null);
  /** A step is on its way. Read at once, so a second tap in the same moment cannot start another. */
  const taking = useRef(false);
  /** Shut while a "take this step?" question is on screen, so a second tap cannot put up a second one. */
  const asking = useMemo(createGate, []);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);

  const items = useMemo<Item[]>(() => {
    if (loaded.state !== 'ok') return [];
    return groupOrders(loaded.value).flatMap((group): Item[] => [
      { kind: 'head', key: `head-${group.key}`, title: group.title, count: group.orders.length },
      ...group.orders.map((order): Item => ({ kind: 'order', key: order.id, order })),
    ]);
  }, [loaded]);

  const take = async (order: OwnerOrder, step: Step) => {
    if (taking.current) return;
    taking.current = true;
    setActing(order.id);
    try {
      await advanceOrder(api, order.id, step.to);
      setNotice({ tone: 'ok', text: stepDoneWords(order, step) });
    } catch (error) {
      setNotice({ tone: 'warn', text: describeStepFailure(error).words });
    } finally {
      try {
        // Looked at again whether it worked or not: what is on the screen may be out of date.
        await reload();
      } finally {
        taking.current = false;
        setActing(null);
      }
    }
  };

  const ask = (order: OwnerOrder) => {
    const step = nextStep(order);
    if (!step || taking.current || !asking.enter()) return;
    const words = confirmWords(order, step);
    const done = () => asking.leave();
    Alert.alert(
      words.title,
      words.message,
      [
        { text: 'Not yet', style: 'cancel', onPress: done },
        {
          text: words.button,
          onPress: () => {
            done();
            void take(order, step);
          },
        },
      ],
      { cancelable: true, onDismiss: done }
    );
  };

  const call = (order: OwnerOrder) => void openLink(callUrl(order.phone), `This phone cannot make calls. The number is ${order.phone ?? 'not known'}.`);

  const waiting = loaded.state === 'ok' ? awaitingCount(loaded.value) : 0;

  const header = (
    <View style={{ gap: SPACE.md }}>
      {loaded.state === 'ok' && waiting > 0 ? (
        <MartText variant="label" color={MART.inkMuted}>
          {waiting === 1 ? '1 order is waiting for you to confirm it.' : `${waiting} orders are waiting for you to confirm them.`}
        </MartText>
      ) : null}
      {notice ? (
        <Notice tone={notice.tone} action={{ label: 'Dismiss', onPress: () => setNotice(null) }}>
          {notice.text}
        </Notice>
      ) : null}
      {loaded.state === 'ok' && loaded.stale ? <Notice tone="warn">Could not refresh. These are the last orders read.</Notice> : null}
    </View>
  );

  const footer = (
    <View style={{ gap: SPACE.md, paddingTop: SPACE.sm }}>
      <MartText variant="meta" color={MART.inkQuiet}>
        Taking payment for an unpaid order, cancelling an order and messaging a customer are not on this phone yet. The newest fifty orders are shown here.
      </MartText>
    </View>
  );

  if (loaded.state === 'loading') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <View style={styles.padded}>
          <SkeletonRows />
        </View>
      </View>
    );
  }

  if (loaded.state === 'denied' || loaded.state === 'failed') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <Message
          title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load web orders'}
          body={loaded.state === 'denied' ? ORDERS_DENIED_WORDS : loaded.words}
          {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void reload() } } : {})}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => item.key}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={<Message icon="cart-outline" title="No web orders yet" body="Orders placed on the shop's website will show here." />}
      ItemSeparatorComponent={() => <View style={{ height: SPACE.md }} />}
      renderItem={({ item }) =>
        item.kind === 'head' ? (
          <View style={styles.groupHead}>
            <MartText variant="heading">{item.title}</MartText>
            <View style={styles.groupCount}>
              <MartText variant="shelf" color={MART.inkMuted}>
                {item.count}
              </MartText>
            </View>
          </View>
        ) : (
          <OrderCard order={item.order} now={Date.now()} busy={acting === item.order.id} anyBusy={acting !== null} onStep={() => ask(item.order)} onCall={() => call(item.order)} />
        )
      }
    />
  );
}

function OrderCard({
  order,
  now,
  busy,
  anyBusy,
  onStep,
  onCall,
}: {
  order: OwnerOrder;
  now: number;
  busy: boolean;
  anyBusy: boolean;
  onStep: () => void;
  onCall: () => void;
}) {
  const state = orderState(order);
  const step = nextStep(order);
  const where = [order.branch, placedWords(order, now)].filter((part): part is string => Boolean(part)).join(' · ');
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: SPACE.xxs }}>
          <MartText variant="heading">{order.code}</MartText>
          <MartText variant="body" numberOfLines={1}>
            {order.customer}
          </MartText>
        </View>
        <MartText variant="price">{orderTotalWords(order)}</MartText>
      </View>
      <View style={styles.cardMeta}>
        <Chip label={state.label} tone={state.tone} />
        {where ? (
          <MartText variant="meta" color={MART.inkQuiet} style={{ flexShrink: 1 }}>
            {where}
          </MartText>
        ) : null}
      </View>
      {step || order.phone ? (
        <View style={styles.actions}>
          {order.phone ? <OwnerButton kind="quiet" label="Call" accessibilityLabel={`Call ${order.customer}`} onPress={onCall} style={{ flex: 1 }} /> : null}
          {step ? <OwnerButton label={step.label} accessibilityLabel={`${step.label} order ${order.code}`} busy={busy} disabled={anyBusy} onPress={onStep} style={{ flex: 2 }} /> : null}
        </View>
      ) : null}
    </View>
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
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginTop: SPACE.lg,
    marginBottom: SPACE.xs,
  },
  groupCount: {
    minWidth: 26,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  card: {
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACE.md,
  },
});
