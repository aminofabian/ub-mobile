import * as react_jsx_runtime from 'react/jsx-runtime';
import { ViewStyle, TextStyle, TextProps, TextInputProps } from 'react-native';
import React from 'react';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}
declare function Button({ title, onPress, variant, disabled, style, textStyle }: ButtonProps): react_jsx_runtime.JSX.Element;

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
}
declare function Card({ children, style }: CardProps): react_jsx_runtime.JSX.Element;

interface KioskTextProps extends TextProps {
    variant?: 'h1' | 'h2' | 'body' | 'caption' | 'muted';
    style?: TextStyle;
}
declare function Text({ variant, style, ...props }: KioskTextProps): react_jsx_runtime.JSX.Element;

type BannerTone = 'info' | 'warn' | 'danger' | 'ok';
interface BannerProps {
    tone?: BannerTone;
    children: React.ReactNode;
    style?: ViewStyle;
}
/** A short message above the content: something the person should know, or must do something about. */
declare function Banner({ tone, children, style }: BannerProps): react_jsx_runtime.JSX.Element;

interface FieldProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    /** What is wrong with what was typed, in words. Shown under the box, and the box turns red. */
    error?: string | null;
    hint?: string;
    style?: ViewStyle;
}
/** A box to type in, with its label above and what is wrong with it below. On focus it lifts and its edge brightens. */
declare function Field({ label, error, hint, style, onFocus, onBlur, ...input }: FieldProps): react_jsx_runtime.JSX.Element;

interface RowProps {
    title: string;
    subtitle?: string;
    /** What sits at the right edge: a quantity, a price, a status. */
    right?: string;
    rightTone?: 'normal' | 'warn' | 'danger' | 'ok';
    onPress?: () => void;
    disabled?: boolean;
    style?: ViewStyle;
}
/** One line of a list: a title, a smaller line under it, and a figure at the right. Tappable when it has `onPress`. */
declare function Row({ title, subtitle, right, rightTone, onPress, disabled, style }: RowProps): react_jsx_runtime.JSX.Element;

interface ChipProps {
    label: string;
    selected?: boolean;
    onPress: () => void;
    disabled?: boolean;
    style?: ViewStyle;
}
/** A pill to pick one of a few choices: a filter, a reason, a mode. */
declare function Chip({ label, selected, onPress, disabled, style }: ChipProps): react_jsx_runtime.JSX.Element;

/**
 * The shared worker-app theme, re-skinned to the "mart" design system (the clean, airy look the Admin
 * app wears). Keys are unchanged so every `@kiosk/ui` consumer — Cashier, Grocery, Stock and the shared
 * sign-in / stock / order screens — picks up the new look without a rewrite. For richer tokens (the type
 * scale, zones, onFill) import from `@kiosk/staff` (`MART`, `TYPE`, `Screen`, `Tile`, `MartButton`).
 */
declare const theme: {
    readonly colors: {
        readonly primary: "#F08A24";
        readonly primaryDark: "#D97515";
        /** The ground of every screen: the counter's warm cream. */
        readonly background: "#FBF7F1";
        /** Cards and fields: pure white, set apart by a hairline, not a shadow. */
        readonly surface: "#ffffff";
        /** A quiet sunken well: pressed tiles, skeleton bones. */
        readonly surfaceSunken: "#F6F1E8";
        readonly text: "#17130D";
        readonly textMuted: "#6B6357";
        /** Darkest quiet tone that still clears 4.5:1 on the background. */
        readonly textQuiet: "#9C9384";
        /** Hairline dividers and card edges. */
        readonly border: "#EDE6DA";
        readonly borderStrong: "#DCD2C2";
        readonly danger: "#a8281b";
        readonly warning: "#7a5a00";
        readonly success: "#2f6b12";
    };
    readonly spacing: {
        readonly xs: 4;
        readonly sm: 8;
        readonly md: 16;
        readonly lg: 24;
        readonly xl: 32;
    };
    readonly borderRadius: {
        readonly sm: 10;
        readonly md: 16;
        readonly lg: 22;
        readonly xl: 32;
    };
};
type Theme = typeof theme;

/**
 * The UI voice, mutable so an app can wear its own face. `@kiosk/staff`'s `setUiTypeface` calls `setUiFont` here as
 * well, so one switch at start-up changes both the shared components and the plain ones.
 */
/**
 * The UI voice. DM Sans while the Sande More files are the unlicensed demo build (it watermarks every heading); the four
 * `SandeMore_*` families stay loaded in the shell, so switching back is this table alone.
 */
declare const FONT: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    black: string;
};
declare function setUiFont(family: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    black: string;
}): void;
declare function resetUiFont(): void;
/**
 * The weights, as plain strings rather than `TextStyle['fontWeight']`: a navigator's header style asks for `string`, and
 * the wider union (which admits numbers) is refused there. These five values satisfy both.
 */
declare const WEIGHT: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'black', '400' | '500' | '600' | '700' | '800'>;

export { Banner, type BannerTone, Button, Card, Chip, FONT, Field, Row, Text, type Theme, WEIGHT, resetUiFont, setUiFont, theme };
