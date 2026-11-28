import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GUTTER, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { ChipButton } from './Capsule';

/**
 * The look of every sheet that rises from the bottom: a cream panel with round shoulders, a grabber, a
 * heavy title and a close chip. It is only the panel; the `Modal` around it, and how that opens and
 * closes, stay with whoever shows it.
 */
export function SheetPanel({
  title,
  hint,
  onClose,
  closeLabel = 'Close',
  children,
  footer,
  style,
}: {
  title?: string;
  hint?: string | null;
  onClose?: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  /** Pinned under the content, above the home indicator: usually one `Capsule`. */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, SPACE.lg) }, style]}>
      <View style={styles.grabber} />
      {title || onClose ? (
        <View style={styles.head}>
          <View style={styles.headCopy}>
            {title ? (
              <Text accessibilityRole="header" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
          {onClose ? <ChipButton icon="close" label={closeLabel} onPress={onClose} outline /> : null}
        </View>
      ) : null}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

/** The dim behind a sheet. Flat ink at one strength everywhere. */
export const SHEET_SCRIM = 'rgba(44,46,42,0.55)';

const styles = StyleSheet.create({
  panel: {
    backgroundColor: MART.paper,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACE.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.borderStrong,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...TYPE.title,
    color: MART.ink,
  },
  hint: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
  },
});
