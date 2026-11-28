import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatQty, readFailureWords } from '@kiosk/core';
import { Banner, Button, Card, Row, Text, theme, type BannerTone } from '@kiosk/ui';
import { fetchBranchList, fetchTransfers, stepTransfer } from '../api/stock-api';
import { shortDate } from '../lib/dates';
import { useStockSession } from '../lib/session';
import {
  actionsFor,
  branchName,
  classifyStep,
  didStepHappen,
  directionFor,
  statusWords,
  stepFailureWords,
  type Transfer,
  type TransferAction,
} from '../lib/transfers';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Transfer'>;

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'gone' }
  | { state: 'ready'; transfer: Transfer; branches: Array<{ id?: unknown; name?: unknown }> };

type Note = { tone: BannerTone; text: string };

const LABELS: Record<TransferAction, string> = { send: 'Send it', receive: 'Receive it', cancel: 'Cancel it' };

function askWords(action: TransferAction, otherBranch: string): { title: string; body: string } {
  switch (action) {
    case 'send':
      return { title: 'Send this transfer?', body: `The stock leaves this branch now and goes to ${otherBranch}.` };
    case 'receive':
      return { title: 'Receive this transfer?', body: `Check the items have arrived from ${otherBranch}. They are added to this branch's stock.` };
    case 'cancel':
      return { title: 'Cancel this transfer?', body: 'Anything already taken off the shelf for it goes back.' };
  }
}

/** One transfer, and the step this branch may take with it. The server decides what is allowed; a step is never repeated on a guess. */
export function TransferScreen({ route }: Props) {
  const { api, branchId, mayMove } = useStockSession();
  const { transferId } = route.params;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  /** Reads the transfer as it is now. Returns it, or undefined when it is not in the list or could not be read. */
  const load = useCallback(async (): Promise<Transfer | undefined> => {
    const [transfers, branches] = await Promise.all([fetchTransfers(api, branchId), fetchBranchList(api).catch(() => null)]);
    if (!transfers) throw new Error('unreadable');
    const found = transfers.find((candidate) => candidate.id === transferId);
    setLoaded(found ? { state: 'ready', transfer: found, branches: branches ?? [] } : { state: 'gone' });
    return found;
  }, [api, branchId, transferId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void load().catch((error: unknown) => {
        if (live) setLoaded({ state: 'failed', words: error instanceof Error && error.message === 'unreadable' ? 'The server sent something the app could not read.' : readFailureWords(error) });
      });
      return () => {
        live = false;
      };
    }, [load, attempt])
  );

  const step = useCallback(
    async (action: TransferAction) => {
      if (working.current) return;
      working.current = true;
      setBusy(true);
      setNote(null);
      try {
        try {
          await stepTransfer(api, action, transferId);
        } catch (error) {
          const failure = classifyStep(error);
          // Whatever went wrong, look at where the transfer is now before saying anything.
          let now: Transfer | undefined;
          let read = true;
          try {
            now = await load();
          } catch {
            read = false;
          }
          if (failure === 'doubt') {
            const happened = read ? didStepHappen(action, now) : 'unclear';
            if (happened === 'done') setNote({ tone: 'ok', text: 'It went through.' });
            else if (happened === 'not_done') setNote({ tone: 'warn', text: 'It did not go through. You can try again.' });
            else setNote({ tone: 'warn', text: 'There was no clear answer and the transfer cannot be checked now. Look at the list before trying again.' });
          } else {
            setNote({ tone: 'warn', text: stepFailureWords(action, failure) });
          }
          return;
        }
        try {
          await load();
          setNote({ tone: 'ok', text: action === 'send' ? 'Sent.' : action === 'receive' ? 'Received. The stock is on your shelves.' : 'Cancelled.' });
        } catch {
          setNote({ tone: 'ok', text: 'Done. The list could not be read again just now.' });
        }
      } finally {
        working.current = false;
        setBusy(false);
      }
    },
    [api, load, transferId]
  );

  if (loaded.state === 'loading') return <Text variant="muted" style={styles.body}>Loading…</Text>;
  if (loaded.state === 'failed') {
    return (
      <ScrollView contentContainerStyle={styles.body}>
        <Banner tone="danger">{loaded.words}</Banner>
        <Button title="Try again" onPress={() => { setLoaded({ state: 'loading' }); setAttempt((n) => n + 1); }} />
      </ScrollView>
    );
  }
  if (loaded.state === 'gone') return <Banner tone="info" style={styles.banner}>This transfer is no longer in the list.</Banner>;

  const { transfer, branches } = loaded;
  const direction = directionFor(transfer, branchId);
  const other = branchName(branches, direction === 'out' ? transfer.toBranchId : transfer.fromBranchId);
  const actions = actionsFor(transfer, branchId, mayMove);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}
      <Card style={styles.card}>
        <Text variant="h2">{direction === 'out' ? `To ${other}` : direction === 'in' ? `From ${other}` : 'Between two other branches'}</Text>
        <Text>{statusWords(transfer, branchId)}</Text>
        {transfer.createdAt ? <Text variant="muted">Made {shortDate(transfer.createdAt)}</Text> : null}
        {transfer.notes ? <Text variant="muted">{transfer.notes}</Text> : null}
      </Card>

      <Card style={styles.card}>
        {transfer.lines.length === 0 ? <Text variant="muted">No items listed.</Text> : null}
        {transfer.lines.map((line) => (
          <Row key={line.itemId} title={line.name} right={formatQty(line.units)} />
        ))}
      </Card>

      {actions.map((action) => (
        <Button
          key={action}
          title={busy ? 'Working…' : LABELS[action]}
          variant={action === 'cancel' ? 'danger' : 'primary'}
          disabled={busy}
          style={styles.gap}
          onPress={() => {
            const words = askWords(action, other);
            Alert.alert(words.title, words.body, [
              { text: 'Not yet', style: 'cancel' },
              { text: LABELS[action], style: action === 'cancel' ? 'destructive' : 'default', onPress: () => void step(action) },
            ]);
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: theme.spacing.md },
  banner: { margin: theme.spacing.md },
  card: { marginBottom: theme.spacing.md },
  gap: { marginTop: theme.spacing.sm },
});
