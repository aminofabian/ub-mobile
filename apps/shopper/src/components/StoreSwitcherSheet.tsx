import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listRememberedStores, type StoreSnapshot } from '@kiosk/core';
import { TENANT_HOST_SUFFIX } from '../lib/config';
import { forgetShop } from '../lib/forget-shop';
import { problemCopy } from '../lib/picker-copy';
import { useShopNavigator } from '../lib/ShopNavigator';
import { cardFromStore } from '../lib/store-card';
import { useOpening } from '../lib/useOpening';
import { GUTTER, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { Capsule } from './Capsule';
import { SHEET_SCRIM, SheetPanel } from './SheetPanel';
import { StoreRow } from './StoreRow';

/**
 * The shops this phone knows, one tap from the Home header (plan §5.12.3 J3). A shop opens from what the
 * phone already holds, so this works without a connection; a shop that is not in the list is one tap away
 * through "Find another shop".
 */
export function StoreSwitcherSheet({
  visible,
  activeSlug,
  activeName,
  onClose,
}: {
  visible: boolean;
  activeSlug: string;
  activeName: string;
  onClose: () => void;
}) {
  const navigator = useShopNavigator();
  const [stores, setStores] = useState<StoreSnapshot[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; forget?: StoreSnapshot } | null>(null);
  const mounted = useRef(true);
  const opening = useOpening();
  // While a shop is being opened the list stays: closing it would let the shop open behind a screen that is gone.
  const close = () => {
    if (!opening) onClose();
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const list = await listRememberedStores();
      if (mounted.current) setStores(list);
    } catch {
      if (mounted.current) setStores([]);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMessage(null);
      setBusyId(null);
      void load();
    }
  }, [visible, load]);

  async function pick(store: StoreSnapshot) {
    if (store.slug === activeSlug) {
      onClose();
      return;
    }
    setBusyId(store.businessId);
    setMessage(null);
    try {
      const result = await navigator.openRemembered(store.businessId);
      if (result.kind === 'busy') return; // another shop is being opened; nothing was started
      if (!mounted.current) return;
      if (result.kind === 'opened') {
        onClose();
        return;
      }
      if (result.kind === 'blocked') {
        setMessage({ text: 'Could not switch shops right now. Try again.' });
        return;
      }
      const copy = problemCopy(result, { method: 'recent', codesEnabled: false });
      setMessage({ text: `${copy.title}. ${copy.body}`, forget: result.kind === 'not_found' ? store : undefined });
    } catch {
      if (mounted.current) setMessage({ text: 'Something went wrong opening that shop. Try again.' });
    } finally {
      if (mounted.current) setBusyId(null);
    }
  }

  async function forget(store: StoreSnapshot) {
    await forgetShop(store); // never throws; the list below is reloaded either way
    if (mounted.current) {
      setMessage(null);
      void load();
    }
  }

  const others = (stores ?? []).filter((store) => store.slug !== activeSlug).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        <SheetPanel
          title="Your shops"
          hint="The shops on this phone"
          onClose={close}
          style={styles.sheet}
          footer={
            <Capsule
              label="Find another shop"
              kind="quiet"
              chip="search"
              disabled={opening}
              onPress={() => {
                onClose();
                navigator.findAnother();
              }}
            />
          }
        >
          {stores === null ? (
            <ActivityIndicator color={MART.ink} style={styles.loading} />
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
              {stores.map((store) => (
                <StoreRow
                  key={store.businessId}
                  card={cardFromStore(store, TENANT_HOST_SUFFIX)}
                  current={store.slug === activeSlug}
                  busy={busyId === store.businessId}
                  disabled={opening}
                  onPress={() => void pick(store)}
                  hint={store.slug === activeSlug ? undefined : 'Switches to this shop'}
                />
              ))}
            </ScrollView>
          )}

          {message ? (
            <View accessibilityLiveRegion="polite" style={styles.message}>
              <Text style={styles.messageText}>{message.text}</Text>
              {message.forget ? (
                <Pressable
                  onPress={() => void forget(message.forget as StoreSnapshot)}
                  accessibilityRole="button"
                  style={styles.messageAction}
                >
                  <Text style={styles.messageActionText}>Remove from this phone</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {others > 0 ? (
            <Text style={styles.note}>{`Your basket at ${activeName} stays there while you shop elsewhere.`}</Text>
          ) : null}
        </SheetPanel>
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
  sheet: {
    maxHeight: '82%',
  },
  loading: {
    paddingVertical: SPACE.xxl,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  message: {
    marginHorizontal: GUTTER,
    marginTop: SPACE.md,
    gap: SPACE.xs,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.dangerSurface,
  },
  messageText: {
    ...TYPE.label,
    color: MART.danger,
  },
  messageAction: {
    minHeight: 44,
    justifyContent: 'center',
  },
  messageActionText: {
    ...TYPE.label,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
  note: {
    ...TYPE.meta,
    marginHorizontal: GUTTER,
    marginTop: SPACE.md,
    color: MART.inkMuted,
  },
});
