import type { ApiClient } from '@kiosk/core';

export interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

export async function requestPushPermissions(): Promise<boolean> {
  try {
    const Notifications = await import('expo-notifications');
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getPushToken(): Promise<PushToken | null> {
  try {
    const granted = await requestPushPermissions();
    if (!granted) return null;

    const Notifications = await import('expo-notifications');
    const Constants = await import('expo-constants');
    const projectId =
      Constants.default.expoConfig?.extra?.eas?.projectId ??
      Constants.default.easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const platform =
      Constants.default.platform?.ios ? 'ios' :
      Constants.default.platform?.android ? 'android' : 'web';

    return { token: tokenResult.data, platform };
  } catch {
    return null;
  }
}

export async function registerPushToken(api: ApiClient, token: PushToken): Promise<void> {
  await api.post('/api/v1/me/device-tokens/fcm', {
    token: token.token,
    platform: token.platform.toUpperCase(),
  });
}

export async function setupNotifications(
  api: ApiClient,
  onNotification?: (data: Record<string, unknown>) => void
): Promise<PushToken | null> {
  const token = await getPushToken();
  if (token) {
    await registerPushToken(api, token);
  }

  if (onNotification) {
    try {
      const Notifications = await import('expo-notifications');
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        onNotification(data);
      });
    } catch {
      // Notifications unavailable
    }
  }

  return token;
}
