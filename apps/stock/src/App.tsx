import React from 'react';
import { QrScanner } from '@kiosk/barcode';
import { StaffShell, type PairScannerRenderer } from '@kiosk/staff';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';

// Drawn only when the person chooses to scan a pairing QR: the camera is asked for then, not at start.
const renderScanner: PairScannerRenderer = (props) => <QrScanner {...props} />;

export function App() {
  return (
    <StaffShell app="stock" baseURL={API_BASE_URL} renderScanner={renderScanner}>
      {({ api, branchId, signOut }) => (
        <AppNavigator api={api} branchId={branchId} onLogout={() => void signOut()} />
      )}
    </StaffShell>
  );
}
