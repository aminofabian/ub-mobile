/**
 * The checkout form: what is asked, what is checked, and what is sent.
 *
 * It follows the website's checkout (`shop-checkout-form.tsx`) so the shop gets the same order from either:
 * a name, a Kenyan mobile, an optional email and WhatsApp number, an area from the shop's list, the exact
 * place, delivery notes, and how the shopper will pay. The line of notes is the website's (see
 * `checkout-notes.ts`).
 *
 * What differs, on purpose, and why:
 * - The app also takes a pickup, which the website has no way to place. It is the only order a shop with no
 *   delivery areas can take.
 * - One "name" field, split into first and last for the server's contact step. A single word is a name the
 *   order accepts and the contact step does not, so that step is left out for it.
 * - The server's contact step insists on an email although the website labels it optional. Without one the
 *   order is still placed; only the server's own check of the area and its copy of the details are missed.
 *
 * Imports only other pure files, so node can run this file's test directly.
 */
import { buildOrderNotes, notesFit, type OrderNoteFields } from './checkout-notes';
import { joinCheckoutPhone, KENYA_DIAL_CODE, toMsisdn254 } from './checkout-phone';
import { matchArea, type Fulfilment } from './delivery-areas';
import { looksLikeKenyanMobile } from './phone';
import type { SavedAddress, SavedContact } from './saved-addresses';

export const DEFAULT_COUNTY = 'Nairobi';

/** The server's rule for an email, as it writes it (`ShopperCheckoutStateService.EMAIL`). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PaymentChoice = 'mpesa' | 'pay-later';

export interface CheckoutValues {
  fulfilment: Fulfilment;
  name: string;
  phone: string;
  email: string;
  whatsApp: string;
  area: string;
  street: string;
  county: string;
  deliveryNotes: string;
  /** Keep these details (and this address) on the phone, and tell the shop to keep them too. */
  remember: boolean;
  payment: PaymentChoice;
  /** The shopper has picked a way to pay; until then the shop's own preference applies. */
  paymentTouched: boolean;
}

export function blankValues(initial: Fulfilment, remember: boolean): CheckoutValues {
  return {
    fulfilment: initial,
    name: '',
    phone: '',
    email: '',
    whatsApp: '',
    area: '',
    street: '',
    county: DEFAULT_COUNTY,
    deliveryNotes: '',
    remember,
    payment: 'mpesa',
    paymentTouched: false,
  };
}

/**
 * Signed-in shoppers joined to be known, so their details are kept unless they say no. A guest is asked to
 * opt in, as on the website, where "set as default address" starts unticked.
 */
export function rememberByDefault(signedIn: boolean): boolean {
  return signedIn;
}

/**
 * The way to pay, as the website settles it: M-Pesa while the shop takes it online and the shopper has not
 * chosen otherwise; with no online payment, pay on delivery. While it is not known whether the shop takes
 * M-Pesa online, the shopper's own choice stands.
 */
export function resolvePaymentChoice(input: {
  hasOnlinePay: boolean | null;
  touched: boolean;
  choice: PaymentChoice;
}): PaymentChoice {
  if (input.hasOnlinePay === null) return input.choice;
  if (!input.hasOnlinePay) return 'pay-later';
  return input.touched ? input.choice : 'mpesa';
}

export type FieldKey = 'name' | 'phone' | 'email' | 'whatsApp' | 'area' | 'street' | 'deliveryNotes' | 'form';
export type CheckoutErrors = Partial<Record<FieldKey, string>>;

export interface ShopFacts {
  /** The areas the shop delivers to, or null when they are not known. */
  areaNames: string[] | null;
  /** Whether the shop takes M-Pesa online, or null when not known. */
  hasOnlinePay: boolean | null;
}

/** The place name to send: the shop's own spelling when the area is on its list. */
function canonicalArea(values: CheckoutValues, shop: ShopFacts): string {
  return (shop.areaNames ? matchArea(shop.areaNames, values.area) : null) ?? values.area.trim();
}

function noteFields(values: CheckoutValues, shop: ShopFacts, payment: PaymentChoice): OrderNoteFields {
  const delivery = values.fulfilment === 'delivery';
  const area = canonicalArea(values, shop);
  return {
    pickup: !delivery,
    payLater: payment === 'pay-later',
    street: delivery ? values.street : undefined,
    county: delivery ? values.county || DEFAULT_COUNTY : undefined,
    subCounty: delivery ? area : undefined,
    ward: delivery ? area : undefined,
    whatsApp: values.whatsApp,
    setAsDefault: delivery && values.remember,
    deliveryNotes: values.deliveryNotes,
  };
}

/**
 * What the server's contact step takes for each of the first name and the rest. The order takes 255 for the
 * whole, which can never be reached first: 120, a space and 120 is 241.
 */
export const MAX_CONTACT_NAME_PART = 120;

function tooLongForContactStep(name: string): boolean {
  const { firstName, lastName } = splitName(name);
  return firstName.length > MAX_CONTACT_NAME_PART || lastName.length > MAX_CONTACT_NAME_PART;
}

export function checkCheckoutValues(values: CheckoutValues, shop: ShopFacts): CheckoutErrors {
  const errors: CheckoutErrors = {};

  const name = values.name.trim();
  if (!name) errors.name = 'Add your name so the shop knows who to call.';
  else if (name.length < 2) errors.name = 'That name looks too short.';
  else if (tooLongForContactStep(name)) errors.name = 'That name is too long.';

  const phone = values.phone.trim();
  if (!phone) errors.phone = 'We need a phone number to reach you.';
  else if (!looksLikeKenyanMobile(phone)) errors.phone = 'Enter a Kenyan mobile, e.g. 0712 345 678.';

  const email = values.email.trim();
  if (email && (email.length > 255 || !EMAIL.test(email))) {
    errors.email = 'That email does not look right. Fix it, or leave it empty.';
  }

  if (values.whatsApp.trim().length > 64) errors.whatsApp = 'That WhatsApp number is too long.';

  if (values.fulfilment === 'delivery') {
    if (shop.areaNames === null) {
      errors.area = 'The shop\'s delivery areas have not loaded. Check your connection, or choose pickup.';
    } else if (shop.areaNames.length === 0) {
      errors.area = 'This shop does not deliver yet. Choose pickup.';
    } else if (!values.area.trim()) {
      errors.area = 'Choose the area you are in.';
    } else if (matchArea(shop.areaNames, values.area) === null) {
      errors.area = 'The shop does not deliver to that area. Choose one from the list.';
    }
    const street = values.street.trim();
    if (!street) errors.street = 'Add the building, estate or landmark so the rider can find you.';
    else if (street.length > 500) errors.street = 'Shorten this to 500 characters.';
  }

  if (values.deliveryNotes.trim().length > 1000) errors.deliveryNotes = 'Shorten the notes to 1,000 characters.';

  if (Object.keys(errors).length === 0) {
    const payment = resolvePaymentChoice({ hasOnlinePay: shop.hasOnlinePay, touched: values.paymentTouched, choice: values.payment });
    if (!notesFit(buildOrderNotes(noteFields(values, shop, payment)))) {
      errors.form = 'The details are too long for the shop to take. Shorten the address or the notes.';
    }
  }
  return errors;
}

/** First word, and the rest. A name of one word has no last name, which the server's contact step needs. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const words = full.trim().replace(/\s+/g, ' ');
  const at = words.indexOf(' ');
  return at < 0 ? { firstName: words, lastName: '' } : { firstName: words.slice(0, at), lastName: words.slice(at + 1) };
}

/** The body of the checkout call, as the website sends it. */
export interface OrderRequest {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}

/** The body of the server's contact step (`PATCH .../checkout-state/contact`). */
export interface ContactStep {
  firstName: string;
  lastName: string;
  email: string;
  areaCode: string;
  phone: string;
  whatsApp: string;
}

/** The body of the server's delivery step (`PATCH .../checkout-state/delivery`). */
export interface DeliveryStep {
  county: string;
  subCounty: string;
  ward: string;
  streetAddress: string;
  deliveryNotes: string;
  saveForNextTime: boolean;
}

export interface OrderPlan {
  request: OrderRequest;
  /** Null when the server's contact step cannot be made (a pickup, no email, one-word name). */
  contactStep: ContactStep | null;
  /** Null when there is no contact step before it, or the order is a pickup. */
  deliveryStep: DeliveryStep | null;
  payment: PaymentChoice;
  fulfilment: Fulfilment;
  /** What to keep on the phone once the order is placed, if the shopper asked for that. */
  remember: { contact: SavedContact; address: SavedAddressInput | null } | null;
}

export type SavedAddressInput = Pick<SavedAddress, 'area' | 'street' | 'county' | 'deliveryNotes' | 'whatsApp'>;

export type PlanResult = { ok: true; plan: OrderPlan } | { ok: false; errors: CheckoutErrors };

export function planOrder(values: CheckoutValues, shop: ShopFacts): PlanResult {
  const errors = checkCheckoutValues(values, shop);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const payment = resolvePaymentChoice({ hasOnlinePay: shop.hasOnlinePay, touched: values.paymentTouched, choice: values.payment });
  const delivery = values.fulfilment === 'delivery';
  const area = canonicalArea(values, shop);
  const name = values.name.trim().replace(/\s+/g, ' ');
  const email = values.email.trim();
  const notes = buildOrderNotes(noteFields(values, shop, payment));
  const { firstName, lastName } = splitName(name);
  const msisdn = toMsisdn254(values.phone);

  const canStepContact = delivery && email !== '' && lastName !== '' && msisdn !== null;
  const contactStep: ContactStep | null = canStepContact
    ? {
        firstName,
        lastName,
        email,
        areaCode: KENYA_DIAL_CODE,
        phone: (msisdn as string).slice(3),
        whatsApp: values.whatsApp.trim(),
      }
    : null;
  const deliveryStep: DeliveryStep | null =
    contactStep !== null
      ? {
          county: values.county.trim() || DEFAULT_COUNTY,
          subCounty: area,
          ward: area,
          streetAddress: values.street.trim(),
          deliveryNotes: values.deliveryNotes.trim(),
          saveForNextTime: values.remember,
        }
      : null;

  return {
    ok: true,
    plan: {
      request: {
        customerName: name,
        customerPhone: joinCheckoutPhone(KENYA_DIAL_CODE, values.phone),
        customerEmail: email || undefined,
        notes: notes || undefined,
      },
      contactStep,
      deliveryStep,
      payment,
      fulfilment: values.fulfilment,
      remember: values.remember
        ? {
            contact: { name, phone: values.phone.trim(), email, whatsApp: values.whatsApp.trim() },
            address: delivery
              ? {
                  area,
                  street: values.street.trim(),
                  county: values.county.trim() || DEFAULT_COUNTY,
                  deliveryNotes: values.deliveryNotes.trim(),
                  whatsApp: values.whatsApp.trim(),
                }
              : null,
          }
        : null,
    },
  };
}

/** Starts the form from a saved address. The person can change any of it. */
export function applyAddress(values: CheckoutValues, address: SavedAddress): CheckoutValues {
  return {
    ...values,
    fulfilment: 'delivery',
    area: address.area,
    street: address.street,
    county: address.county || DEFAULT_COUNTY,
    deliveryNotes: address.deliveryNotes,
    whatsApp: values.whatsApp || address.whatsApp,
  };
}

/** Starts the form from who the last order was for, filling only what is still empty. */
export function applyContact(values: CheckoutValues, contact: SavedContact | null): CheckoutValues {
  if (!contact) return values;
  return {
    ...values,
    name: values.name || contact.name,
    phone: values.phone || contact.phone,
    email: values.email || contact.email,
    whatsApp: values.whatsApp || contact.whatsApp,
  };
}

/** How long a half-filled form is kept. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface CheckoutDraft {
  values: CheckoutValues;
  savedAt: string;
}

export function serializeDraft(values: CheckoutValues, now: Date): string {
  return JSON.stringify({ values, savedAt: now.toISOString() } satisfies CheckoutDraft);
}

const FULFILMENTS: Fulfilment[] = ['delivery', 'pickup'];
const PAYMENTS: PaymentChoice[] = ['mpesa', 'pay-later'];

/** The form as it was left, if it was left within the day. Damaged data is no draft. */
export function parseDraft(raw: string | null | undefined, now: Date): CheckoutValues | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    const saved = parsed.savedAt ? Date.parse(parsed.savedAt) : Number.NaN;
    const v = parsed.values as Partial<CheckoutValues> | undefined;
    if (!v || Number.isNaN(saved) || now.getTime() - saved > DRAFT_MAX_AGE_MS || saved > now.getTime() + 60_000) return null;
    const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
    return {
      fulfilment: FULFILMENTS.includes(v.fulfilment as Fulfilment) ? (v.fulfilment as Fulfilment) : 'delivery',
      name: str(v.name, 255),
      phone: str(v.phone, 64),
      email: str(v.email, 255),
      whatsApp: str(v.whatsApp, 64),
      area: str(v.area, 120),
      street: str(v.street, 500),
      county: str(v.county, 120) || DEFAULT_COUNTY,
      deliveryNotes: str(v.deliveryNotes, 1000),
      remember: v.remember === true,
      payment: PAYMENTS.includes(v.payment as PaymentChoice) ? (v.payment as PaymentChoice) : 'mpesa',
      paymentTouched: v.paymentTouched === true,
    };
  } catch {
    return null;
  }
}
