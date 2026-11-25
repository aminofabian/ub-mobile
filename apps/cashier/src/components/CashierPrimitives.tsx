import React, { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  FONT,
  HAIRLINE,
  MART,
  MartText,
  PressableScale,
  RADIUS,
  SHADOW,
  SPACE,
  onFill,
  tint,
} from '@kiosk/staff';

/** Keep monetary columns and live counters rock-steady as digits update. */
export const TABULAR_NUMS = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

/** Single elevation rule for resting white tiles: hairline edge + soft tinted drop shadow. */
export const CARD_SURFACE = {
  backgroundColor: MART.paperElevated,
  borderRadius: RADIUS.lg,
  ...HAIRLINE,
  ...SHADOW.card,
} as const;

type CashierFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string | null;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputWrapperStyle?: StyleProp<ViewStyle>;
};

/**
 * Shared text field for Cashier forms: unified 50px height, Poppins body copy,
 * clear green focus ring, and red invalid state.
 */
export const CashierField = forwardRef<TextInput, CashierFieldProps>(function CashierField(
  {
    label,
    error,
    hint,
    leadingIcon,
    trailing,
    containerStyle,
    inputWrapperStyle,
    style,
    onFocus,
    onBlur,
    editable = true,
    ...rest
  },
  ref
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label ? (
        <MartText variant="label" color={MART.ink} style={styles.fieldLabel}>
          {label}
        </MartText>
      ) : null}
      <View
        style={[
          styles.fieldBox,
          focused && !error && styles.fieldBoxFocused,
          error ? styles.fieldBoxError : null,
          !editable && styles.fieldBoxDisabled,
          inputWrapperStyle,
        ]}
      >
        {leadingIcon ? (
          <Ionicons
            name={leadingIcon}
            size={18}
            color={focused ? MART.fallbackPrimary : MART.inkQuiet}
          />
        ) : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={MART.inkQuiet}
          selectionColor={MART.fallbackPrimary}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.fieldInput, style]}
        />
        {trailing}
      </View>
      {error ? (
        <MartText variant="meta" color={MART.danger} style={styles.fieldHelper} accessibilityRole="alert">
          {error}
        </MartText>
      ) : hint ? (
        <MartText variant="meta" color={MART.inkQuiet} style={styles.fieldHelper}>
          {hint}
        </MartText>
      ) : null}
    </View>
  );
});

/**
 * Tactile 44px capsule chip for filters, payment modes, and quick cash picks.
 */
export function CashierChip({
  label,
  selected = false,
  disabled = false,
  icon,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const activeInk = onFill(MART.fallbackPrimary).primary;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? activeInk : MART.fallbackPrimary}
        />
      ) : null}
      <MartText
        variant="label"
        color={selected ? activeInk : MART.ink}
        style={[TABULAR_NUMS, selected && styles.chipLabelSelected]}
        numberOfLines={1}
      >
        {label}
      </MartText>
    </PressableScale>
  );
}

/**
 * Styled empty or error state with icon well, clear copy, and optional next action.
 */
export function EmptyOrErrorState({
  icon,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  tone = 'neutral',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const iconBg =
    tone === 'success'
      ? MART.successSurface
      : tone === 'danger'
        ? MART.dangerSurface
        : MART.paperSunken;
  const iconColor =
    tone === 'success'
      ? MART.success
      : tone === 'danger'
        ? MART.danger
        : MART.inkQuiet;

  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={26} color={iconColor} />
      </View>
      <MartText variant="heading" style={styles.emptyTitle}>
        {title}
      </MartText>
      <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyMessage}>
        {message}
      </MartText>
      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={styles.emptyAction}
        >
          {actionIcon ? (
            <Ionicons name={actionIcon} size={16} color={MART.fallbackPrimary} />
          ) : null}
          <MartText variant="label" color={MART.fallbackPrimary}>
            {actionLabel}
          </MartText>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    marginBottom: SPACE.xs,
    color: MART.ink,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 50,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  fieldBoxFocused: {
    borderColor: MART.fallbackPrimary,
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldBoxError: {
    borderColor: MART.danger,
  },
  fieldBoxDisabled: {
    backgroundColor: MART.paperSunken,
    opacity: 0.7,
  },
  fieldInput: {
    flex: 1,
    minHeight: 46,
    fontFamily: FONT.regular,
    fontSize: 15,
    color: MART.ink,
    paddingVertical: 0,
  },
  fieldHelper: {
    marginTop: SPACE.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  chipSelected: {
    backgroundColor: MART.fallbackPrimary,
    borderColor: MART.fallbackPrimary,
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipLabelSelected: {
    fontFamily: FONT.semibold,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.xxxl,
    paddingHorizontal: SPACE.lg,
    gap: SPACE.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyMessage: {
    textAlign: 'center',
    maxWidth: 270,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    minHeight: 44,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
});
