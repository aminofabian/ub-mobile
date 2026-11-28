import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { feel } from '../lib/feel';
import {
  FONT,
  MART,
  MartText,
  PressableScale,
  RADIUS,
  SHADOW,
  SPACE,
  onFill,
  tint,
  WEIGHT,
} from '@kiosk/staff';

/** Keep monetary columns and live counters rock-steady as digits update. */
export const TABULAR_NUMS = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };

/** Single elevation rule for resting white tiles: hairline edge + soft tinted drop shadow. */
/**
 * A card is a surface, not an outline: white on the paper, lifted by one soft shadow. The stroke that used to
 * sit here as well made every tile a "ghost card" — a border under a wide shadow reads as a mistake, and on a
 * shelf of a dozen products it drew a grid of lines the eye had to cross. Selection still draws its own ring
 * (see the product tile), because state is worth a stroke; resting is not.
 */
export const CARD_SURFACE = {
  backgroundColor: MART.paperElevated,
  borderRadius: RADIUS.lg,
  // One depth for every card in the app: the same lift the product tiles have, so Payment, Shift, Receipt and the
  // order screens all sit on the shelf the same way.
  ...SHADOW.card,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.10,
  shadowRadius: 18,
  elevation: 4,
} as const;

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

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

/**
 * The till's one button. Every action on every screen — Checkout, Complete sale, Open shift, a sheet's
 * confirm — is this capsule in one of three kinds: a filled primary, an outlined secondary, or a
 * destructive danger. A filled button lifts in its own colour; a busy one keeps its size and shows a
 * spinner beside its label, so nothing jumps under a thumb while the shop is being asked.
 */
export function CashierButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const fill =
    variant === 'primary'
      ? MART.fallbackPrimary
      : variant === 'danger'
        ? MART.danger
        : variant === 'ghost'
          ? 'transparent'
          : MART.paperElevated;
  const ink =
    variant === 'secondary' ? MART.ink : variant === 'ghost' ? MART.fallbackPrimary : onFill(fill).primary;
  const off = disabled || busy;

  // `style` lands on a wrapper, not on the press target: PressableScale puts what it is given inside its
  // own auto-sized view, so a `flex: 1` handed to it would never be shared between two buttons in a row.
  return (
    <View style={style}>
      <PressableScale
        onPress={onPress}
        onPressIn={() => {
          if (!off) feel.tap();
        }}
        disabled={off}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: off, busy }}
        style={[
          styles.button,
          variant === 'ghost' && styles.buttonGhost,
          variant === 'secondary' ? styles.buttonOutlined : variant === 'ghost' ? null : { backgroundColor: fill },
          variant !== 'secondary' && variant !== 'ghost' && !off ? tintedLift(fill) : null,
          off && styles.buttonOff,
        ]}
      >
        {busy ? <ActivityIndicator size="small" color={ink} /> : null}
        {!busy && icon ? <Ionicons name={icon} size={17} color={ink} /> : null}
        <MartText variant="label" color={ink} numberOfLines={1} style={[styles.buttonLabel, textStyle]}>
          {title}
        </MartText>
      </PressableScale>
    </View>
  );
}

/**
 * A 44pt icon action — a sheet's close, a panel's dismiss, a row's trailing verb. Quiet by default so
 * it never competes with the one filled button on the screen.
 */
export function CashierIconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  tone = 'default',
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'quiet';
  style?: StyleProp<ViewStyle>;
}) {
  const color = tone === 'danger' ? MART.danger : tone === 'quiet' ? MART.inkQuiet : MART.ink;
  return (
    <View style={style}>
      <PressableScale
        onPress={onPress}
        onPressIn={() => {
          if (!disabled) feel.tap();
        }}
        disabled={disabled}
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={[styles.iconButton, tone === 'quiet' && styles.iconButtonQuiet, disabled && styles.buttonOff]}
      >
        <Ionicons name={icon} size={20} color={color} />
      </PressableScale>
    </View>
  );
}

/**
 * One row of a settings list: an icon, a name, and a chevron. Rows sit inside a card with 8pt of air, so a
 * screen of secondary actions reads as a list to scan rather than a stack of giant buttons competing with
 * the one real action above it.
 */
export function CashierRow({
  icon,
  title,
  subtitle,
  onPress,
  tone = 'default',
  disabled = false,
  busy = false,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = disabled ? MART.inkQuiet : tone === 'danger' ? MART.danger : MART.ink;
  // A row answers the way a native list row does: it lights up under the finger and ticks, rather than
  // shrinking the whole card the way a web tile would.
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (!disabled && !busy) feel.tap();
      }}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ disabled: disabled || busy }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.buttonOff, style]}
    >
      <Ionicons name={icon} size={19} color={tone === 'danger' ? MART.danger : MART.inkMuted} />
      <View style={styles.rowBody}>
        <MartText variant="heading" color={color} numberOfLines={1}>
          {title}
        </MartText>
        {subtitle ? (
          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={2}>
            {subtitle}
          </MartText>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={MART.inkMuted} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={MART.inkQuiet} />
      )}
    </Pressable>
  );
}

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
  const input = useRef<TextInput>(null);
  // The caller's ref is the input's; taps on the padding around it come here instead.
  useImperativeHandle(ref, () => input.current as TextInput, []);

  return (
    <View style={containerStyle}>
      {label ? (
        <MartText variant="label" color={MART.ink} style={styles.fieldLabel}>
          {label}
        </MartText>
      ) : null}
      {/* The whole box is the field. A tap anywhere in it — the padding, the icon, the space beside the
          digits — puts the caret in, instead of only the glyphs themselves being the target. */}
      <Pressable
        onPress={() => {
          if (editable) input.current?.focus();
        }}
        disabled={!editable}
        accessible={false}
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
          ref={input}
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
      </Pressable>
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
  tone = 'solid',
  style,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  /**
   * `solid` fills the capsule when it is the current state (a filter, a way of paying). `soft` tints it
   * instead, for a pick among suggestions — so the one filled green on a screen stays the primary action.
   */
  tone?: 'solid' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const activeInk = onFill(MART.fallbackPrimary).primary;
  const soft = selected && tone === 'soft';
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) feel.select();
      }}
      disabled={disabled}
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        soft && styles.chipSoft,
        disabled && styles.chipDisabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={selected ? (soft ? MART.fallbackPrimary : activeInk) : MART.fallbackPrimary}
        />
      ) : null}
      <MartText
        variant="label"
        color={selected ? (soft ? MART.fallbackPrimary : activeInk) : MART.ink}
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
  // A capsule at 52pt: the same height on every screen, in every sheet, whatever the label.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    minHeight: 52,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  buttonOutlined: {
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
  },
  buttonOff: {
    opacity: 0.55,
  },
  // A verb in a row: the label carries the colour, no fill, no lift — 44pt tall so it is still a thumb away.
  buttonGhost: {
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    backgroundColor: 'transparent',
  },
  buttonLabel: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 15,
    letterSpacing: -0.1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  iconButtonQuiet: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  // A settings row: 52pt tall, an icon, a name, a chevron — no fill, so a list of them stays quiet.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 52,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.md,
  },
  rowBody: { flex: 1, gap: 1 },
  rowPressed: { backgroundColor: MART.paperSunken },
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
    fontWeight: WEIGHT.regular,
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
  // A resting pick among suggestions: tinted, not filled, so it never competes with the screen's primary action.
  chipSoft: {
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    borderColor: tint(MART.fallbackPrimary, 0.45),
    shadowOpacity: 0,
    elevation: 0,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipLabelSelected: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
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
