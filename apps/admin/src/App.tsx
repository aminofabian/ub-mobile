import React, { useEffect } from 'react';
import { StaffShell, type StaffSession } from '@kiosk/staff';
import { setupNotifications } from '@kiosk/notifications';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';

/** The admin screens, and the notification setup that needs a signed-in session. */
function Admin({ session }: { session: StaffSession }) {
  const { api, branchId, signOut } = session;

  useEffect(() => {
    void setupNotifications(api);
  }, [api]);

  return <AppNavigator api={api} branchId={branchId} onLogout={() => void signOut()} />;
}

// No camera module ships in this app yet, so a pairing code is typed here, not scanned.
export function App() {
  return (
    <StaffShell app="admin" baseURL={API_BASE_URL} allowPassword>
      {(session) => <Admin session={session} />}
    </StaffShell>
  );
}
