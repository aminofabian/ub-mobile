import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import type { StoreSnapshot } from '@kiosk/core';
import { openLookedUpStore } from '../lib/open-shop';
import { useOpening } from '../lib/useOpening';
import { GUTTER } from '../theme/mart';
import { SHEET_SCRIM, SheetPanel } from './SheetPanel';
import { StorePreviewCard } from './StorePreviewCard';

/**
 * A link or QR code that arrives while a shop is open. It never changes the shop by itself (plan §5.7):
 * it shows the shop it names and waits for a tap.
 */
export function LinkOfferModal({
  store,
  currentShopName,
  onOpened,
  onDismiss,
}: {
  store: StoreSnapshot | null;
  currentShopName: string;
  onOpened: (store: StoreSnapshot) => void;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opening = useOpening();
  // While a shop is being opened the card stays: closing it would let the shop open behind a screen that is gone.
  const stuck = busy || opening;
  const dismiss = () => {
    if (!stuck) onDismiss();
  };

  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [store]);

  async function open(target: StoreSnapshot) {
    setBusy(true);
    setError(null);
    try {
      const result = await openLookedUpStore(target);
      if (result === 'opened') {
        onOpened(target);
      } else if (result === 'blocked') {
        setError('Could not switch shops right now. Try again.');
      }
      // `busy`: another shop is being opened. Nothing was started, and this card waits for it to finish.
    } catch {
      setError('Something went wrong opening that shop. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={store !== null} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" />
        {store ? (
          <SheetPanel title="Open this shop?" onClose={dismiss} closeLabel="Not now">
            <View style={styles.body}>
              <StorePreviewCard
                store={store}
                busy={stuck}
                error={error}
                dismissLabel="Not now"
                note={`Your basket at ${currentShopName} stays where it is.`}
                onOpen={() => void open(store)}
                onDismiss={dismiss}
              />
            </View>
          </SheetPanel>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SHEET_SCRIM,
  },
  body: {
    paddingHorizontal: GUTTER,
  },
});
