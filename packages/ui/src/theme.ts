/**
 * The shared worker-app theme, re-skinned to the "mart" design system (the clean, airy look the Admin
 * app wears). Keys are unchanged so every `@kiosk/ui` consumer — Cashier, Grocery, Stock and the shared
 * sign-in / stock / order screens — picks up the new look without a rewrite. For richer tokens (the type
 * scale, zones, onFill) import from `@kiosk/staff` (`MART`, `TYPE`, `Screen`, `Tile`, `MartButton`).
 */
export const theme = {
  colors: {
    // Amber is the accent only (the primary button, active states), not a fill background.
    primary: '#F08A24',
    primaryDark: '#D97515',
    /** The ground of every screen: the counter's warm cream. */
    background: '#FBF7F1',
    /** Cards and fields: pure white, set apart by a hairline, not a shadow. */
    surface: '#ffffff',
    /** A quiet sunken well: pressed tiles, skeleton bones. */
    surfaceSunken: '#F6F1E8',
    text: '#17130D',
    textMuted: '#6B6357',
    /** Darkest quiet tone that still clears 4.5:1 on the background. */
    textQuiet: '#9C9384',
    /** Hairline dividers and card edges. */
    border: '#EDE6DA',
    borderStrong: '#DCD2C2',
    danger: '#a8281b',
    warning: '#7a5a00',
    success: '#2f6b12',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    // Rounder, in step with mart: capsule controls, soft tiles.
    sm: 10,
    md: 16,
    lg: 22,
    xl: 32,
  },
} as const;

export type Theme = typeof theme;
