import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cameraOffText } from '../lib/picker-copy';
import { MART, ON_BRAND, RADIUS, SPACE, TYPE } from '../theme/mart';
import { ActionButton } from './ActionButton';

/**
 * Scans a shop's QR code. If the camera is off or refused, the same screen says so and offers the next
 * best thing at once: type the code, or search by name when there are no codes yet (plan §5.12.2). The
 * app never leaves a person at a black screen.
 */
export function ScanModal(props: ScanModalProps) {
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      {/* A modal is its own window on Android, so it needs its own safe-area provider. */}
      <SafeAreaProvider>
        <ScanBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

interface ScanModalProps {
  visible: boolean;
  codesEnabled: boolean;
  /** Search by name is on, so "search by name" is a way out when the camera is off. On unless said otherwise. */
  directoryEnabled?: boolean;
  onClose: () => void;
  onScanned: (data: string) => void;
  /** Closes the scanner and puts the cursor in the code field. */
  onTypeCode: () => void;
}

/** Mounted only while the scanner is open, so each opening starts fresh and asks the phone again. */
function ScanBody({ codesEnabled, directoryEnabled = true, onClose, onScanned, onTypeCode }: ScanModalProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const asked = useRef(false);
  const handled = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // Someone who switched the camera on in Settings comes back to this screen: look again.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getPermission();
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  const granted = permission?.granted === true;
  const unknown = permission === null;

  return (
    <View style={styles.screen}>
      {granted ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (!data || handled.current) return;
              handled.current = true;
              onScanned(data);
            }}
          />
          <View style={styles.frame} pointerEvents="none" />
          <View style={[styles.hint, { bottom: insets.bottom + 96 }]}>
            <Text style={styles.hintText}>Point the camera at the shop's QR code</Text>
          </View>
          <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.lg }]}>
            {codesEnabled ? (
              <Pressable onPress={onTypeCode} accessibilityRole="button" style={styles.footerLink}>
                <Text style={styles.footerLinkText}>Type the code instead</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : unknown ? (
        <View style={styles.centre}>
          <ActivityIndicator color={ON_BRAND.primary} />
        </View>
      ) : (
        <View style={[styles.off, { paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl }]}>
          <View style={styles.offIcon}>
            <Ionicons name="videocam-off-outline" size={26} color={MART.inkMuted} />
          </View>
          <Text style={styles.offTitle}>Camera is off</Text>
          <Text accessibilityLiveRegion="polite" style={styles.offBody}>
            {cameraOffText(codesEnabled, directoryEnabled)}
          </Text>
          <View style={styles.offActions}>
            {permission?.canAskAgain ? (
              <ActionButton label="Allow the camera" onPress={() => void requestPermission()} />
            ) : (
              <ActionButton
                label="Open settings"
                onPress={() => void Linking.openSettings().catch(() => undefined)}
                accessibilityHint="Opens this app's settings, where the camera can be switched on"
              />
            )}
            {codesEnabled || directoryEnabled ? (
              <ActionButton
                label={codesEnabled ? 'Type the code' : 'Search by name'}
                onPress={codesEnabled ? onTypeCode : onClose}
                kind="quiet"
              />
            ) : null}
          </View>
        </View>
      )}

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close scanner"
        style={[styles.close, { top: insets.top + SPACE.md }]}
      >
        <Ionicons name="close" size={22} color={granted ? ON_BRAND.primary : MART.ink} />
      </Pressable>
    </View>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: FRAME,
    height: FRAME,
    marginTop: -FRAME / 2,
    marginLeft: -FRAME / 2,
    borderWidth: 2,
    borderColor: ON_BRAND.primary,
    borderRadius: RADIUS.lg,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    ...TYPE.label,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    color: ON_BRAND.primary,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  footerLink: {
    minHeight: 48,
    paddingHorizontal: SPACE.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLinkText: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
    textDecorationLine: 'underline',
  },
  off: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
  },
  offIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
    marginBottom: SPACE.lg,
  },
  offTitle: {
    ...TYPE.display,
    color: MART.ink,
  },
  offBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  offActions: {
    marginTop: SPACE.xl,
    gap: SPACE.sm,
  },
  close: {
    position: 'absolute',
    right: SPACE.lg,
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
});
