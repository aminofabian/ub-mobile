import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACE } from '@kiosk/staff';
import { BottomSheet } from './BottomSheet';

interface PromptProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * One question over the till, as a sheet that slides up from the foot and can be sent back down.
 *
 * It is deliberately **not** `presentationStyle="pageSheet"`: a native page sheet could not give a text field focus
 * on iOS — the field never became first responder, so a cashier tapping "Cash in the till" saw nothing happen. This
 * shape (a transparent modal, a bottom sheet, and a keyboard avoider *inside* it) is the one that can host a form.
 */
export function Prompt({ visible, title, onClose, children }: PromptProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.body}
      >
        {children}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: SPACE.xs, paddingBottom: SPACE.sm },
});
