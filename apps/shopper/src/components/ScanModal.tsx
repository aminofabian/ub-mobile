import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { cameraOffText } from '../lib/picker-copy';
import { GUTTER, MART, SPACE, TYPE, ZONE } from '../theme/mart';
import { Capsule, ChipButton } from './Capsule';
import { Lobe } from './Coast';
import { SHEET_SCRIM } from './SheetPanel';
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
          <Viewfinder />
          <View style={[styles.hint, { top: insets.top + SPACE.md + 44 + SPACE.xl }]}>
            <Text style={styles.hintTitle}>Scan the shop's QR code</Text>
            <Text style={styles.hintText}>Point the camera at the code at the till.</Text>
          </View>
          {codesEnabled ? (
            <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.lg }]}>
              <Capsule label="Type the code instead" chip="keypad" fill={MART.paper} onPress={onTypeCode} />
            </View>
          ) : null}
        </>
      ) : unknown ? (
        <View style={styles.centre}>
          <ActivityIndicator color={MART.paper} />
        </View>
      ) : (
        <View style={[styles.off, { paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl }]}>
          <Lobe color={ZONE.coral} size={96} shape={1} style={styles.offIcon}>
            <Ionicons name="videocam-off" size={36} color={MART.ink} />
          </Lobe>
          <Text accessibilityRole="header" style={styles.offTitle}>
            Camera is off
          </Text>
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

      <View style={[styles.close, { top: insets.top + SPACE.md }]}>
        <ChipButton
          icon="close"
          label="Close scanner"
          onPress={onClose}
          fill={granted ? MART.paper : MART.ink}
          size={44}
        />
      </View>
    </View>
  );
}

const FRAME = 248;
const CORNER = 36;

/**
 * Flat ink over the whole camera with one rounded window cut out of it, so the eye goes to the only
 * place that matters. Drawn as a single shape: a hole in a field, not four bars around a square.
 */
function Viewfinder() {
  const { width, height } = useWindowDimensions();
  const x = (width - FRAME) / 2;
  const y = (height - FRAME) / 2;
  const r = CORNER;
  const hole =
    `M${x + r} ${y}H${x + FRAME - r}Q${x + FRAME} ${y} ${x + FRAME} ${y + r}V${y + FRAME - r}` +
    `Q${x + FRAME} ${y + FRAME} ${x + FRAME - r} ${y + FRAME}H${x + r}Q${x} ${y + FRAME} ${x} ${y + FRAME - r}` +
    `V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M0 0H${width}V${height}H0Z${hole}`} fill={SHEET_SCRIM} fillRule="evenodd" />
      <Path d={hole} fill="none" stroke={MART.paper} strokeWidth={3} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.ink,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
  },
  hintTitle: {
    ...TYPE.display,
    color: MART.paper,
  },
  hintText: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.paper,
  },
  footer: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 0,
  },
  off: {
    flex: 1,
    paddingHorizontal: GUTTER,
    backgroundColor: MART.paper,
  },
  offIcon: {
    marginLeft: -SPACE.sm,
    marginBottom: SPACE.xl,
  },
  offTitle: {
    ...TYPE.display,
    color: MART.ink,
  },
  offBody: {
    ...TYPE.body,
    marginTop: SPACE.md,
    color: MART.inkMuted,
  },
  offActions: {
    marginTop: SPACE.xxl,
    gap: SPACE.sm,
  },
  close: {
    position: 'absolute',
    right: GUTTER,
  },
});
