import { readTenantValue, removeTenantValue, writeTenantValue } from '@kiosk/core';
import { toKenyanLocal07 } from './phone';

// Kept per store by @kiosk/core: a number remembered in one store is not offered in another.
const TAB_PHONE_KEY = 'tabPhone';
const RECIPIENT_KEY = 'airtimeRecipient';
const PAYER_KEY = 'airtimePayer';

type Field = typeof TAB_PHONE_KEY | typeof RECIPIENT_KEY | typeof PAYER_KEY;

async function read(field: Field): Promise<string | null> {
  try {
    const value = await readTenantValue(field);
    return value?.trim() || null;
  } catch {
    return null;
  }
}

async function write(field: Field, value: string | null) {
  try {
    if (!value?.trim()) {
      await removeTenantValue(field);
      return;
    }
    const local = toKenyanLocal07(value) || value.trim();
    await writeTenantValue(field, local);
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
