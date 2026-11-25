import { Share } from 'react-native';
import { useAuthStore } from '@kiosk/staff';
import { exportOutbox } from '@kiosk/offline';
import { confirmExport } from './confirm-export';

/** Hands the sales that were never sent to the share sheet, as text the person can keep or send to support. */
export async function exportUnsent(): Promise<void> {
  // The copy can be sent to any app on the phone, so the person is told what it holds first.
  if (!(await confirmExport())) return;
  const text = await exportOutbox(useAuthStore.getState().tenant?.businessId);
  await Share.share({ title: 'Unsent sales', message: text });
}
