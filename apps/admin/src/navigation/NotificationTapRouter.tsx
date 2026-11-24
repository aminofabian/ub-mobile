import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { OwnerTab } from '../lib/owner-access';
import { tapTab } from '../lib/tap-route';
import type { OwnerStackParamList } from './owner-types';

/**
 * The tap that was last acted on, kept outside the component so that signing out and in again (which draws this
 * component again) does not act on the same tap a second time.
 */
let lastActedOn: string | null = null;

/**
 * Opens the part of the app a notification is about when the owner taps it. The server's pushes carry no data yet, so
 * for now every tap opens Today; when they carry a kind, the tab it names opens instead (see `tapTab`), or Today when
 * the person's role does not have that tab.
 *
 * It waits for the navigator to be ready, so a tap that started the app is not lost, and it acts on the default action
 * only (a tap on the notification itself), once per notification. It draws nothing.
 */
export function NotificationTapRouter({
  ready,
  navigationRef,
  tabs,
}: {
  ready: boolean;
  navigationRef: NavigationContainerRefWithCurrent<OwnerStackParamList>;
  tabs: readonly OwnerTab[];
}) {
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!ready || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = `${response.notification.request.identifier}@${response.notification.date}`;
    if (lastActedOn === key) return;
    if (!navigationRef.isReady()) return;
    lastActedOn = key;
    const wanted = tapTab(response.notification.request.content.data);
    // `pop` goes back to the tabs that are already open instead of putting a second set on top of whatever screen was showing.
    navigationRef.navigate('Main', { screen: tabs.includes(wanted) ? wanted : 'Today' }, { pop: true });
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // The tap is remembered above, so it is not acted on twice even where this is missing.
    }
  }, [ready, response, tabs, navigationRef]);

  return null;
}
