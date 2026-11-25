import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GUTTER, MART, RADIUS, SPACE, MartText } from '@kiosk/staff';
import { EscPosBuilder } from '../printing/escpos';
import { usePrinter } from '../store/printer-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'ReceiptPreview'>;

/** Rebuild the printable text from captured ESC/POS bytes, the same way the builder's preview does. */
function textFromBytes(bytes: Uint8Array): string {
  const b = new EscPosBuilder();
  // Replace the builder's buffer with the captured bytes and reuse its preview decoder.
  (b as unknown as { bytes: number[] }).bytes = Array.from(bytes);
  return b.preview();
}

/**
 * Shows the exact slip the printer was sent, drawn as thermal paper on screen. On a real printer the
 * cashier compares this to what came out; on a simulator (where the mock "printed") it is the whole
 * proof that the receipt is right — same bytes, just rendered to glass instead of paper.
 */
export function ReceiptPreviewScreen({ route }: Props) {
  const lastBytes = usePrinter((s) => s.mock.lastBytes);
  const isTest = route.params?.source === 'test';

  const text = useMemo(() => (lastBytes ? textFromBytes(lastBytes) : ''), [lastBytes]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.note}>
        <Ionicons name="eye-outline" size={16} color={MART.inkQuiet} />
        <MartText variant="meta" color={MART.inkQuiet} style={{ flex: 1 }}>
          {isTest ? 'Test slip' : 'This receipt'} — exactly the bytes sent to the printer, shown here on screen.
        </MartText>
      </View>

      {/* Thermal paper */}
      <View style={styles.paperWrap}>
        <View style={styles.tornTop} />
        <View style={styles.paper}>
          {text ? (
            <MartText variant="body" style={styles.mono}>
              {text}
            </MartText>
          ) : (
            <MartText variant="meta" color={MART.inkQuiet}>
              Nothing printed yet.
            </MartText>
          )}
        </View>
        <View style={styles.tornBottom} />
      </View>
    </ScrollView>
  );
}

const TEETH = 14;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { padding: GUTTER, gap: SPACE.md, alignItems: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    alignSelf: 'stretch',
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
  },
  paperWrap: { width: 300, alignItems: 'stretch' },
  paper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  // A zig-zag torn edge, faked with a row of small rotated squares.
  tornTop: {
    height: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
  },
  tornBottom: {
    height: 8,
    backgroundColor: '#ffffff',
  },
  mono: {
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 17,
    color: '#1a1a1a',
  },
});
