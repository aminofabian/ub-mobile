import AsyncStorage from '@react-native-async-storage/async-storage';
import { toKenyanLocal07 } from './phone';

const TAB_PHONE_KEY = 'palmart.customer.tabPhone';
const RECIPIENT_KEY = 'palmart.customer.lastAirtimeRecipient';
const PAYER_KEY = 'palmart.customer.lastAirtimePayer';

async function read(key: string): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

async function write(key: string, value: string | null) {
  try {
    if (!value?.trim()) {
      await AsyncStorage.removeItem(key);
      return;
    }
    const local = toKenyanLocal07(value) || value.trim();
    await AsyncStorage.setItem(key, local);
  } catch {
    /* ignore */
  }
}

export async function loadTabPhone(): Promise<string | null> {
  return read(TAB_PHONE_KEY);
}

export async function saveTabPhone(phone: string | null): Promise<void> {
  return write(TAB_PHONE_KEY, phone);
}

export async function loadAirtimePhones(): Promise<{ recipient: string | null; payer: string | null }> {
  const [recipient, payer] = await Promise.all([read(RECIPIENT_KEY), read(PAYER_KEY)]);
  return { recipient, payer };
}

export async function saveAirtimePhones(recipient: string, payer: string): Promise<void> {
  await Promise.all([write(RECIPIENT_KEY, recipient), write(PAYER_KEY, payer)]);
}
