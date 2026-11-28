import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MART, RADIUS, SHADOW, SPACE, onFill, MartText } from '@kiosk/staff';
import { FIRST_RUN_TIPS } from '../lib/first-run';
import { feel } from '../lib/feel';

/**
 * The first day, taught in place: one tip at a time, floating above the basket, never covering the shelf.
 *
 * No carousel, no modal, no slides. Three short cards that name something the cashier can see on this screen right
 * now, a dot per tip, and a way out at every step.
 */
export function FirstRun({
  step,
  onNext,
  onSkip,
}: {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const tip = FIRST_RUN_TIPS[Math.min(step, FIRST_RUN_TIPS.length - 1)];
  const last = step >= FIRST_RUN_TIPS.length - 1;
  const ink = onFill(MART.fallbackPrimary).primary;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.card}>
        <View style={styles.head}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            FIRST DAY · {step + 1} OF {FIRST_RUN_TIPS.length}
          </MartText>
          <View style={styles.dots}>
            {FIRST_RUN_TIPS.map((_, index) => (
              <View key={index} style={[styles.dot, index <= step && styles.dotOn]} />
            ))}
          </View>
        </View>

        <MartText variant="heading" numberOfLines={2}>
          {tip.title}
        </MartText>
        <MartText variant="body" color={MART.inkMuted} style={styles.body}>
          {tip.body}
        </MartText>

        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              feel.tap();
              onSkip();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            hitSlop={8}
            style={styles.skip}
          >
            <MartText variant="label" color={MART.inkQuiet}>
              Skip
            </MartText>
          </Pressable>
          <Pressable
            onPress={() => {
              feel.tap();
              onNext();
            }}
            accessibilityRole="button"
            accessibilityLabel={last ? 'Finish the tour' : 'Next tip'}
            style={({ pressed }) => [styles.next, pressed && styles.nextPressed]}
          >
            <MartText variant="label" color={ink}>
              {last ? 'Start selling' : 'Next'}
            </MartText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SPACE.md, right: SPACE.md, bottom: 96 },
  card: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    gap: SPACE.xs,
    ...SHADOW.floating,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs },
  eyebrow: { letterSpacing: 1.2 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: MART.border },
  dotOn: { backgroundColor: MART.fallbackPrimary },
  body: { marginBottom: SPACE.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  skip: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.sm },
  next: {
    minWidth: 132,
    minHeight: 48,
    paddingHorizontal: SPACE.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
  },
  nextPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
