import {
  readTenantSecret,
  readTenantValue,
  removeTenantSecret,
  removeTenantValue,
  writeTenantSecret,
  writeTenantValue,
} from '@kiosk/core';
import { toKenyanLocal07 } from './phone';

export type ShopperProfile = {
  name: string;
  email: string;
  phone: string;
  shipping: string;
};

// Kept per store by @kiosk/core: a profile or device secret saved in one store is never read in another.

export async function loadShopperProfile(): Promise<ShopperProfile | null> {
  try {
    const raw = await readTenantValue('profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopperProfile;
    if (!parsed?.email || !parsed?.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveShopperProfile(profile: ShopperProfile): Promise<void> {
  const phone = toKenyanLocal07(profile.phone) || profile.phone.trim();
  await writeTenantValue(
    'profile',
    JSON.stringify({
      name: profile.name.trim(),
      email: profile.email.trim().toLowerCase(),
      phone,
      shipping: profile.shipping.trim(),
    } satisfies ShopperProfile)
  );
}

export async function clearShopperProfile(): Promise<void> {
  await removeTenantValue('profile');
}

export async function saveDeviceSecret(secret: string): Promise<void> {
  await writeTenantSecret('deviceSecret', secret);
}

export async function loadDeviceSecret(): Promise<string | null> {
  return readTenantSecret('deviceSecret');
}

export async function clearDeviceSecret(): Promise<void> {
  await removeTenantSecret('deviceSecret');
}

export function randomDeviceSecret(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 18; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
