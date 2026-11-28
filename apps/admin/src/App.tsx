import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DM_SANS, StaffShell, type StaffSession } from '@kiosk/staff';
import { setupNotifications } from '@kiosk/notifications';
import { OwnerNavigator } from './navigation/OwnerNavigator';
import { API_BASE_URL } from './lib/config';
import { MART } from './theme/mart';

/** The admin screens, and the notification setup that needs a signed-in session. */
function Admin({ session }: { session: StaffSession }) {
  const { api } = session;

  useEffect(() => {
    void setupNotifications(api);
  }, [api]);

  return <OwnerNavigator session={session} />;
}

// No camera module ships in this app yet, so a pairing code is typed here, not scanned.
export function App() {
  // The typeface is bundled, so this resolves in a frame or two. If it ever fails the app still
  // opens, in the system face.
  const [fontsLoaded, fontsError] = useFonts({
    ...DM_SANS,
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!fontsLoaded && !fontsError) {
    return <View style={{ flex: 1, backgroundColor: MART.paper }} />;
  }

  return (
    <StaffShell app="admin" baseURL={API_BASE_URL} allowPassword>
      {(session) => <Admin session={session} />}
    </StaffShell>
  );
}
