import React from 'react';
import { StyleSheet, View, Share } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Receipt'>;

export function ReceiptScreen({ navigation }: Props) {
  const { lastSale } = usePosStore();

  const shareReceipt = async () => {
    const lines = lastSale?.items?.map(
      (i) => `${i.itemId}: ${i.quantity} x ${i.unitPrice} = ${i.lineTotal}`
    );
    await Share.share({
      message: `Sale ${lastSale?.id}\nTotal: ${lastSale?.grandTotal}\n${lines?.join('\n') ?? ''}`,
    });
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Sale complete</Text>
      <Card style={styles.card}>
        <Text variant="body">Sale ID: {lastSale?.id ?? '—'}</Text>
        <Text variant="h2">Total: {lastSale?.grandTotal?.toFixed(2) ?? '0.00'}</Text>
        <Text variant="body">Status: {lastSale?.status ?? 'completed'}</Text>
      </Card>
      <Button title="Share receipt" onPress={shareReceipt} />
      <Button
        title="New sale"
        variant="secondary"
        onPress={() => navigation.navigate('Pos')}
        style={styles.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  card: { marginVertical: theme.spacing.lg },
  action: { marginTop: theme.spacing.sm },
});
