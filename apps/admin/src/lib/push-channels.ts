import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Android channels the server addresses by id. Creating one twice changes nothing. */
const CHANNELS = [
  { id: 'shop-shift', name: 'Shifts', color: '#2f7a21' },
  { id: 'shop-money', name: 'Sales', color: '#F08A24' },
  { id: 'shop-supply', name: 'Supplies', color: '#0b5cab' },
  { id: 'shop-order', name: 'Web orders', color: '#0b5cab' },
  { id: 'shop-alert', name: 'Needs a look', color: '#b42318' },
  { id: 'shop', name: 'Shop', color: '#F08A24' },
] as const;

export async function ensurePushChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Promise.all(
      CHANNELS.map((channel) =>
        Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 80],
          lightColor: channel.color,
          sound: 'default',
        }),
      ),
    );
  } catch {
    // A phone that cannot open a channel still receives the notice on the default one.
  }
}
