/**
 * The counter's own palette, taken from the reference: a warm paper ground, an amber accent that belongs to food, and
 * near-black ink. The till stays green and parchment — this is the shop floor, not the checkout desk.
 */
export const AMBER = {
  /** The accent: buttons, the active tab, the rule under the department in use. */
  primary: '#F08A24',
  primaryDeep: '#D97515',
  /** A wash of the accent, for chips, tints and the selected department. */
  wash: '#FDF1E3',
  washStrong: '#FBE3C8',
  /** The page and the cards that sit on it. */
  page: '#FBF7F1',
  card: '#FFFFFF',
  cardSunken: '#F6F1E8',
  ink: '#17130D',
  inkMuted: '#6B6357',
  inkQuiet: '#9C9384',
  line: '#EDE6DA',
  lineStrong: '#DCD2C2',
  success: '#1F7A44',
  successWash: '#E6F3E9',
  danger: '#C4402A',
  dangerWash: '#FBEAE6',
} as const;
