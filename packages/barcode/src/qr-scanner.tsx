import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { describeCameraAccess } from './camera-copy';

export interface QrScannerProps {
  /** The text of the first QR code the camera reads. Called once. */
  onScanned: (text: string) => void;
  /** The person backed out, or the camera cannot be used: the caller shows another way to enter the code. */
  onCancel: () => void;
}

interface CameraPermission {
  granted: boolean;
  canAskAgain: boolean;
}

interface CameraKit {
  CameraView: React.ComponentType<Record<string, unknown>>;
  Camera: {
    getCameraPermissionsAsync: () => Promise<CameraPermission>;
    requestCameraPermissionsAsync: () => Promise<CameraPermission>;
  };
}

type Access =
  | { kind: 'checking' }
  | { kind: 'ready'; CameraView: CameraKit['CameraView'] }
  /** The person said no to the camera. `canAskAgain` is false once the phone no longer shows the question. */
  | { kind: 'refused'; canAskAgain: boolean }
  /** This build has no camera module, or it failed to start. */
  | { kind: 'missing' };

/**
 * Reads one QR code, for the screens that pair a phone or join a shop. It asks for the camera itself, as the
 * barcode scanner beside it does, and it loads the camera module only when it is shown, so an app that never
 * shows it does not need the module to start.
 */
export function QrScanner({ onScanned, onCancel }: QrScannerProps) {
  const [access, setAccess] = useState<Access>({ kind: 'checking' });
  // The camera keeps reporting the same code until the screen changes; only the first one counts.
  const done = useRef(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const kit = (await import('expo-camera')) as unknown as CameraKit;
        let permission = await kit.Camera.getCameraPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await kit.Camera.requestCameraPermissionsAsync();
        }
        if (!alive) return;
        setAccess(
          permission.granted
            ? { kind: 'ready', CameraView: kit.CameraView }
            : { kind: 'refused', canAskAgain: permission.canAskAgain }
        );
      } catch {
        if (alive) setAccess({ kind: 'missing' });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const read = useCallback(
    (result: { data?: unknown }) => {
      if (done.current || typeof result.data !== 'string' || result.data.length === 0) return;
      done.current = true;
      onScanned(result.data);
    },
    [onScanned]
  );

  if (access.kind === 'ready') {
    const { CameraView } = access;
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={read}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.hint}>Point the camera at the QR code your manager made for this phone.</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.buttonText}>Type the code instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const message = describeCameraAccess(access);

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {message}
        </Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={onCancel} accessibilityRole="button">
        <Text style={styles.buttonText}>{access.kind === 'checking' ? 'Cancel' : 'Type the code instead'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 24 },
  frame: { width: 240, height: 240, borderWidth: 2, borderColor: '#28a745', borderRadius: 12 },
  hint: { color: '#fff', textAlign: 'center', marginTop: 24, fontSize: 16 },
  button: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
