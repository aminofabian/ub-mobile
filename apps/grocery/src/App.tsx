import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BarcodeScanner, QrScanner } from '@kiosk/barcode';
import { dropTenantKeepers } from '@kiosk/core';
import { MART, StaffShell, setUiFace, type PairScannerRenderer, type ScannerRenderer } from '@kiosk/staff';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';
import { ForwardSenderProvider } from './lib/sender';
import { GrocerySessionProvider } from './lib/session';

/** Registered family names for San de More Demo — one file per weight. */
const SANDE = {
  regular: 'SandeMoreDemo-Regular',
  medium: 'SandeMoreDemo-Medium',
  semibold: 'SandeMoreDemo-SemiBold',
  bold: 'SandeMoreDemo-Bold',
  black: 'SandeMoreDemo-ExtraBold',
} as const;

// Drawn only when the person chooses to scan a pairing QR: the camera is asked for then, not at start.
const renderPairScanner: PairScannerRenderer = (props) => <QrScanner {...props} />;

// Drawn only when the person taps Scan at the counter or on a stock screen.
const renderItemScanner: ScannerRenderer = ({ onBarcode, onClose }) => (
  <BarcodeScanner onBarcode={({ value }) => onBarcode(value)} onClose={onClose} />
);

export function App() {
  const [fontsLoaded, fontsError] = useFonts({
    [SANDE.regular]: require('../san-de-more-demo/SandeMoreDemo-Regular.otf'),
    [SANDE.medium]: require('../san-de-more-demo/SandeMoreDemo-Medium.otf'),
    [SANDE.semibold]: require('../san-de-more-demo/SandeMoreDemo-SemiBold.otf'),
    [SANDE.bold]: require('../san-de-more-demo/SandeMoreDemo-Bold.otf'),
    [SANDE.black]: require('../san-de-more-demo/SandeMoreDemo-ExtraBold.otf'),
  });
  // Mutate before StaffShell paints so MartText / Banner pick San de More on the first frame.
  if (fontsLoaded) setUiFace(SANDE);

  if (!fontsLoaded && !fontsError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper }}>
        <ActivityIndicator color={MART.fallbackPrimary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StaffShell app="grocery" baseURL={API_BASE_URL} renderScanner={renderPairScanner} onRemoved={(shopId) => dropTenantKeepers(shopId)}>
        {(session) => (
          <GrocerySessionProvider session={session} renderScanner={renderItemScanner}>
            <ForwardSenderProvider>
              <AppNavigator />
            </ForwardSenderProvider>
          </GrocerySessionProvider>
        )}
      </StaffShell>
    </SafeAreaProvider>
  );
}
