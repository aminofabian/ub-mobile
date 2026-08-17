import React, { useCallback, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';

export interface BarcodeResult {
  value: string;
  format: string;
}

export interface BarcodeScannerProps {
  onBarcode: (result: BarcodeResult) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function BarcodeScanner({ onBarcode, onError, onClose }: BarcodeScannerProps) {
  const [CameraView, setCameraView] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);

  React.useEffect(() => {
    import('expo-camera')
      .then((mod) =>
        setCameraView(() => mod.CameraView as unknown as React.ComponentType<Record<string, unknown>>)
      )
      .catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
  }, [onError]);

  const handleScan = useCallback(
    (result: { data: string; type: string }) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );

  if (!CameraView) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
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
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  hint: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 48,
  },
});
