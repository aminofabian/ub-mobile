import { Alert } from 'react-native';
import { switchStore, type UnsentSummary } from '@kiosk/core';

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
