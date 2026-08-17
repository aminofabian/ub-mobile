import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { Button, Text } from '@kiosk/ui';
import { useTenant } from '../lib/TenantContext';
import { addOrder } from '../lib/orderHistory';
import { useCart } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

export function CheckoutScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const { cart, cartId } = useCart(tenant.slug);
  const checkout = useCheckout(tenant.slug, cartId ?? undefined);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      notes: '',
    },
  });

  async function onSubmit(data: CheckoutForm) {
    try {
      const response = await checkout.mutateAsync({
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || undefined,
        notes: data.notes || undefined,
      });

      await addOrder({
        orderId: response.orderId,
        slug: tenant.slug,
        grandTotal: response.grandTotal,
        currency: response.currency,
        customerPhone: data.customerPhone,
        createdAt: new Date().toISOString(),
      });

      navigation.replace('Payment', {
        orderId: response.orderId,
        grandTotal: response.grandTotal,
        currency: response.currency,
        customerPhone: data.customerPhone,
      });
    } catch (err) {
      // error handled by checkout.error
    }
  }

  if (!cart) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="h1">Checkout</Text>

      <View style={styles.summary}>
        <Text variant="h2">Order Summary</Text>
        <Text variant="body">
          {cart.lines?.length ?? 0} items · {cart.currency} {cart.subtotal?.toFixed(2)}
        </Text>
      </View>

      <View style={styles.form}>
        <Text variant="h2">Customer Details</Text>

        <Controller
          control={control}
          name="customerName"
          rules={{ required: 'Name is required', minLength: { value: 2, message: 'Name too short' } }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              accessibilityLabel="Full name"
            />
          )}
        />
        {errors.customerName && <Text style={styles.error}>{errors.customerName.message}</Text>}

        <Controller
          control={control}
          name="customerPhone"
          rules={{ required: 'Phone number is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="phone-pad"
              accessibilityLabel="Phone number"
            />
          )}
        />
        {errors.customerPhone && <Text style={styles.error}>{errors.customerPhone.message}</Text>}

        <Controller
          control={control}
          name="customerEmail"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="Email (optional)"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email"
            />
          )}
        />

        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Delivery notes (optional)"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={4}
              accessibilityLabel="Delivery notes"
            />
          )}
        />
      </View>

      {checkout.error && (
        <Text style={styles.error}>
          {checkout.error instanceof Error ? checkout.error.message : 'Checkout failed'}
        </Text>
      )}

      <Button
        title={checkout.isPending ? 'Placing Order...' : 'Place Order'}
        onPress={handleSubmit(onSubmit)}
        disabled={checkout.isPending}
        style={styles.button}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  form: {
    marginVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 12,
    minHeight: 48,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    color: '#dc3545',
    marginTop: 8,
  },
  button: {
    marginTop: 24,
  },
});
