import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { MART, MartText, RADIUS, SPACE } from '@kiosk/staff';
import { TABULAR_NUMS } from './CashierPrimitives';
import { useReducedMotion } from '../lib/motion';

/**
 * A milestone, said quietly: the words, a small gold dot, and nothing else. Gold is the till's one
 * "earned" colour and appears nowhere else — no ribbons, no confetti, no second vocabulary.
 */
export function MilestonePill({ label }: { label: string }) {
  return (
    <View style={styles.pill} accessibilityLabel={`Milestone: ${label}`}>
      <View style={styles.dot} />
      <MartText variant="meta" color={MART.ink} numberOfLines={1}>
        {label}
      </MartText>
    </View>
  );
}

/**
 * Progress toward the next milestone: a real count against a real target, with the rule written under
 * it so nothing is a mystery. The bar is green because it is the till's current state, not a reward.
 */
export function MilestoneProgress({
  label,
  have,
  need,
}: {
  label: string;
  have: number;
  need: number;
}) {
  const share = need > 0 ? Math.max(0, Math.min(1, have / need)) : 1;
  const reducedMotion = useReducedMotion();
  // Grows from the left rather than appearing full: scaleX, so it stays on the native driver and never re-lays out.
  const fill = useRef(new Animated.Value(reducedMotion ? share : 0)).current;
  useEffect(() => {
    if (reducedMotion) {
      fill.setValue(share);
      return;
    }
    Animated.timing(fill, {
      toValue: share,
      duration: 620,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [share, reducedMotion, fill]);
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: need, now: have, text: `${have} of ${need}` }}
    >
      <View style={styles.progressHead}>
        <MartText variant="meta" color={MART.inkMuted} numberOfLines={1} style={styles.grow}>
          Next · {label}
        </MartText>
        <MartText variant="label" color={MART.ink} style={TABULAR_NUMS}>
          {have} / {need}
        </MartText>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: `${Math.round(share * 100)}%`, transform: [{ scaleX: fill }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACE.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.gold,
  },
  progress: {
    gap: SPACE.xs,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  grow: { flex: 1 },
  track: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
  },
  fill: {
    transformOrigin: 'left center',
    height: '100%',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
  },
});
