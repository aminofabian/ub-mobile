import * as react_jsx_runtime from 'react/jsx-runtime';
import { ViewStyle, TextStyle, TextProps } from 'react-native';
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

declare const theme: {
    readonly colors: {
        readonly primary: "#28a745";
        readonly primaryDark: "#1e7e34";
        readonly background: "#ffffff";
        readonly surface: "#f8f9fa";
        readonly text: "#212529";
        readonly textMuted: "#6c757d";
        readonly border: "#dee2e6";
        readonly danger: "#dc3545";
        readonly warning: "#ffc107";
        readonly success: "#28a745";
    };
    readonly spacing: {
        readonly xs: 4;
        readonly sm: 8;
        readonly md: 16;
        readonly lg: 24;
        readonly xl: 32;
    };
    readonly borderRadius: {
        readonly sm: 4;
        readonly md: 8;
        readonly lg: 12;
        readonly xl: 16;
    };
};
type Theme = typeof theme;

export { Button, Card, Text, type Theme, theme };
