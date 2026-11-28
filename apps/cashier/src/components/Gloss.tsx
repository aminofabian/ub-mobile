import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * The shelf's ground: a lit surface rather than a flat fill.
 *
 * The image is a 512×1024 bake of three slow passes — a top-to-bottom wash so the page has a light direction, a soft
 * highlight where the light falls in from the top-left, and a faint shadow gathering at the foot so the cards above it
 * sit on something. Baking it rather than drawing it with a gradient component keeps the screen a single static image
 * (no per-frame work, no extra dependency) and keeps the reference bug that made `url(#id)` paints render red out of
 * the picture entirely.
 *
 * Only the ground is tinted: the cards stay the brightest thing on screen, which is what makes them float.
 */
export function Gloss() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={require('../../assets/gloss.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </View>
  );
}
