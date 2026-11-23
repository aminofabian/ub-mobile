import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StoreSnapshot } from '@kiosk/core';
import { openLookedUpStore } from '../lib/open-shop';
import { useOpening } from '../lib/useOpening';
import { GUTTER, MART, SPACE, TYPE } from '../theme/mart';
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
  const insets = useSafeAreaInsets();
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
          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, SPACE.lg) }]}>
            <Text style={styles.head}>Open this shop?</Text>
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
    backgroundColor: 'rgba(11,17,14,0.45)',
  },
  panel: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    gap: SPACE.md,
    backgroundColor: MART.paper,
  },
  head: {
    ...TYPE.title,
    color: MART.ink,
  },
});
