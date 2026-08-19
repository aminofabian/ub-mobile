import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { toKenyanLocal07 } from './phone';

export type ShopperProfile = {
  name: string;
  email: string;
  phone: string;
  shipping: string;
};

const PROFILE_KEY = 'palmart.shopper.profile';
const SECRET_KEY = 'palmart.shopper.deviceSecret';

export async function loadShopperProfile(): Promise<ShopperProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
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
  await AsyncStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      name: profile.name.trim(),
      email: profile.email.trim().toLowerCase(),
      phone,
      shipping: profile.shipping.trim(),
    } satisfies ShopperProfile)
  );
}

export async function clearShopperProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}

export async function saveDeviceSecret(secret: string): Promise<void> {
  await SecureStore.setItemAsync(SECRET_KEY, secret);
}

export async function loadDeviceSecret(): Promise<string | null> {
  return SecureStore.getItemAsync(SECRET_KEY);
}

export async function clearDeviceSecret(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY);
}

export function randomDeviceSecret(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 18; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
