import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * The ground a screen floats on: a lit surface rather than a flat fill.
 *
 * A 512×1024 bake of three slow passes — a wash with a light direction, a soft highlight where the light falls in, and a
 * faint shadow gathering at the foot — drawn as one static image so there is no per-frame work and no dependency on a
 * gradient library. Only the ground is tinted; the cards above it stay the brightest thing on screen, which is what
 * makes them float.
 */
export function Gloss() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={require('../../assets/gloss.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>
  );
}
