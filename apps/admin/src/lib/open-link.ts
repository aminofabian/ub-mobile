import { Alert, Linking } from 'react-native';

/**
 * Opens a link the phone hands to another app (a call, a chat, a web page). A phone that cannot do it, or a link that
 * could not be made, says so and says what to do instead; it never fails silently.
 */
export async function openLink(url: string | null, whenItFails: string): Promise<void> {
  if (url === null) {
    Alert.alert('Cannot open this', whenItFails);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Cannot open this', whenItFails);
  }
}
