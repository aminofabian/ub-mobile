import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { generateIdempotencyKey } from '@kiosk/core';
import { Gloss, MartText, PressableScale, FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, onFill, useKept } from '@kiosk/staff';
import { Banner, Button, Text } from '@kiosk/ui';
import { MartListRow } from '../components/MartListRow';
import { claimBasket, clearBasket, type BasketLine } from '../lib/basket';
import { basketFrom, changeProblem, changeProblemWords, discardForward, forwardWords, forwardsOf, retryAsNew, unsentFor, type ForwardEntry } from '../lib/forward';
import { clockTime, discardWords, lineSummary, reportWords, saleHeadline, saleStatus, saleTag, type Say } from '../lib/sale-words';
import { useForwardSender } from '../lib/sender';
import { useGrocerySession } from '../lib/session';
import { useNow } from '../lib/useNow';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { openTab } from '../navigation/root-nav';
import { basketKeeperFor, forwardKeeperFor } from '../store/invoice-store';
import { usePrinter } from '../store/printer-store';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Sales'>;

function ordered(entries: readonly ForwardEntry[]): ForwardEntry[] {
  const newest = [...entries].reverse();
  return [...newest.filter((entry) => !entry.result), ...newest.filter((entry) => entry.result)];
}

function Lines({ lines }: { lines: readonly BasketLine[] }) {
  return (
    <View style={styles.lines}>
      {lines.map((line) => (
        <MartText key={line.lineId} variant="meta" color={MART.inkMuted}>
          {`${line.name}: ${lineSummary(line)}`}
        </MartText>
      ))}
    </View>
  );
}

/** Plain Pressable — PressableScale has eaten taps inside ScrollView on the simulator. */
function Action({ title, onPress, primary = false, danger = false, disabled = false }: { title: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        disabled && styles.dim,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <MartText
        variant="label"
        color={primary ? onFill(MART.fallbackPrimary).primary : danger ? MART.danger : MART.ink}
        style={styles.actionLabel}
      >
        {title}
      </MartText>
    </Pressable>
  );
}

/**
 * Sales from this phone: waiting, sent, or refused — with the few actions that still need a person.
 */
export function SalesScreen({ navigation }: Props) {
  const { tenantId, userId, branchId } = useGrocerySession();
  const now = useNow();
  const { flush } = useForwardSender();
  const printerSaved = usePrinter((s) => s.saved);
  const printerLoaded = usePrinter((s) => s.loaded);
  const forwardKeeper = useMemo(() => forwardKeeperFor(tenantId), [tenantId]);
  const basketKeeper = useMemo(() => basketKeeperFor(tenantId), [tenantId]);
  const forwardKept = useKept(forwardKeeper);
  const basketKept = useKept(basketKeeper);
  const [open, setOpen] = useState<string | null>(null);
  const [say, setSay] = useState<Say | null>(null);
  const [busy, setBusy] = useState(false);

  const owner = useMemo(() => ({ ownerId: userId, branchId }), [userId, branchId]);
  const sales = useMemo(() => ordered(forwardsOf(forwardKept.value, userId)), [forwardKept.value, userId]);
  const unsent = unsentFor(forwardKept.value, userId);

  const sendNow = useCallback(async () => {
    setBusy(true);
    try {
      setSay(reportWords(await flush()));
    } catch {
      setSay({ tone: 'warn', text: 'Could not send just now. Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  }, [flush]);

  const discard = useCallback(
    (entry: ForwardEntry, sure: boolean) => {
      const result = discardForward(forwardKeeper.get(), entry.id, sure ? { sure: true } : {});
      if (result.ok) {
        forwardKeeper.update(() => result.state);
        setOpen(null);
        setSay({ tone: 'info', text: 'The sale was taken off this phone.' });
      } else if (result.why === 'in_doubt') {
        setSay({ tone: 'warn', text: 'This sale may already be at the cashier. Look in Invoices first.' });
      }
    },
    [forwardKeeper]
  );

  const confirmDiscard = useCallback(
    (entry: ForwardEntry) => {
      const ask = discardWords(entry);
      if (ask.doubtful) {
        Alert.alert(ask.title, ask.message, [
          { text: 'Look in Invoices', onPress: () => openTab('InvoicesTab', 'Invoices') },
          { text: 'Throw it away', style: 'destructive', onPress: () => discard(entry, true) },
          { text: 'Keep it', style: 'cancel' },
        ]);
        return;
      }
      Alert.alert(ask.title, ask.message, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Throw it away', style: 'destructive', onPress: () => discard(entry, false) },
      ]);
    },
    [discard]
  );

  const sendAgain = useCallback(
    (entry: ForwardEntry) => {
      const result = retryAsNew(forwardKeeper.get(), entry.id, { id: generateIdempotencyKey(), issueKey: generateIdempotencyKey() }, Date.now());
      if (!result.ok) {
        setSay({ tone: 'warn', text: result.why === 'in_doubt' ? 'This sale may already be at the cashier. Look in Invoices first.' : 'This sale cannot be sent again.' });
        return;
      }
      forwardKeeper.update(() => result.state);
      setSay({ tone: 'info', text: 'Sending it again as a new sale.' });
      void flush();
    },
    [forwardKeeper, flush]
  );

  /** Put this refused sale back in the basket and open Sell → Basket. */
  const applyChange = useCallback(
    (entry: ForwardEntry) => {
      const at = Date.now();
      basketKeeper.update(() => basketFrom(entry, at));
      const result = discardForward(forwardKeeper.get(), entry.id);
      if (result.ok) forwardKeeper.update(() => result.state);
      setOpen(null);
      setSay(null);
      openTab('SellTab', 'Finalize');
    },
    [basketKeeper, forwardKeeper]
  );

  const change = useCallback(
    (entry: ForwardEntry) => {
      if (!basketKept.ready || !forwardKept.ready) {
        Alert.alert('Still loading', 'What is kept on this phone is still being read. Try again in a moment.');
        return;
      }
      const problem = changeProblem(entry, { branchId }, claimBasket(basketKeeper.get(), owner, Date.now()).lines.length);
      if (problem === 'other_branch') {
        Alert.alert('Wrong branch', changeProblemWords.other_branch);
        return;
      }
      if (problem === 'basket_in_use') {
        Alert.alert('Basket has items', 'Clear the basket and put this sale in it instead?', [
          { text: 'Keep the basket', style: 'cancel' },
          {
            text: 'Clear and change',
            style: 'destructive',
            onPress: () => {
              basketKeeper.update((current) => clearBasket(claimBasket(current, owner, Date.now()), Date.now()));
              applyChange(entry);
            },
          },
        ]);
        return;
      }
      applyChange(entry);
    },
    [applyChange, basketKeeper, basketKept.ready, branchId, forwardKept.ready, owner]
  );

  if (forwardKept.failed || basketKept.failed) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <Banner tone="danger" style={styles.pad}>
          <Text variant="caption">What is kept on this phone could not be read. Nothing has been lost.</Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              forwardKept.retry();
              basketKept.retry();
            }}
            style={styles.gap}
          />
        </Banner>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Gloss />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {say ? <Banner tone={say.tone}>{say.text}</Banner> : null}

        {printerLoaded && !printerSaved ? (
          <Pressable
            onPress={() => navigation.navigate('PrinterSettings')}
            accessibilityRole="button"
            accessibilityLabel="Pair a printer to print invoices"
            style={styles.printerHint}
          >
            <MartText variant="meta" color={MART.inkQuiet}>
              Pair a printer to print invoices when you send to the cashier.
            </MartText>
            <MartText variant="shelf" color={MART.fallbackPrimary}>
              PRINTER
            </MartText>
          </Pressable>
        ) : printerLoaded && printerSaved ? (
          <Pressable
            onPress={() => navigation.navigate('PrinterSettings')}
            accessibilityRole="button"
            accessibilityLabel="Invoice printer settings"
            style={styles.printerHint}
          >
            <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
              Printing on {printerSaved.name}
            </MartText>
            <MartText variant="shelf" color={MART.fallbackPrimary}>
              CHANGE
            </MartText>
          </Pressable>
        ) : null}

        {unsent > 0 ? (
          <PressableScale
            onPress={() => void sendNow()}
            disabled={busy}
            scaleTo={0.98}
            style={[styles.sendAll, busy && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Sending' : `Send ${unsent} waiting sales`}
          >
            <MartText variant="label" color={onFill(MART.fallbackPrimary).primary} style={styles.sendAllLabel}>
              {busy ? 'Sending…' : unsent === 1 ? 'Send waiting sale now' : `Send ${unsent} waiting sales now`}
            </MartText>
          </PressableScale>
        ) : null}

        {forwardKept.ready && sales.length === 0 ? (
          <View style={styles.empty}>
            <MartText variant="title" style={styles.emptyTitle}>
              No sales yet
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyCopy}>
              Sales you send from the counter show up here until the till has them.
            </MartText>
          </View>
        ) : null}

        {sales.map((entry) => {
          const status = saleStatus(entry, now);
          const words = forwardWords(entry, now);
          const expanded = open === entry.id;
          const invoiceId = entry.result ? entry.result.invoiceId : null;
          return (
            <View key={entry.id} style={styles.card}>
              <MartListRow
                title={saleHeadline(entry)}
                subtitle={`${clockTime(entry.createdAt)} · ${status.words}`}
                right={saleTag(entry, now)}
                rightTone={status.tone}
                selected={expanded}
                onPress={() => setOpen(expanded ? null : entry.id)}
              />
              {expanded ? (
                <View style={styles.detail}>
                  {invoiceId ? (
                    <>
                      <MartText variant="body" color={MART.inkMuted}>
                        {status.words}
                      </MartText>
                      <Action title="Open the invoice" onPress={() => openTab('SellTab', 'Invoice', { invoiceId })} />
                    </>
                  ) : (
                    <>
                      <Lines lines={entry.lines} />
                      {words === 'in_doubt' ? (
                        <>
                          <Action title="Look in Invoices" primary onPress={() => openTab('InvoicesTab', 'Invoices')} />
                          <Action title="Ask again now" onPress={() => void sendNow()} disabled={busy} />
                        </>
                      ) : null}
                      {words === 'waiting' || words === 'stale' ? <Action title="Send now" primary onPress={() => void sendNow()} disabled={busy} /> : null}
                      {words === 'refused' && !entry.inDoubt ? (
                        <>
                          <Action title="Change it" primary onPress={() => change(entry)} />
                          <Action title="Send it again as it is" onPress={() => sendAgain(entry)} />
                        </>
                      ) : null}
                      <Action title="Throw this sale away" danger onPress={() => confirmDiscard(entry)} />
                    </>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  pad: { margin: SPACE.md },
  body: { padding: SPACE.md, gap: SPACE.sm, paddingBottom: SPACE.xxxl },
  gap: { marginTop: SPACE.sm },
  printerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xl, gap: SPACE.sm },
  emptyTitle: { textAlign: 'center' },
  emptyCopy: { textAlign: 'center', maxWidth: 280 },
  sendAll: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.xs,
  },
  sendAllLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  card: { gap: SPACE.xs },
  detail: {
    marginTop: 2,
    marginBottom: SPACE.xs,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  lines: { gap: 4, marginBottom: SPACE.xs },
  action: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
  },
  actionPrimary: { backgroundColor: MART.fallbackPrimary },
  actionDanger: { backgroundColor: MART.dangerSurface },
  actionPressed: { opacity: 0.75 },
  actionLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  dim: { opacity: 0.5 },
});
