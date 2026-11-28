/**
 * What checkout keeps on the phone for one shop: the address book, the shop's facts from its last answer,
 * and the form as the shopper left it. Reading and writing only; what the stored text means is in the
 * tested files (`saved-addresses.ts`, `checkout-facts.ts`, `checkout-form.ts`). Nothing here throws: a
 * phone that cannot read or write its storage has a form with nothing remembered, not a form that fails.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseFacts, type CheckoutFacts } from './checkout-facts';
import { parseDraft, serializeDraft, type CheckoutValues } from './checkout-form';
import { emptyBook, parseAddressBook, serializeAddressBook, type AddressBook } from './saved-addresses';
import { addressBookKey, checkoutDraftKey, checkoutFactsKey } from './shop-storage';

export async function loadAddressBook(slug: string): Promise<AddressBook> {
  try {
    return parseAddressBook(await AsyncStorage.getItem(addressBookKey(slug)));
  } catch {
    return emptyBook();
  }
}

export async function saveAddressBook(slug: string, book: AddressBook): Promise<void> {
  try {
    await AsyncStorage.setItem(addressBookKey(slug), serializeAddressBook(book));
  } catch {
    // Not remembering is not failing.
  }
}

export async function loadFacts(slug: string): Promise<CheckoutFacts | null> {
  try {
    return parseFacts(await AsyncStorage.getItem(checkoutFactsKey(slug)));
  } catch {
    return null;
  }
}

export async function saveFacts(slug: string, facts: CheckoutFacts): Promise<void> {
  try {
    await AsyncStorage.setItem(checkoutFactsKey(slug), JSON.stringify(facts));
  } catch {
    // The shop will be asked again.
  }
}

export async function loadDraft(slug: string, now: Date): Promise<CheckoutValues | null> {
  try {
    const raw = await AsyncStorage.getItem(checkoutDraftKey(slug));
    const draft = parseDraft(raw, now);
    // A draft too old or too damaged to be used is of no use to anyone, so it is not kept on the phone.
    if (raw && !draft) await AsyncStorage.removeItem(checkoutDraftKey(slug)).catch(() => undefined);
    return draft;
  } catch {
    return null;
  }
}

export async function saveDraft(slug: string, values: CheckoutValues, now: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(checkoutDraftKey(slug), serializeDraft(values, now));
  } catch {
    // A form that could not be kept is typed again.
  }
}

export async function clearDraft(slug: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(checkoutDraftKey(slug));
  } catch {
    // Nothing to do.
  }
}
