import React from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { MART } from '../theme/mart';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** How far the coast swells below and cuts above its resting line. */
export const COAST_SWELL = 18;

/**
 * Land meeting water. A filled area that starts at the top edge, runs off both sides of the screen and
 * ends in a curved coast instead of a straight line. Every top-level screen opens with one.
 *
 * `height` is where the coast rests. `drift` (0 to 1) redraws the coastline: screens feed it their
 * scroll position, so the shore shifts as the page moves.
 */
export function Coast({
  color,
  height,
  drift,
  style,
}: {
  color: string;
  height: number | SharedValue<number>;
  drift?: SharedValue<number>;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const rest = useDerivedValue(() => (typeof height === 'number' ? height : height.value));

  const animatedProps = useAnimatedProps(() => {
    const h = rest.value;
    const t = drift ? drift.value : 0;
    const a = COAST_SWELL;
    // Right shore dips, the middle rises, the left shore dips again. `t` trades the two dips.
    const right = h + a * (0.2 - 0.9 * t);
    const dipA = h + a * (1 - 1.3 * t);
    const rise = h - a * (0.9 - 0.5 * t);
    const mid = h - a * 0.1 + a * 0.5 * t;
    const dipB = h + a * (0.5 + 0.6 * t);
    const left = h - a * (0.5 - 0.9 * t);
    return {
      d:
        `M0 0H${width}V${right}` +
        `C${width * 0.84} ${dipA} ${width * 0.66} ${rise} ${width * 0.44} ${mid}` +
        `S${width * 0.14} ${dipB} 0 ${left}Z`,
    };
  });

  const max = (typeof height === 'number' ? height : 320) + COAST_SWELL * 2;

  return (
    <View pointerEvents="none" style={[styles.coast, style]}>
      <Svg width={width} height={typeof height === 'number' ? max : 400}>
        <AnimatedPath animatedProps={animatedProps} fill={color} />
      </Svg>
    </View>
  );
}

const LOBES = [
  'M50 4C68 2 90 12 95 34C100 54 92 78 74 90C56 101 30 99 14 84C0 70-1 44 10 26C19 12 34 5 50 4Z',
  'M46 3C66-1 88 10 94 30C100 50 98 72 82 87C66 100 40 100 22 90C6 80 0 60 4 40C8 20 26 7 46 3Z',
  'M54 5C74 6 94 18 97 40C100 60 88 82 68 93C50 102 26 98 12 82C-1 66 0 42 12 24C22 10 38 4 54 5Z',
  'M42 6C60 0 82 6 92 24C102 42 98 66 84 82C70 98 44 102 26 92C8 82-2 60 4 40C9 22 24 11 42 6Z',
] as const;

/** The same thing always gets the same lobe, so an aisle keeps its outline as well as its colour. */
export function lobeIndex(key: string | null | undefined): number {
  const text = key ?? '';
  let hash = 7;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  }
  return hash % LOBES.length;
}

/** One closed lobe of flat colour: an area on the map. Children sit centred on it. */
export function Lobe({
  color,
  size,
  shape = 0,
  children,
  style,
}: {
  color: string;
  size: number;
  shape?: number;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, styles.centre, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Path d={LOBES[shape % LOBES.length]} fill={color} />
      </Svg>
      {children}
    </View>
  );
}

/**
 * Crops whatever is underneath it to a lobe, by painting the ground colour everywhere outside the lobe.
 * Lay it over a square photograph; the photograph keeps its own loader and cache.
 */
export function LobeFrame({
  size,
  shape = 0,
  ground = MART.paper,
}: {
  size: number;
  shape?: number;
  ground?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Path
        d={`M-1-1H101V101H-1Z${LOBES[shape % LOBES.length]}`}
        fill={ground}
        fillRule="evenodd"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  coast: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
