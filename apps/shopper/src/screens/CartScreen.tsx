import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Text, Button } from '@kiosk/ui';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function CartScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const { cart, isLoading } = useCart(tenant.slug);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  if (!cart?.lines || cart.lines.length === 0) {
    return (
      <View style={styles.centered}>
        <Text variant="h1">Cart</Text>
        <Text variant="body">Your cart is currently empty.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="h1" style={styles.header}>
        My Cart
      </Text>
      {cart.lines.map((line) => (
        <View key={line.itemId} style={styles.line}>
          <Image source={{ uri: line.imageUrl ?? undefined }} style={styles.thumbnail} />
          <View style={styles.lineInfo}>
            <Text style={styles.name}>{line.name}</Text>
            <Text variant="muted">
              {line.quantity} × {cart.currency} {line.unitPrice?.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.lineTotal}>
            {cart.currency} {line.lineTotal?.toFixed(2)}
          </Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text variant="h2">Subtotal: {cart.currency} {cart.subtotal?.toFixed(2)}</Text>
        <Button
          title="Checkout"
          onPress={() => navigation.navigate('Checkout')}
          style={styles.checkoutButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 16,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  lineInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  lineTotal: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 16,
  },
  checkoutButton: {
    marginTop: 16,
  },
});
