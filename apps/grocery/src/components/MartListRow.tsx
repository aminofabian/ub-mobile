import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FONT, MART, MartText, RADIUS, SHADOW, SPACE, WEIGHT, tint } from '@kiosk/staff';
import type { Tone } from '../lib/sale-words';

const TAG: Record<Tone, { bg: string; ink: string }> = {
  normal: { bg: MART.paperSunken, ink: MART.inkMuted },
  ok: { bg: MART.successSurface, ink: MART.success },
  warn: { bg: MART.warningSurface, ink: MART.warning },
  danger: { bg: MART.dangerSurface, ink: MART.danger },
};

type Props = {
  title: string;
  subtitle?: string;
  right?: string;
  rightTone?: Tone;
  onPress?: () => void;
  selected?: boolean;
};

/** One list row in the grocery MART language — white card, strong title, quiet subtitle, status pill. */
export function MartListRow({ title, subtitle, right, rightTone = 'normal', onPress, selected = false }: Props) {
  const tag = TAG[rightTone];
  const body = (
    <>
      <View style={styles.left}>
        <MartText variant="heading" numberOfLines={2} style={styles.title}>
          {title}
        </MartText>
        {subtitle ? (
          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={2}>
            {subtitle}
          </MartText>
        ) : null}
      </View>
      {right ? (
        <View style={[styles.tag, { backgroundColor: tag.bg }]}>
          <MartText variant="shelf" color={tag.ink} style={styles.tagText}>
            {right}
          </MartText>
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, selected && styles.rowOn]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 64,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    ...SHADOW.card,
  },
  rowOn: {
    borderWidth: 1.5,
    borderColor: MART.fallbackPrimary,
  },
  pressed: { backgroundColor: tint(MART.fallbackPrimary, 0.04) },
  left: { flex: 1, gap: 2 },
  title: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  tag: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  tagText: { letterSpacing: 0.2 },
});
