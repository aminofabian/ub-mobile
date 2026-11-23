import React, { useMemo } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { buildSaleSummary } from '../lib/sale-summary';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Receipt'> & {
  shopName: string;
};

/**
 * The sale just taken, in words. This is a summary of what the server recorded, not the shop's official receipt: that
 * is made by the server (PDF or thermal print) and needs a printer or sharing library this app does not have yet.
 */
export function ReceiptScreen({ navigation, route, shopName }: Props) {
  const { lastSale } = usePosStore();
  const summary = useMemo(
    () =>
      lastSale
        ? buildSaleSummary(lastSale, {
            shopName,
            soldAt: route.params?.soldAt,
            changeCents: route.params?.changeCents,
          })
        : null,
    [lastSale, shopName, route.params?.soldAt, route.params?.changeCents]
  );

  const shareSummary = async () => {
    if (summary) await Share.share({ message: summary.text });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="h1">Sale complete</Text>
      {summary ? (
        <>
          {summary.change ? (
            <Card style={styles.card}>
              <Text variant="h1">Change: {summary.change}</Text>
            </Card>
          ) : null}
          <Card style={styles.card}>
            <Text variant="h2">{summary.heading}</Text>
            {summary.items.map((item, index) => (
              <View key={`${index}-${item.name}`} style={styles.row}>
                <View style={styles.grow}>
                  <Text variant="body">{item.name}</Text>
                  <Text variant="muted">{item.detail}</Text>
                </View>
                <Text variant="body">{item.total}</Text>
              </View>
            ))}
            <View style={[styles.row, styles.totalRow]}>
              <Text variant="h2">Total</Text>
              <Text variant="h2">{summary.total}</Text>
            </View>
            {summary.payments.map((payment, index) => (
              <View key={`${index}-${payment.label}`} style={styles.row}>
                <Text variant="body">
                  {payment.label}
                  {payment.reference ? ` (${payment.reference})` : ''}
                </Text>
                <Text variant="body">{payment.amount}</Text>
              </View>
            ))}
            {summary.soldBy ? <Text variant="muted">Sold by {summary.soldBy}</Text> : null}
          </Card>
          <Text variant="muted" style={styles.note}>
            This is a summary of the sale, not the official receipt.
          </Text>
          <Button title="Share summary" variant="secondary" onPress={() => void shareSummary()} />
        </>
      ) : (
        <Text variant="muted">There is no sale to show.</Text>
      )}
      <Button title="New sale" onPress={() => navigation.navigate('Pos')} style={styles.action} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
  },
  card: { marginVertical: theme.spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginVertical: theme.spacing.xs,
  },
  grow: { flex: 1 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
  },
  note: { marginBottom: theme.spacing.md },
  action: { marginTop: theme.spacing.md },
});
