import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MART, RADIUS, SPACE, SHADOW, tint } from '@kiosk/staff';
import { useReducedMotion } from '../lib/motion';

const TEETH_COUNT = 26;

/**
 * The till's own receipt printer: a green head with a slot, and the slip coming out of it.
 *
 * The paper does not fade in — it is *printed*: the slip is laid out at full size behind a window whose height grows
 * from the slot down, with the torn edge riding the leading edge all the way. What that buys is a thing every cashier
 * already understands: paper out of a printer, in the order it was printed, with the tear at the end.
 *
 * The height animation is the one place in the app that changes layout per frame; it is a single one-off on a screen
 * that is otherwise still, and it is the only way the torn edge can travel with the paper. Reduced motion shows the
 * slip already out, which is the same receipt without the theatre.
 */
export function Printout({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();
  const [height, setHeight] = useState<number | null>(null);
  const reveal = useRef(new Animated.Value(0)).current;

  const measured = (event: { nativeEvent: { layout: { height: number } } }) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    setHeight((current) => (current === null || Math.abs(current - next) > 1 ? next : current));
  };

  useEffect(() => {
    if (height === null) return;
    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }
    // Paper feeds at a steady, slightly slow pace — fast enough not to hold a queue, slow enough to read as printing.
    const run = Animated.timing(reveal, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.36, 0, 0.24, 1),
      useNativeDriver: false,
    });
    run.start();
    return () => run.stop();
  }, [height, reducedMotion, reveal]);

  return (
    <View style={styles.frame}>
      {/* The printer head: the slot the paper comes out of, and the knobs either side of it. */}
      <View style={styles.head} accessible={false}>
        <View style={styles.roll}>
          <View style={styles.slot} />
          <View style={[styles.knob, styles.knobLeft]} />
          <View style={[styles.knob, styles.knobRight]} />
        </View>
      </View>

      {height === null ? null : (
        <Animated.View
          style={[
            styles.window,
            { height: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) },
          ]}
        >
          {/* Laid out at full size, clipped by the window: the head appears first and the foot last. */}
          <View style={styles.paper} onLayout={measured}>
            {children}
          </View>
          {/* The torn edge rides the leading edge, so the paper always ends in a tear. */}
          <View style={styles.teeth} pointerEvents="none">
            {Array.from({ length: TEETH_COUNT }).map((_, index) => (
              <View key={index} style={styles.tooth} />
            ))}
          </View>
        </Animated.View>
      )}

      {/* Invisible, full-size copy, so the window can be given the slip's real height before it animates. */}
      {height === null ? (
        <View style={styles.probe} pointerEvents="none">
          <View onLayout={measured}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: 0 },
  head: { alignItems: 'center', paddingHorizontal: SPACE.md },
  roll: {
    width: '96%',
    height: 26,
    borderRadius: RADIUS.md,
    backgroundColor: MART.fallbackPrimary,
    ...SHADOW.card,
  },
  // The dark line the paper leaves through, with its two rollers.
  slot: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    bottom: 3,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.ink, 0.72),
  },
  knob: {
    position: 'absolute',
    bottom: -2,
    width: 10,
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.paper, 0.9),
  },
  knobLeft: { left: -3 },
  knobRight: { right: -3 },
  window: { overflow: 'hidden', alignSelf: 'stretch' },
  paper: { position: 'absolute', top: 0, left: 0, right: 0 },
  teeth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 5,
  },
  tooth: { width: 9, height: 5, backgroundColor: MART.paper, borderRadius: 1 },
  probe: { position: 'absolute', left: 0, right: 0, opacity: 0, zIndex: -1 },
});
