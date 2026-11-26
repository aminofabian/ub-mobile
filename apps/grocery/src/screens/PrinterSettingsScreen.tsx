import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FONT, MART, PressableScale, RADIUS, SPACE, WEIGHT, onFill, tint, MartText } from '@kiosk/staff';
import { useGrocerySession } from '../lib/session';
import { buildGroceryInvoiceReceipt } from '../printing/grocery-invoice-receipt';
import type { DiscoveredPrinter } from '../printing/transport';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { usePrinter } from '../store/printer-store';

type Props = NativeStackScreenProps<GroceryStackParamList, 'PrinterSettings'>;

const PAPER_LABEL = { '58': '58 mm (small)', '80': '80 mm (wide)' } as const;

/**
 * Pair a Bluetooth thermal printer for department-invoice slips (same role as the web clerk's till printer).
 */
export function PrinterSettingsScreen({}: Props) {
  const { tenantId, shopName, branchName, clerkName } = useGrocerySession();
  const { status, found, saved, error, startScan, stopScan, pair, forget, print } = usePrinter();
  const [paper, setPaper] = useState<'58' | '80'>(saved?.paper ?? '80');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void startScan();
    return () => stopScan();
  }, [startScan, stopScan]);

  const choose = useCallback(
    async (printer: DiscoveredPrinter) => {
      setBusyId(printer.id);
      try {
        await pair(tenantId, printer, paper);
      } catch {
        Alert.alert('Could not connect', 'That printer did not answer. Check it is on and nearby.');
      } finally {
        setBusyId(null);
      }
    },
    [pair, tenantId, paper]
  );

  const testPrint = useCallback(async () => {
    setTesting(true);
    try {
      const receipt = buildGroceryInvoiceReceipt(
        {
          businessName: shopName,
          branchName,
          clerkName,
          code: 'TEST123456',
          createdAt: Date.now(),
          lines: [
            {
              lineId: 't1',
              itemId: 't1',
              name: 'Test item',
              unitName: 'pcs',
              weighed: false,
              quantityUnits: 10_000,
              unitCents: 10_000,
            },
          ],
          totalCents: 10_000,
        },
        saved?.paper ?? paper
      );
      await print(receipt.build());
      Alert.alert('Printed', 'A test department invoice was sent to the printer.');
    } catch (e) {
      Alert.alert('Test print failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setTesting(false);
    }
  }, [print, shopName, branchName, clerkName, saved?.paper, paper]);

  return (
    <View style={styles.screen}>
      {saved ? (
        <View style={styles.pairedCard}>
          <View style={styles.pairedTop}>
            <View style={styles.pairedIcon}>
              <Ionicons name="print" size={22} color={onFill(MART.fallbackPrimary).primary} />
            </View>
            <View style={{ flex: 1 }}>
              <MartText variant="heading" numberOfLines={1}>
                {saved.name}
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                {PAPER_LABEL[saved.paper]} ·{' '}
                {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Not connected'}
                {saved.kind === 'mock' ? ' · demo' : ''}
              </MartText>
            </View>
            <View style={[styles.dot, { backgroundColor: status === 'connected' ? MART.success : MART.inkQuiet }]} />
          </View>
          <View style={styles.pairedActions}>
            <PressableScale onPress={testPrint} disabled={testing} style={[styles.btn, styles.btnPrimary]}>
              {testing ? (
                <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={16} color={onFill(MART.fallbackPrimary).primary} />
                  <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                    Test print
                  </MartText>
                </>
              )}
            </PressableScale>
            <PressableScale
              onPress={() =>
                Alert.alert('Forget printer?', `Unpair ${saved.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Forget', style: 'destructive', onPress: () => void forget(tenantId) },
                ])
              }
              style={[styles.btn, styles.btnGhost]}
            >
              <Ionicons name="trash-outline" size={16} color={MART.danger} />
              <MartText variant="label" color={MART.danger}>
                Forget
              </MartText>
            </PressableScale>
          </View>
        </View>
      ) : null}

      {!saved ? (
        <View style={styles.paperRow}>
          <MartText variant="meta" color={MART.inkQuiet}>
            Paper width
          </MartText>
          <View style={styles.segment}>
            {(['58', '80'] as const).map((w) => (
              <Pressable key={w} onPress={() => setPaper(w)} style={[styles.seg, paper === w && styles.segActive]}>
                <MartText variant="label" color={paper === w ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                  {w} mm
                </MartText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.scanHead}>
        <MartText variant="label">{saved ? 'Other printers nearby' : 'Printers nearby'}</MartText>
        {status === 'scanning' ? <ActivityIndicator size="small" color={MART.fallbackPrimary} /> : null}
      </View>

      <FlatList
        data={found.filter((p) => p.id !== saved?.id)}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyText}>
              {status === 'scanning' ? 'Looking for printers…' : 'No printers found. Make sure the printer is on.'}
            </MartText>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale onPress={() => void choose(item)} disabled={!!busyId} style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="print-outline" size={18} color={MART.fallbackPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <MartText variant="heading" numberOfLines={1}>
                {item.name}
              </MartText>
              {item.id.startsWith('mock-') ? (
                <MartText variant="meta" color={MART.inkQuiet}>
                  Demo — no real printer needed
                </MartText>
              ) : item.rssi != null ? (
                <MartText variant="meta" color={MART.inkQuiet}>
                  Signal {item.rssi} dBm
                </MartText>
              ) : null}
            </View>
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={MART.fallbackPrimary} />
            ) : (
              <MartText variant="shelf" color={MART.fallbackPrimary}>
                PAIR
              </MartText>
            )}
          </PressableScale>
        )}
      />

      {error ? (
        <View style={styles.errorBar}>
          <Ionicons name="warning-outline" size={16} color={MART.danger} />
          <MartText variant="meta" color={MART.danger} style={{ flex: 1 }}>
            {error}
          </MartText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper, padding: SPACE.lg, gap: SPACE.md },
  pairedCard: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.md,
    gap: SPACE.md,
  },
  pairedTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  pairedIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 999 },
  pairedActions: { flexDirection: 'row', gap: SPACE.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    borderRadius: RADIUS.md,
  },
  btnPrimary: { backgroundColor: MART.fallbackPrimary },
  btnGhost: { borderWidth: 1, borderColor: MART.border, backgroundColor: MART.paperElevated },
  paperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segment: { flexDirection: 'row', backgroundColor: MART.paperSunken, borderRadius: 999, padding: 3 },
  seg: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: 999 },
  segActive: { backgroundColor: MART.fallbackPrimary },
  scanHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  list: { gap: SPACE.sm, paddingBottom: SPACE.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxxl },
  emptyText: { textAlign: 'center', maxWidth: 240, fontFamily: FONT.regular, fontWeight: WEIGHT.regular },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
});
