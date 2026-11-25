import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient, TenantContext } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, onFill, MartText } from '@kiosk/staff';
import { usePrinter } from '../store/printer-store';
import { buildReceipt } from '../printing/receipt';
import { demoSale } from '../printing/demo-sale';
import type { DiscoveredPrinter } from '../printing/transport';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'PrinterSettings'> & {
  api: ApiClient;
  tenant: TenantContext;
  branchName: string | null;
};

const PAPER_LABEL = { '58': '58 mm (small)', '80': '80 mm (wide)' } as const;

/**
 * Pair and manage the till's Bluetooth receipt printer. Scans for nearby printers, pairs one (with a
 * paper width), prints a test slip, and remembers it. When there is no Bluetooth — a simulator, or
 * the radio off — a demo printer stands in so the whole flow can be walked and the receipt previewed.
 */
export function PrinterSettingsScreen({ api, tenant, branchName, navigation }: Props) {
  const { status, found, saved, error, startScan, stopScan, pair, forget, print, mock } = usePrinter();
  const [paper, setPaper] = useState<'58' | '80'>(saved?.paper ?? '58');
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
        await pair(tenant.businessId, printer, paper);
      } catch {
        Alert.alert('Could not connect', 'That printer did not answer. Check it is on and nearby.');
      } finally {
        setBusyId(null);
      }
    },
    [pair, tenant.businessId, paper]
  );

  const testPrint = useCallback(async () => {
    setTesting(true);
    try {
      const receipt = buildReceipt(demoSale(), { name: tenant.displayName, branchName }, { paper: saved?.paper ?? '58' });
      await print(receipt.build());
      // The mock keeps the bytes so the preview can show exactly what went to the printer.
      navigation.navigate('ReceiptPreview', { source: 'test' });
    } catch (e) {
      Alert.alert('Test print failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setTesting(false);
    }
  }, [print, tenant.displayName, branchName, saved?.paper, navigation]);

  return (
    <View style={styles.screen}>
      {/* ── Paired printer ── */}
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
            <Pressable onPress={testPrint} disabled={testing} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}>
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
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert('Forget printer?', `Unpair ${saved.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Forget', style: 'destructive', onPress: () => void forget(tenant.businessId) },
                ])
              }
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={16} color={MART.danger} />
              <MartText variant="label" color={MART.danger}>
                Forget
              </MartText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── Paper width (applies to the next pairing) ── */}
      {!saved ? (
        <View style={styles.paperRow}>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.paperLabel}>
            Paper width
          </MartText>
          <View style={styles.segment}>
            {(['58', '80'] as const).map((w) => (
              <Pressable
                key={w}
                onPress={() => setPaper(w)}
                style={[styles.seg, paper === w && styles.segActive]}
              >
                <MartText variant="label" color={paper === w ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                  {w} mm
                </MartText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Scan list ── */}
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
            <View style={styles.emptyIcon}>
              <Ionicons name="bluetooth-outline" size={24} color={MART.inkQuiet} />
            </View>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyText}>
              {status === 'scanning' ? 'Looking for printers…' : 'No printers found. Make sure the printer is on.'}
            </MartText>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => void choose(item)} disabled={!!busyId} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
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
          </Pressable>
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
  screen: { flex: 1, backgroundColor: MART.paper, padding: GUTTER, gap: SPACE.md },
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
  dot: { width: 10, height: 10, borderRadius: RADIUS.pill },
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
  pressed: { opacity: 0.75 },
  paperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paperLabel: {},
  segment: { flexDirection: 'row', backgroundColor: MART.paperSunken, borderRadius: RADIUS.pill, padding: 3 },
  seg: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill },
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
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxxl },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', maxWidth: 240 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
});
