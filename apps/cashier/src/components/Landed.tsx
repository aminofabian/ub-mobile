import React, { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { MOTION } from '@kiosk/staff';
import { useReducedMotion } from '../lib/motion';

/**
 * A row that has just appeared — the change owed, a shortfall — arrives rather than snaps into place.
 *
 * Short and small: 170ms and six points of rise. It is state, not choreography; a cashier sees *that* something
 * changed before they read *what*, and with reduced motion the row is simply there.
 */
export function Landed({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const reducedMotion = useReducedMotion();
  const at = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      at.setValue(1);
      return;
    }
    const run = Animated.timing(at, {
      toValue: 1,
      duration: 170,
      easing: MOTION.easeOut,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [at, reducedMotion]);

  return (
    <Animated.View
      style={[
        style as ViewStyle,
        {
          opacity: at,
          transform: [{ translateY: at.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
