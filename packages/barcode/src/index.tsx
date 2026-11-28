import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { describeCameraAccess } from './camera-copy';

export interface BarcodeResult {
  value: string;
  format: string;
}

export interface BarcodeScannerProps {
  onBarcode: (result: BarcodeResult) => void;
  /** Called when the camera module could not be loaded. The scanner says so on its own screen as well, so a caller that wants that read leaves this out. */
  onError?: (error: Error) => void;
  onClose?: () => void;
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
 * Reads barcodes for as long as it is shown. It asks for the camera itself the first time, and says what to do when the
 * answer is no. It loads the camera module only when it is shown, so an app that never shows it does not need the module
 * to start.
 */
export function BarcodeScanner({ onBarcode, onError, onClose }: BarcodeScannerProps) {
  const [access, setAccess] = useState<Access>({ kind: 'checking' });
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  // Read when the camera fails to load, and not part of what opens it: a caller that makes a new function on every
  // render must not have the camera opened, and asked for, again.
  const failed = useRef(onError);
  useEffect(() => {
    failed.current = onError;
  }, [onError]);

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
      } catch (e) {
        if (!alive) return;
        setAccess({ kind: 'missing' });
        failed.current?.(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleScan = useCallback(
    (result: { data: string; type: string }) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );

  if (access.kind !== 'ready') {
    return (
      <View style={styles.container}>
        <View style={styles.note}>
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {describeCameraAccess(access, 'Scan')}
          </Text>
        </View>
        {onClose ? (
          <TouchableOpacity style={[styles.button, styles.alone]} onPress={onClose} accessibilityRole="button">
            <Text style={styles.buttonText}>{access.kind === 'checking' ? 'Cancel' : 'Close'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  const { CameraView } = access;
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={handleScan}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.buttonText}>{torch ? 'Torch Off' : 'Torch On'}</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  note: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: '#28a745',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  alone: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  hint: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

export { QrScanner, type QrScannerProps } from './qr-scanner';
