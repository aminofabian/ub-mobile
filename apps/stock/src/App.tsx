import React from 'react';
import { BarcodeScanner, QrScanner } from '@kiosk/barcode';
import { dropTenantKeepers } from '@kiosk/core';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StaffShell, type PairScannerRenderer, type ScannerRenderer } from '@kiosk/staff';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';
import { CountSenderProvider } from './lib/sender';
import { StockSessionProvider } from './lib/session';

// Drawn only when the person chooses to scan a pairing QR: the camera is asked for then, not at start.
const renderPairScanner: PairScannerRenderer = (props) => <QrScanner {...props} />;

// Drawn only when the person taps Scan on an item or a stock take line.
const renderItemScanner: ScannerRenderer = ({ onBarcode, onClose }) => (
  <BarcodeScanner onBarcode={({ value }) => onBarcode(value)} onClose={onClose} />
);

export function App() {
  return (
    <SafeAreaProvider>
      <StaffShell app="stock" baseURL={API_BASE_URL} renderScanner={renderPairScanner} onRemoved={(shopId) => dropTenantKeepers(shopId)}>
      {(session) => (
        <StockSessionProvider session={session} renderScanner={renderItemScanner}>
          <CountSenderProvider>
            <AppNavigator />
          </CountSenderProvider>
        </StockSessionProvider>
      )}
      </StaffShell>
    </SafeAreaProvider>
  );
}
