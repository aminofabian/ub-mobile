import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MART, MOTION, ON_BRAND, RADIUS, SPACE, TYPE } from '../theme/mart';
import { brandName } from '../lib/brand';

const MARK = require('../../assets/brand-mark.png');
const STAMP = 152;
/** Hold long enough that the stamp reads, even on a fast boot. */
const MIN_VISIBLE_MS = 1400;
/** Absolute ceiling. Past this the splash leaves whatever the boot is doing. */
const MAX_VISIBLE_MS = 4000;

type Props = {
  /** True once the store has resolved and there is something to hand over to. */
  ready: boolean;
  storeName?: string | null;
  onDone: () => void;
};

/**
 * The brand mark is stamped onto forest-green stock. Orange then gold rings
 * flash like a till impression, the gold shelf rule draws, and the name prints
 * underneath: the shop's own name in a white-label build, "Kiosk" in the
 * generic app, which has no shop yet.
 */
export function BrandSplash({ ready, storeName, onDone }: Props) {
  const wordmark = brandName(storeName);
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  const pop = useRef(new Animated.Value(0)).current;
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const wipe = useRef(new Animated.Value(0)).current;
  const rule = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;
  const field = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

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
    if (!reduceMotion && width === 0) return;

    if (reduceMotion) {
      pop.setValue(1);
      wipe.setValue(1);
      rule.setValue(1);
      mark.setValue(1);
      caption.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(pop, {
        toValue: 1,
        duration: 540,
        delay: 40,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(ringA, {
        toValue: 1,
        duration: 720,
        delay: 90,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(ringB, {
        toValue: 1,
        duration: 720,
        delay: 200,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(wipe, {
        toValue: 1,
        duration: 520,
        delay: 380,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(rule, {
        toValue: 1,
        duration: 560,
        delay: 360,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(mark, {
        toValue: 1,
        duration: 160,
        delay: 820,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(caption, {
        toValue: 1,
        duration: 320,
        delay: 640,
        easing: MOTION.easeOut,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, width, pop, ringA, ringB, wipe, rule, mark, caption]);

  const handOver = useRef(() => {});
  handOver.current = () => {
    if (handedOver.current) return;
    handedOver.current = true;
    Animated.parallel([
      Animated.timing(field, {
        toValue: 0,
        duration: MOTION.exit,
        easing: MOTION.easeIn,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 1,
        duration: MOTION.exit,
        easing: MOTION.easeIn,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
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

  const liftY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const popY = pop.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.84, 1] });
  const ringAScale = ringA.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.58] });
  const ringAOp = ringA.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.85, 0] });
  const ringBScale = ringB.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.72] });
  const ringBOp = ringB.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.7, 0] });

  return (
    <Animated.View style={[styles.field, { opacity: field }]}>
      <StatusBar style="light" />
      <Animated.View style={[styles.lockup, { transform: [{ translateY: liftY }] }]}>
        <View style={styles.stamp} accessibilityElementsHidden>
          {reduceMotion ? null : (
            <>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ring,
                  {
                    borderColor: MART.fallbackAccent,
                    opacity: ringAOp,
                    transform: [{ scale: ringAScale }],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.ring,
                  {
                    borderColor: MART.gold,
                    opacity: ringBOp,
                    transform: [{ scale: ringBScale }],
                  },
                ]}
              />
            </>
          )}
          <Animated.Image
            source={MARK}
            accessibilityIgnoresInvertColors
            style={[
              styles.markImg,
              {
                opacity: pop,
                transform: [{ translateY: popY }, { scale: popScale }],
              },
            ]}
          />
        </View>

        <View
          onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
          style={styles.wordmarkClip}
        >
          <Text
            accessibilityRole="header"
            accessibilityLabel={`${wordmark}${storeName ? `, ${storeName}` : ''}`}
            style={styles.wordmark}
          >
            {wordmark}
          </Text>
          {width > 0 && reduceMotion === false ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ink,
                {
                  transform: [
                    {
                      translateX: wipe.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, width],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
        </View>

        <View style={styles.ruleRow}>
          <View style={styles.ruleTrack}>
            {width > 0 ? (
              <Animated.View
                style={[
                  styles.ruleFill,
                  {
                    transform: [
                      {
                        translateX: rule.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-Math.max(width, STAMP), 0],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ) : null}
          </View>
          <Animated.View
            style={[
              styles.endMark,
              { opacity: mark, transform: [{ scale: mark }] },
            ]}
          />
        </View>

        {storeName ? (
          <Animated.Text numberOfLines={1} style={[styles.caption, { opacity: caption }]}>
            {storeName}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    width: '100%',
    maxWidth: 320,
  },
  stamp: {
    width: STAMP,
    height: STAMP,
    marginBottom: SPACE.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 2,
  },
  markImg: {
    width: STAMP,
    height: STAMP,
    borderRadius: RADIUS.lg,
  },
  wordmarkClip: {
    overflow: 'hidden',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  wordmark: {
    ...TYPE.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: ON_BRAND.primary,
    textAlign: 'center',
  },
  ink: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MART.fallbackPrimary,
  },
  ruleRow: {
    marginTop: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: SPACE.xs,
  },
  ruleTrack: {
    flex: 1,
    height: 2,
    overflow: 'hidden',
  },
  ruleFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MART.gold,
  },
  endMark: {
    width: 7,
    height: 7,
    backgroundColor: MART.fallbackAccent,
  },
  caption: {
    ...TYPE.meta,
    marginTop: SPACE.md,
    color: ON_BRAND.secondary,
    letterSpacing: 0.3,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
