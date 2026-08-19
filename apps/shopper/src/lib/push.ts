import { createApiClient, loadTenant } from '@kiosk/core';
import { setupNotifications } from '@kiosk/notifications';
import { API_BASE_URL } from './config';

/**
 * KPLC depletion alerts are timed and sent by the backend (daily sweep, two days
 * and one day before the estimated run-out). The app's only job is to hand the
 * server a device token, so nothing here schedules or times notifications.
 *
 * Registration needs the signed-in session, because the device-token endpoint is
 * authenticated. Shoppers who never sign in still get the SMS reminder, which is
 * keyed off their tab phone number instead.
 */
let registered = false;
let presentationReady = false;

/**
 * Without this, a reminder that lands while the shopper has the app open is
 * delivered silently and they miss it. Android also hides the drop-down banner
 * unless a sound is allowed, hence `shouldPlaySound`.
 */
async function allowForegroundBanners(): Promise<void> {
  if (presentationReady) return;
  presentationReady = true;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    const { Platform } = await import('react-native');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Token reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#164715',
      });
    }
  } catch {
    presentationReady = false;
  }
}

export async function registerForDepletionAlerts(): Promise<void> {
  if (registered) return;

  try {
    await allowForegroundBanners();

    const api = createApiClient({
      baseURL: API_BASE_URL,
      getTenant: () => loadTenant(),
    });
    // Resolves to null when the OS denies permission or the native module is
    // missing, in which case there is nothing to register and SMS still covers us.
    const token = await setupNotifications(api);
    registered = token !== null;
  } catch {
    // Never surface this: reminders are a background nicety, not a task the
    // shopper started, and the server-side SMS path is unaffected.
  }
}

export function forgetDepletionAlertRegistration(): void {
  registered = false;
}
