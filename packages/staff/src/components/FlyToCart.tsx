import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { FONT, WEIGHT } from '../theme/mart';
import { MART, RADIUS, tint } from '../theme/mart';

/** Where a product was, and where the basket is, both in the screen's own coordinates. */
export type Flight = {
  id: number;
  /** The product's initials, so the thing in the air is recognisably the thing that was tapped. */
  initials: string;
  /** The aisle colour of that product, the same tint as its tile. */
  colour: string;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number };
};

// On-screen travel takes the movement curve, not the press curve: it eases away and eases in, so the ghost
// glides to the basket instead of snapping at it. Long enough to follow with the eye, short enough not to
// hold up the next tap (several can be in the air at once).
const TRAVEL = Easing.bezier(0.77, 0, 0.175, 1);
const FLIGHT_MS = 400;
const GHOST = 44;

/**
 * The tap, answered in space: a small disc carrying the product's initials arcs from its tile to the
 * basket total, shrinking and fading as it lands.
 *
 * It is purely visual — the product is in the basket before this runs, and nothing here can slow a sale.
 * One flight per new line, never per quantity change, and none at all when the phone asks for reduced motion.
 */
export function FlyToCart({ flights, onDone }: { flights: readonly Flight[]; onDone: (id: number) => void }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flights.map((flight) => (
        <Ghost key={flight.id} flight={flight} onDone={onDone} />
      ))}
    </View>
  );
}

function Ghost({ flight, onDone }: { flight: Flight; onDone: (id: number) => void }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: FLIGHT_MS,
      easing: TRAVEL,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished) onDone(flight.id);
    });
    return () => run.stop();
    // One flight, one run: the flight's id is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id]);

  const dx = flight.to.x - (flight.from.x + flight.from.w / 2);
  const dy = flight.to.y - (flight.from.y + flight.from.h / 2);

  return (
    <Animated.View
      style={[
        styles.ghost,
        {
          left: flight.from.x + flight.from.w / 2 - GHOST / 2,
          top: flight.from.y + flight.from.h / 2 - GHOST / 2,
          backgroundColor: tint(flight.colour, 0.22),
          opacity: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            // An arc, not a straight line: it rises a little before it drops into the basket.
            { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy * 0.5 - 46, dy] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.42] }) },
          ],
        },
      ]}
    >
      <Animated.Text style={styles.initials}>{flight.initials}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    width: GHOST,
    height: GHOST,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MART.border,
  },
  initials: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    letterSpacing: 0.3,
    color: MART.ink,
  },
});
