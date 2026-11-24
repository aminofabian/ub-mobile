/** The longest message a WhatsApp link carries. The server's own reminders are shorter; this only stops a runaway string. */
const MAX_TEXT = 700;

/**
 * What a phone can dial: digits and a leading plus, 6 to 15 of them, once spaces, dots, brackets and dashes are taken
 * out. Digits are never pulled out of words ("0712345678 ext 12" is not a number anyone has), so anything else is null.
 */
export function dialable(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{6,15}$/.test(stripped) ? stripped : null;
}

/**
 * `tel:` link for a number, or null when it cannot be dialled. A Kenyan number is dialled with its country code (+254…)
 * however it was written, so it rings from a phone that is abroad too. The server keeps customers' numbers as digits
 * only, so "+254712345678" comes back as "254712345678" and needs its plus again to be dialled.
 */
export function callUrl(raw: unknown): string | null {
  const number = dialable(raw);
  if (number === null) return null;
  const international = whatsappNumber(number);
  return international === null ? `tel:${number}` : `tel:+${international}`;
}

/**
 * A number the way WhatsApp's link wants it: the whole international number, digits only. A Kenyan number written
 * locally (0712 345 678, 0112…, 712345678) gets 254 in front. A number that is not Kenyan has to be written with its
 * country (+ or 00); one that is not clear is null, because a message to the wrong country is worse than no link.
 */
export function whatsappNumber(raw: unknown): string | null {
  const number = dialable(raw);
  if (number === null) return null;
  const international = /^[1-9]\d{7,14}$/;
  if (number.startsWith('+')) {
    const rest = number.slice(1);
    return international.test(rest) ? rest : null;
  }
  if (number.startsWith('00')) {
    const rest = number.slice(2);
    return international.test(rest) ? rest : null;
  }
  if (/^0[17]\d{8}$/.test(number)) return `254${number.slice(1)}`;
  if (/^[17]\d{8}$/.test(number)) return `254${number}`;
  if (/^254[17]\d{8}$/.test(number)) return number;
  return null;
}

/** A `https://wa.me/…` link that opens a chat with this number and a message ready to send. Null when there is no usable number. */
export function whatsappUrl(raw: unknown, message: string): string | null {
  const number = whatsappNumber(raw);
  if (number === null) return null;
  const text = message.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT);
  return text ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : `https://wa.me/${number}`;
}

/**
 * What to ask the server's customer search for when the owner types a number. The server keeps phone numbers as digits
 * only, in whatever form they were saved ("0712 345 678" is kept as 0712345678 and "+254712345678" as 254712345678),
 * and finds a customer when the digits asked for sit somewhere inside theirs. The same customer written the two ways
 * shares only the digits after the 0 or the 254, so those are what is asked for. Null when what was typed is not a
 * number (a name is searched as it is typed), and the digits as typed when too few are left to be worth narrowing.
 */
export function phoneSearchDigits(raw: string): string | null {
  const stripped = raw.trim().replace(/[\s().-]/g, '');
  if (!/^\+?\d{3,}$/.test(stripped)) return null;
  const typed = stripped.replace(/^\+/, '');
  const digits = typed.startsWith('00') ? typed.slice(2) : typed;
  const tail = digits.startsWith('254') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return tail.length >= 3 ? tail : typed;
}
