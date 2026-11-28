import React, { useRef } from 'react';
import { Animated, Easing, Pressable, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { theme } from '../theme';
import { FONT, WEIGHT } from '../type';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// A strong ease-out — starts fast, settles soft — so the press reads as responsive, not sluggish.
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** A soft drop shadow tinted to the fill, so a coloured button lifts in its own hue rather than grey. */
function tintedLift(fill: string): ViewStyle {
  return {
    shadowColor: fill,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  };
}

export function Button({ title, onPress, variant = 'primary', disabled, style, textStyle }: ButtonProps) {
  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.danger,
  }[variant];

  const color = variant === 'secondary' ? theme.colors.text : '#fffdf6';
  const scale = useRef(new Animated.Value(1)).current;
  const press = (to: number, duration: number) =>
    Animated.timing(scale, { toValue: to, duration, easing: EASE_OUT, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={() => !disabled && press(0.97, 130)}
        onPressOut={() => press(1, 220)}
        style={[
          styles.button,
          { backgroundColor },
          // Secondary is an outlined capsule on white; the fills carry the colour and a soft lift in that colour.
          variant === 'secondary' ? styles.outlined : !disabled ? tintedLift(backgroundColor) : null,
          disabled && styles.disabled,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <Text style={[styles.text, { color }, textStyle]}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    fontFamily: FONT.medium, fontWeight: WEIGHT.medium,
    fontSize: 15,
    letterSpacing: -0.1,
  },
});
