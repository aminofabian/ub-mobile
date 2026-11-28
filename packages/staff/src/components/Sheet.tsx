import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MART, RADIUS, SHADOW, SPACE, tint } from '../theme/mart';
import { MartText } from '../theme/mart-ui';

/**
 * A sheet that rises from the foot of the screen, with a scrim that closes it and a keyboard avoider inside it.
 *
 * The till learned the hard way that iOS's native page sheet cannot give a text field first responder in this app; every
 * sheet that can hold a form uses this shape instead, so all apps share one sheet behaviour.
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  maxHeight = '88%',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxHeight?: `${number}%`;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight, paddingBottom: Math.max(SPACE.lg, insets.bottom + SPACE.sm) }]}>
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.head}>
              <MartText variant="title" style={styles.title} numberOfLines={2}>
                {title}
              </MartText>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
                <Ionicons name="close" size={20} color={MART.inkMuted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: tint(MART.ink, 0.38), justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: MART.paperElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    ...SHADOW.floating,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  title: { flex: 1 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: RADIUS.pill, backgroundColor: MART.borderStrong, marginBottom: SPACE.sm },
});
