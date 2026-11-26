import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import type { TabsParamList } from './AppNavigator';

/** Root tab navigator — used when a screen must open another tab (e.g. Sales → Basket). */
export const rootNav = createNavigationContainerRef<TabsParamList>();

/** Open a screen inside another tab, even from a nested stack. */
export function openTab(tab: keyof TabsParamList, screen: string, params?: object): void {
  if (!rootNav.isReady()) return;
  rootNav.dispatch(
    CommonActions.navigate({
      name: tab,
      params: params ? { screen, params } : { screen },
    })
  );
}
