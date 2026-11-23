/**
 * What the sign-in form accepts, in one place so the button, the keyboard and the tests agree.
 * The server owns the real rules (a PIN is 4 to 6 digits); this only keeps obviously unfinished or
 * pasted-in text from being sent.
 */

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignInMethod = 'pin' | 'password';

/** Only digits, at most six: a pasted "12 34" or "1234abc" becomes what the PIN field can hold. */
export function cleanPin(text: string): string {
  return text.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH);
}

/** The email as it is sent and remembered: no spaces around it, lower case. */
export function cleanEmail(text: string): string {
  return text.trim().toLowerCase();
}

export function isEmailComplete(text: string): boolean {
  const email = cleanEmail(text);
  return email.length <= 191 && EMAIL_SHAPE.test(email);
}

export function canSubmitSignIn(input: { method: SignInMethod; email: string; pin: string; password: string }): boolean {
  if (!isEmailComplete(input.email)) return false;
  if (input.method === 'pin') {
    return input.pin.length >= PIN_MIN_LENGTH && input.pin.length <= PIN_MAX_LENGTH && /^\d+$/.test(input.pin);
  }
  return input.password.length > 0;
}
