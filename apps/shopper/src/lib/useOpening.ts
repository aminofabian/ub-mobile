import { useSyncExternalStore } from 'react';
import { openGate } from './open-gate';

/** True while a shop is being opened anywhere in the app. Controls that would start another are off meanwhile. */
export function useOpening(): boolean {
  return useSyncExternalStore(openGate.subscribe, openGate.isBusy);
}
