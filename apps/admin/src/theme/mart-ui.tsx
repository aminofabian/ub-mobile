import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, MOTION, onFill, RADIUS, SPACE, TILE, tint, TYPE, zoneFor } from './mart';

/**
 * A tappable that dips a touch when pressed — scale 0.97, a fast spring down and an eased spring back — so every
 * button, tile and row feels like it heard the finger. One micro-interaction, applied everywhere; a drop-in for
 * Pressable.
 */
export function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { scaleTo?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number, duration: number) =>
    Animated.timing(scale, { toValue: value, duration, easing: MOTION.easeOut, useNativeDriver: true }).start();
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) to(scaleTo, MOTION.feedback);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1, MOTION.state);
        onPressOut?.(e);
      }}
    >
      {(state) => (
        <Animated.View style={[{ transform: [{ scale }] }, typeof style === 'function' ? style(state) : style]}>
          {typeof children === 'function' ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}

/**
 * Admin's slice of the shopper "mart" look: cream paper ground, tiles that sit on the water with a
 * soft lift, the Jakarta type scale. Screens compose these instead of reaching for raw styles.
 */

type TypeScale = keyof typeof TYPE;

/**
 * A section fades and rises into place with a short stagger. Built-in Animated API — no native module,
 * so it runs without a rebuild. Ease-out at ~340ms: starts fast, feels responsive, settles once.
 */
export function Appear({
  delay = 0,
  rise = SPACE.lg,
  style,
  children,
  ...rest
}: ViewProps & { delay?: number; rise?: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 340,
      delay,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return (
    <Animated.View
      {...rest}
      style={[
        style,
        { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function MartText({
  variant = 'body',
  color = MART.ink,
  style,
  ...rest
}: TextProps & { variant?: TypeScale; color?: string }) {
  return <Text {...rest} style={[TYPE[variant], { color }, style]} />;
}

/** The screen's cream ground. */
export function Screen({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.screen, style]} />;
}

/** A white field on the water that holds a form, a list row or a summary. */
export function Tile({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.tile, style]} />;
}

/**
 * A metric. Quiet by design: a white tile on the water, a small zone-coloured dot keyed to the label
 * for identity, a muted caption, and the number itself in ink doing the talking.
 */
export function StatTile({
  label,
  value,
  zoneKey,
}: {
  label: string;
  value: string;
  zoneKey?: string;
}) {
  const accent = zoneFor(zoneKey ?? label);
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <View style={[styles.statDot, { backgroundColor: accent }]} />
        <Text style={[TYPE.meta, { color: MART.inkQuiet }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[TYPE.title, { color: MART.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/**
 * A tiny bar sparkline drawn from plain Views — no native SVG module, so it needs no extra build.
 * Values are normalised to the tallest bar; the last bar takes the accent to read as "now".
 */
export function Sparkline({
  data,
  color = MART.fallbackPrimary,
  height = 34,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <View style={[styles.spark, { height }]}>
      {data.map((v, i) => {
        const h = Math.max(3, Math.round((v / max) * height));
        const last = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              borderRadius: RADIUS.pill,
              backgroundColor: last ? color : tint(color, 0.28),
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * The screen's headline number: a caption, a large ink figure, an optional trend delta, and an
 * optional sparkline. One of these leads the dashboard; the smaller MiniTiles support it.
 */
export function HeroMetric({
  label,
  value,
  delta,
  trendUp = true,
  spark,
  accent = MART.fallbackPrimary,
}: {
  label: string;
  value: string;
  delta?: string;
  trendUp?: boolean;
  spark?: number[];
  accent?: string;
}) {
  return (
    <View style={styles.hero}>
      <Text style={[TYPE.meta, { color: MART.inkQuiet }]}>{label}</Text>
      <View style={styles.heroRow}>
        <Text style={[TYPE.display, styles.heroValue]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {delta ? (
          <View style={styles.heroDelta}>
            <Ionicons
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={15}
              color={trendUp ? MART.success : MART.danger}
            />
            <Text style={[TYPE.label, { color: trendUp ? MART.success : MART.danger }]}>{delta}</Text>
          </View>
        ) : null}
      </View>
      {spark ? <Sparkline data={spark} color={accent} height={26} /> : null}
    </View>
  );
}

/** A supporting metric: small icon, caption, and number, on a quiet tile. */
export function MiniTile({
  icon,
  label,
  value,
  accent = MART.inkQuiet,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.mini}>
      <View style={[styles.miniIcon, { backgroundColor: tint(accent, 0.16) }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={[TYPE.meta, { color: MART.inkQuiet }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TYPE.heading, { color: MART.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[TYPE.title, styles.sectionHead]}>
      {children}
    </Text>
  );
}

type ButtonKind = 'primary' | 'accent' | 'quiet';

export function MartButton({
  label,
  kind = 'primary',
  busy,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'children'> & {
  label: string;
  kind?: ButtonKind;
  busy?: boolean;
}) {
  const fill =
    kind === 'primary' ? MART.fallbackPrimary : kind === 'accent' ? MART.fallbackAccent : 'transparent';
  const inkOn = kind === 'quiet' ? MART.inkQuiet : onFill(fill).primary;
  const isOff = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isOff}
      style={({ pressed }) => [
        styles.button,
        kind === 'quiet' && styles.buttonQuiet,
        { backgroundColor: fill, opacity: isOff ? 0.55 : pressed ? 0.9 : 1 },
        style as object,
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={inkOn} />
      ) : (
        <Text style={[TYPE.label, styles.buttonLabel, { color: inkOn }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  tile: {
    ...TILE,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 92,
    justifyContent: 'space-between',
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    gap: SPACE.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill,
  },
  hero: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  heroValue: {
    flex: 1,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: MART.ink,
  },
  heroDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    paddingBottom: SPACE.xxs,
  },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  mini: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  miniIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.sm,
  },
  sectionHead: {
    marginBottom: SPACE.md,
  },
  button: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  buttonQuiet: {
    minHeight: 44,
  },
  buttonLabel: {
    fontFamily: TYPE.label.fontFamily,
  },
});
