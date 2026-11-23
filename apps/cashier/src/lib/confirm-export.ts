import { Alert } from 'react-native';

export const EXPORT_QUESTION = 'Share unsent sales?';

/** What the copy holds and who it is for. It goes to a share sheet, which can send it to any app on the phone. */
export const EXPORT_WARNING =
  'This makes a text copy of the sales saved on this phone that were not sent: what was sold, how it was paid and any M-Pesa codes. Share it only with your manager or Kiosk support.';

/** Asks before the copy is made. Backing out of the question is "no". */
export function confirmExport(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      EXPORT_QUESTION,
      EXPORT_WARNING,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Share', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
