import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '@kiosk/ui';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirmation'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function OrderConfirmationScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const { orderId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="h1" style={styles.title}>
          Order Confirmed
        </Text>
        <Text variant="body" style={styles.message}>
          Thank you for your order!
        </Text>
        <View style={styles.orderBox}>
          <Text variant="muted">Order Number</Text>
          <Text variant="h2" style={styles.orderId}>
            {orderId}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Continue Shopping" onPress={() => navigation.navigate('MainTabs')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#28a745',
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: 8,
  },
  orderBox: {
    marginTop: 32,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  orderId: {
    marginTop: 8,
  },
  footer: {
    marginTop: 'auto',
  },
});
