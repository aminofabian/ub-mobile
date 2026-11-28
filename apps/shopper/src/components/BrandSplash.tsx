import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { MART, MOTION, onFill, RADIUS, SPACE, SPRING, TYPE, ZONE } from '../theme/mart';
import { brandName } from '../lib/brand';
import { Lobe } from './Coast';

const MARK = require('../../assets/brand-mark.png');
const STAMP = 132;
const ISLAND = 228;
/** Hold long enough that the mark reads, even on a fast boot. */
const MIN_VISIBLE_MS = 1400;
/** Absolute ceiling. Past this the splash leaves whatever the boot is doing. */
const MAX_VISIBLE_MS = 4000;

const LAND = MART.fallbackPrimary;
const ON_LAND = onFill(LAND);

type Props = {
  /** True once the store has resolved and there is something to hand over to. */
  ready: boolean;
  storeName?: string | null;
  onDone: () => void;
};

/**
 * The whole screen is land. A sun-yellow lobe swells up under the brand mark, the name settles in
 * beneath it (the shop's own name in a white-label build, "Kiosk" in the generic app, which has no
 * shop yet), and when the shop is ready the land slides off the top like a coast drawing back.
 */
export function BrandSplash({ ready, storeName, onDone }: Props) {
  const wordmark = brandName(storeName);
  const { height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const island = useSharedValue(0);
  const mark = useSharedValue(0);
  const name = useSharedValue(0);
  const leave = useSharedValue(0);
  const fade = useSharedValue(1);

  const shownAt = useRef(Date.now());
  const handedOver = useRef(false);
  const scheduled = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => {
        if (alive) setReduceMotion(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      island.value = 1;
      mark.value = 1;
      name.value = 1;
      return;
    }
    island.value = withDelay(40, withSpring(1, SPRING));
    mark.value = withDelay(160, withSpring(1, SPRING));
    name.value = withDelay(320, withSpring(1, SPRING));
  }, [reduceMotion, island, mark, name]);

  const handOver = useRef(() => {});
  handOver.current = () => {
    if (handedOver.current) return;
    handedOver.current = true;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished !== false) runOnJS(onDone)();
    };
    if (reduceMotion) {
      fade.value = withTiming(0, { duration: MOTION.exit }, done);
      return;
    }
    leave.value = withTiming(1, { duration: MOTION.view, easing: Easing.bezier(0.7, 0, 0.84, 0) }, done);
  };

  useEffect(() => {
    const failsafe = setTimeout(() => handOver.current(), MAX_VISIBLE_MS);
    timers.current.push(failsafe);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  useEffect(() => {
    if (!ready || scheduled.current) return;
    scheduled.current = true;
    const elapsed = Date.now() - shownAt.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    timers.current.push(setTimeout(() => handOver.current(), wait));
  }, [ready]);

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: -leave.value * (height + 80) }],
  }));
  const islandStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + island.value * 0.6 }, { rotate: `${(1 - island.value) * -24}deg` }],
    opacity: Math.min(1, island.value * 3),
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, mark.value * 2),
    transform: [{ scale: 0.8 + mark.value * 0.2 }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, name.value * 2),
    transform: [{ translateY: (1 - name.value) * 16 }],
  }));

  return (
    <Animated.View style={[styles.field, fieldStyle]}>
      <StatusBar style={ON_LAND.primary === MART.ink ? 'dark' : 'light'} />
      <View style={styles.lockup}>
        <View style={styles.stamp} accessibilityElementsHidden>
          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, islandStyle]}>
            <Lobe color={ZONE.sun} size={ISLAND} shape={2} />
          </Animated.View>
          <Animated.View style={markStyle}>
            <Image source={MARK} accessibilityIgnoresInvertColors style={styles.markImg} />
          </Animated.View>
        </View>

        <Animated.View style={nameStyle}>
          <Text
            accessibilityRole="header"
            accessibilityLabel={`${wordmark}${storeName ? `, ${storeName}` : ''}`}
            style={styles.wordmark}
          >
            {wordmark}
          </Text>
          {storeName ? (
            <Text numberOfLines={1} style={styles.caption}>
              {storeName}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    width: '100%',
    maxWidth: 340,
  },
  stamp: {
    width: ISLAND,
    height: ISLAND,
    marginBottom: SPACE.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markImg: {
    width: STAMP,
    height: STAMP,
    borderRadius: RADIUS.xl,
  },
  wordmark: {
    ...TYPE.display,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -2,
    color: ON_LAND.primary,
    textAlign: 'center',
  },
  caption: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: ON_LAND.secondary,
    textAlign: 'center',
  },
});
