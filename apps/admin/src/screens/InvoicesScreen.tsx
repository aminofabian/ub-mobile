import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatKes,
  invoicePath,
  invoicesPath,
  readInvoices,
  sortInvoices,
  stateWords,
  type ApiClient,
  type GroceryInvoice,
} from '@kiosk/core';
import { MartText } from '@kiosk/staff';
import { FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, tint } from '../theme/mart';

/**
 * The counter invoices, as the owner sees them: what is waiting for payment, what has been paid, and what lapsed.
 *
 * Same client as the counter and the till (`@kiosk/core`), same words for the states, so an invoice reads identically
 * whoever opens it.
 */
export function InvoicesScreen({ api, branchId }: { api: ApiClient; branchId: string }) {
  const [invoices, setInvoices] = useState<GroceryInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await api.get<unknown>(invoicesPath(branchId));
      const read = readInvoices(raw);
      if (!read) {
        setFailed('The server sent something this app could not read.');
        return;
      }
      setInvoices(sortInvoices(read));
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error && error.message ? error.message : 'Could not read the invoices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.fill}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={MART.fallbackPrimary} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(invoice) => invoice.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={MART.inkQuiet}
            />
          }
          ListHeaderComponent={
            failed ? (
              <Pressable onPress={() => void load()} style={styles.problem} accessibilityRole="button">
                <Ionicons name="alert-circle-outline" size={15} color={MART.danger} />
                <MartText variant="meta" color={MART.danger} numberOfLines={2} style={styles.problemText}>
                  {failed}
                </MartText>
                <MartText variant="meta" color={MART.danger}>
                  Retry
                </MartText>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            failed ? null : (
              <View style={styles.center}>
                <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyWords}>
                  No counter invoices yet. Ones your staff send to the till appear here, with what is still owed.
                </MartText>
              </View>
            )
          }
          renderItem={({ item }) => <InvoiceRow invoice={item} />}
        />
      )}
    </View>
  );
}

function InvoiceRow({ invoice }: { invoice: GroceryInvoice }) {
  const waiting = invoice.state === 'pending_payment';
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <MartText variant="label" numberOfLines={1} style={styles.rowTitle}>
          {invoice.code ? invoice.code : invoice.id.slice(0, 8)}
        </MartText>
        <MartText variant="label">{invoice.totalCents === null ? '—' : formatKes(invoice.totalCents)}</MartText>
      </View>
      <View style={styles.rowBottom}>
        <View style={[styles.pill, { backgroundColor: waiting ? tint(MART.fallbackPrimary, 0.14) : MART.paperSunken }]}>
          <MartText variant="shelf" color={waiting ? MART.fallbackPrimaryLift : MART.inkMuted}>
            {stateWords[invoice.state]}
          </MartText>
        </View>
        <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
          {invoice.lineCount ? `${invoice.lineCount} ${invoice.lineCount === 1 ? 'line' : 'lines'}` : ''}
        </MartText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  list: { padding: 12, gap: 8, paddingBottom: 40 },
  center: { paddingTop: 60, alignItems: 'center' },
  emptyWords: { textAlign: 'center', maxWidth: 300, lineHeight: 19 },
  row: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    ...SHADOW.card,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  rowTitle: { flex: 1 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 12, backgroundColor: tint(MART.danger, 0.08), marginBottom: 8 },
  problemText: { flex: 1 },
});
