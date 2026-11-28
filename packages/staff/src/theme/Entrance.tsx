import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';
import { SPACE } from './mart';

/**
 * A rarely-seen screen (sign-in), so an entrance animation earns its place. Each section fades and
 * rises into place with a short stagger, using the built-in Animated API — no native module, so it
 * runs on every staff app without a rebuild. Ease-out at ~360ms: starts fast, feels responsive.
 */
export function Entrance({
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
      duration: 360,
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
        {
          opacity: t,
          transform: [
            {
              translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
