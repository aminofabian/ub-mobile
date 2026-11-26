import { Linking } from 'react-native';

/**
 * Asking the owner to register (or restore) this phone as a till.
 *
 * The app cannot make itself a till — only the shop can — so the one thing a cashier needs at that moment is a way
 * to reach the person who can. Two channels, both already on the phone: WhatsApp and email. The message is written
 * for them: the shop, the branch, and what has to happen, so the owner does not have to ask a question first.
 */
export interface TillAsk {
  shopName: string | null;
  branchName: string | null;
  /** What is wrong, in the cashier's words. */
  reason: string;
  /** The owner's number in international form, when the shop has one on file. */
  ownerPhone?: string | null;
}

/** The message the owner receives. Plain, specific, and short enough to read on a lock screen. */
export function tillRequestMessage(ask: TillAsk): string {
  const where = [ask.shopName, ask.branchName].filter(Boolean).join(' · ');
  return [
    `Hello — this phone is not registered as a till${where ? ` at ${where}` : ''}.`,
    `${ask.reason}`,
    'Please register it in Kiosk → Business → Tills, or send me a pairing code so I can add it here.',
  ].join('\n\n');
}

/** A WhatsApp link. Without a number it opens WhatsApp's contact picker with the message already written. */
export function whatsappLink(ask: TillAsk): string {
  const text = encodeURIComponent(tillRequestMessage(ask));
  const digits = (ask.ownerPhone ?? '').replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function emailLink(ask: TillAsk): string {
  const subject = encodeURIComponent(`Register this till${ask.shopName ? ` — ${ask.shopName}` : ''}`);
  const body = encodeURIComponent(tillRequestMessage(ask));
  return `mailto:?subject=${subject}&body=${body}`;
}

/**
 * Opens one of the two. Returns false when the phone has nothing to open it with, so the screen can say so rather
 * than appear to do nothing — which is exactly the failure this flow exists to end.
 */
export async function askOwner(channel: 'whatsapp' | 'email', ask: TillAsk): Promise<boolean> {
  const url = channel === 'whatsapp' ? whatsappLink(ask) : emailLink(ask);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
