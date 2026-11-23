import { Alert } from 'react-native';
import { getUnsentSummary, switchStore, type UnsentSummary } from '@kiosk/core';

export function describeUnsent(unsent: UnsentSummary): string {
  const sales = `${unsent.total} unsent ${unsent.total === 1 ? 'sale' : 'sales'}`;
  const stuck = unsent.needsAttention;
  return stuck > 0 ? `${sales} (${stuck} ${stuck === 1 ? 'needs' : 'need'} attention)` : sales;
}

/**
 * Asks whether to go ahead when the store being left still holds sales that were never sent. They
 * stay on the phone, in that store's own queue, and are sent the next time the person signs in to it.
 */
export function confirmLeavingUnsent(unsent: UnsentSummary, storeName?: string): Promise<boolean> {
  const name = storeName?.trim() || undefined;
  return new Promise((resolve) => {
    Alert.alert(
      'Sales not sent yet',
      `${name ?? 'This store'} has ${describeUnsent(unsent)}. They stay on this phone and are sent the next time you sign in to ${name ?? 'it'}. Switch anyway?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Switch anyway', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Asks whether to sign out while the shop still holds sales that were never sent. Whoever signs in next on this
 * phone sends them, and the server records a sale for the person whose session sent it, in that person's shift.
 */
export function confirmSigningOutWithUnsent(unsent: UnsentSummary, storeName?: string): Promise<boolean> {
  const name = storeName?.trim() || undefined;
  return new Promise((resolve) => {
    Alert.alert(
      'Sales not sent yet',
      `${name ?? 'This store'} has ${describeUnsent(unsent)}. Whoever signs in next on this phone sends them, under their own name and shift. Sign out anyway?`,
      [
        { text: 'Stay signed in', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign out anyway', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Whether to go ahead and sign out: nothing is asked when nothing is waiting to be sent. */
export async function confirmSignOut(storeName?: string): Promise<boolean> {
  const unsent = await getUnsentSummary();
  if (unsent.total === 0) {
    return true;
  }
  return confirmSigningOutWithUnsent(unsent, storeName);
}

/** Leaves the active store for the store picker. Returns whether the person actually left. */
export async function leaveStore(storeName?: string): Promise<boolean> {
  const first = await switchStore(null);
  if (first.kind === 'switched') {
    return true;
  }
  if (!(await confirmLeavingUnsent(first.unsent, storeName))) {
    return false;
  }
  return (await switchStore(null, { keepUnsent: true })).kind === 'switched';
}
