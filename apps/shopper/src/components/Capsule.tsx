import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { tapFeel } from '../lib/haptics';
import { MART, onFill, RADIUS, SPACE, SPRING, TYPE } from '../theme/mart';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Anything pressable that should give under the thumb. It sinks a little while held and springs back
 * with the app's one overshoot. Use it for tiles, rows and cards; controls use `Capsule`.
 */
export function PressScale({
  children,
  style,
  to = 0.97,
  feel = false,
  onPress,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  to?: number;
  /** Tick the haptic engine on press. On for things that change state, off for plain navigation. */
  feel?: boolean;
}) {
  const scale = useSharedValue(1);
  const sink = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // The Pressable is what the parent lays out, so anything that sizes or places the tile in its parent
  // goes there; everything that paints it stays on the view that sinks.
  const { outer, inner } = splitLayout(style);
  return (
    <Pressable
      style={outer}
      {...rest}
      onPressIn={(event) => {
        scale.value = withSpring(to, SPRING);
        rest.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, SPRING);
        rest.onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (feel) tapFeel();
        onPress?.(event);
      }}
    >
      <Animated.View style={[inner, sink]}>{children}</Animated.View>
    </Pressable>
  );
}

const PLACEMENT = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
] as const;

function splitLayout(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = { ...flat };
  for (const key of PLACEMENT) {
    if (flat[key] !== undefined) {
      outer[key] = flat[key];
      delete inner[key];
    }
  }
  if (outer.flex !== undefined || outer.flexGrow !== undefined) inner.flexGrow = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

const SIZES = {
  lg: { height: 56, chip: 40, pad: 8, type: TYPE.heading, icon: 20 },
  md: { height: 48, chip: 34, pad: 7, type: TYPE.label, icon: 18 },
  sm: { height: 38, chip: 26, pad: 6, type: TYPE.label, icon: 15 },
} as const;

/**
 * The app's button. A capsule with a round chip riding its trailing edge; when the capsule is `live`
 * (chosen, switched on, in progress) the chip crosses to the leading edge.
 *
 * - `primary` is filled with `fill` (pass the shop's colour).
 * - `quiet` is an ink outline on whatever is behind it.
 * - `danger` is for removing and cancelling, and is never placed beside a primary.
 */
export function Capsule({
  label,
  onPress,
  kind = 'primary',
  size = 'lg',
  fill = MART.fallbackPrimary,
  chip,
  live = false,
  busy = false,
  disabled = false,
  stretch = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet' | 'danger';
  size?: keyof typeof SIZES;
  fill?: string;
  /** The mark on the chip. Leave out for a capsule with no chip. */
  chip?: IconName;
  live?: boolean;
  busy?: boolean;
  disabled?: boolean;
  /** Fill the row (default) or hug the label. */
  stretch?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const dims = SIZES[size];
  const inactive = disabled || busy;
  const filled = kind === 'primary';
  const ground = filled ? fill : kind === 'danger' ? MART.dangerSurface : 'transparent';
  const on = filled ? onFill(fill) : onFill(MART.paper);
  const ink = kind === 'danger' ? MART.danger : on.primary;
  const showChip = Boolean(chip) || busy;

  const [width, setWidth] = useState(0);
  const scale = useSharedValue(1);
  const cross = useSharedValue(live ? 1 : 0);
  useEffect(() => {
    cross.value = withSpring(live ? 1 : 0, SPRING);
  }, [cross, live]);

  const travel = Math.max(0, width - dims.chip - dims.pad * 2);
  const sink = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ride = useAnimatedStyle(() => ({ transform: [{ translateX: -travel * cross.value }] }));

  return (
    <Pressable
      onPress={() => {
        tapFeel();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.97, SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING);
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy, selected: live || undefined }}
      style={[!stretch && styles.hug, style]}
    >
      <Animated.View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[
          styles.capsule,
          {
            minHeight: dims.height,
            backgroundColor: ground,
            paddingRight: showChip ? dims.chip + dims.pad + SPACE.md : SPACE.xl,
            // A capsule that hugs its label only needs chip room on the side the chip rests on.
            paddingLeft: showChip && (stretch || live) ? dims.chip + dims.pad + SPACE.md : SPACE.xl,
          },
          kind === 'quiet' && styles.outline,
          disabled && styles.disabled,
          sink,
        ]}
      >
        <Text numberOfLines={1} style={[dims.type, { color: ink }]}>
          {label}
        </Text>
        {showChip ? (
          <Animated.View
            style={[
              styles.chip,
              {
                width: dims.chip,
                height: dims.chip,
                right: dims.pad,
                backgroundColor: ink,
              },
              ride,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={filled ? fill : MART.paper} />
            ) : (
              <Ionicons
                name={chip ?? 'arrow-forward'}
                size={dims.icon}
                color={filled ? fill : kind === 'danger' ? MART.dangerSurface : MART.paper}
              />
            )}
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** A round control that is only a mark: close, back, scan, step. Always at least 44pt to the thumb. */
export function ChipButton({
  icon,
  onPress,
  label,
  fill = MART.ink,
  color,
  size = 40,
  outline = false,
  disabled = false,
}: {
  icon: IconName;
  onPress: () => void;
  /** What a screen reader says. */
  label: string;
  fill?: string;
  color?: string;
  size?: number;
  outline?: boolean;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const sink = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const hit = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      onPress={() => {
        tapFeel();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.9, SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING);
      }}
      disabled={disabled}
      hitSlop={hit}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Animated.View
        style={[
          styles.round,
          { width: size, height: size, backgroundColor: outline ? 'transparent' : fill },
          outline && styles.outline,
          disabled && styles.disabled,
          sink,
        ]}
      >
        <Ionicons
          name={icon}
          size={Math.round(size * 0.5)}
          color={color ?? (outline ? MART.ink : onFill(fill).primary)}
        />
      </Animated.View>
    </Pressable>
  );
}

/** A small flat label on a zone colour: "Deal", "Out of stock", "Paid". Not pressable. */
export function Tag({ label, color = MART.gold, style }: { label: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tag, { backgroundColor: color }, style]}>
      <Text style={[TYPE.shelf, { color: onFill(color).primary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hug: {
    alignSelf: 'flex-start',
  },
  capsule: {
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: {
    borderWidth: 1.5,
    borderColor: MART.ink,
  },
  disabled: {
    opacity: 0.4,
  },
  chip: {
    position: 'absolute',
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  round: {
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
});
