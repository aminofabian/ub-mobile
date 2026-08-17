import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '@kiosk/ui';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onBarcodePress?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onBarcodePress,
  placeholder = 'Search products...',
  autoFocus = false,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus={autoFocus}
        accessibilityLabel="Search products"
      />
      {onBarcodePress && (
        <TouchableOpacity
          style={styles.barcodeButton}
          onPress={onBarcodePress}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
        >
          <Text style={styles.barcodeText}>▯</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    minHeight: 48,
  },
  barcodeButton: {
    marginLeft: 8,
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
});
