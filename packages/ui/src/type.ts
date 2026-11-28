import { Platform, type TextStyle } from 'react-native';

/**
 * Same system face as `@kiosk/staff` — SF Pro / Roboto — so leftover Banner/Row/Text screens match.
 * Weight is stated beside the family so Android can express it.
 */
const SYSTEM_FACE = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string;

/**
 * The UI voice, mutable so an app can wear its own face. `@kiosk/staff`'s `setUiTypeface` calls `setUiFont` here as
 * well, so one switch at start-up changes both the shared components and the plain ones.
 */
/**
 * The UI voice. DM Sans while the Sande More files are the unlicensed demo build (it watermarks every heading); the four
 * `SandeMore_*` families stay loaded in the shell, so switching back is this table alone.
 */
/**
 * The UI voice: **Sande More**, as asked. Note the files supplied are the DEMO cut, which prints a small "DEMO" glyph
 * after each heading — the licensed build replaces them file for file, with no code change.
 */
export const FONT = {
  regular: 'SandeMore_400Regular',
  medium: 'SandeMore_500Medium',
  semibold: 'SandeMore_500Medium',
  bold: 'SandeMore_700Bold',
  black: 'SandeMore_800ExtraBold',
};

export function setUiFont(family: { regular: string; medium: string; semibold: string; bold: string; black: string }): void {
  FONT.regular = family.regular;
  FONT.medium = family.medium;
  FONT.semibold = family.semibold;
  FONT.bold = family.bold;
  FONT.black = family.black;
}

export function resetUiFont(): void {
  setUiFont({ regular: SYSTEM_FACE, medium: SYSTEM_FACE, semibold: SYSTEM_FACE, bold: SYSTEM_FACE, black: SYSTEM_FACE });
}

/**
 * The weights, as plain strings rather than `TextStyle['fontWeight']`: a navigator's header style asks for `string`, and
 * the wider union (which admits numbers) is refused there. These five values satisfy both.
 */
export const WEIGHT: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'black', '400' | '500' | '600' | '700' | '800'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '800',
};
