import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MART, RADIUS } from './mart';

/**
 * The gloss on a card: an edge that catches light, a warm fall at the foot, and one soft reflection across the top.
 *
 * It is drawn from plain views rather than a gradient image or an SVG paint — both of which misbehave in this stack
 * (`url(#id)` paints render red; stretched images draw at 1:1 and get cropped). Four layers, no per-frame work, and
 * it lands identically at any card size.
 */
export function CardGloss({ radius = RADIUS.lg, strength = 'high' }: { radius?: number; strength?: 'soft' | 'high' }) {
  return (
    <View style={[styles.clip, { borderRadius: radius }]} pointerEvents="none">
      {/* The card's own body: warm ivory, not paper white. A white highlight can only read against tone — on a
          pure-white card every reflection was invisible, which is why the gloss never landed. */}
      <View style={styles.body} />
      {/* the reflection: soft for everyday, a definite streak for the gloss pass */}
      {strength === 'high' ? (
        <>
          <View style={styles.streak} />
          <View style={styles.streakThin} />
        </>
      ) : (
        <>
          <View style={styles.sheen} />
          <View style={styles.sheenSoft} />
        </>
      )}
      {/* the lit edge: top and left are brighter than the body */}
      <View style={[styles.rim, styles.rimTop]} />
      <View style={[styles.rim, styles.rimLeft]} />
      {/* the shadow edge: bottom and right, so the card has thickness */}
      <View style={[styles.shade, styles.shadeBottom]} />
      <View style={[styles.shade, styles.shadeRight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  sheenSoft: {
    position: 'absolute',
    top: '4%',
    left: '-30%',
    right: '-30%',
    height: '26%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    transform: [{ rotate: '-7deg' }],
  },
  sheen: {
    position: 'absolute',
    top: '-18%',
    left: '-30%',
    right: '-30%',
    height: '46%',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '-7deg' }],
  },
  body: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f8f4e3' },
  streak: {
    position: 'absolute',
    top: '-6%',
    left: '-30%',
    right: '-30%',
    height: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    transform: [{ rotate: '-13deg' }],
  },
  streakThin: {
    position: 'absolute',
    top: '26%',
    left: '-30%',
    right: '-30%',
    height: '8%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    transform: [{ rotate: '-12deg' }],
  },
  rim: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.95)' },
  rimTop: { top: 0, left: 0, right: 0, height: 2.5 },
  rimLeft: { top: 0, bottom: 0, left: 0, width: 1.5 },
  shade: { position: 'absolute', backgroundColor: 'rgba(26, 36, 22, 0.10)' },
  shadeBottom: { bottom: 0, left: 0, right: 0, height: 2 },
  shadeRight: { top: 0, bottom: 0, right: 0, width: 1.5 },
});
