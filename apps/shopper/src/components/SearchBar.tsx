import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE, TYPE } from '../theme/mart';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onBarcodePress?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  accent?: string;
}

export function SearchBar({
  value,
  onChangeText,
  onBarcodePress,
  placeholder = 'Search products...',
  autoFocus = false,
  accent = MART.fallbackPrimary,
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Ionicons name="search" size={18} color={MART.inkQuiet} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={MART.inkQuiet}
          value={value}
          onChangeText={onChangeText}
          autoFocus={autoFocus}
          returnKeyType="search"
          accessibilityLabel="Search products"
        />
        {value.length > 0 ? (
          <Pressable
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            style={styles.clear}
          >
            <Ionicons name="close-circle" size={18} color={MART.inkQuiet} />
          </Pressable>
        ) : null}
      </View>
      {onBarcodePress ? (
        <Pressable
          onPress={onBarcodePress}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode"
          style={[styles.scan, { backgroundColor: accent }]}
        >
          <Ionicons name="barcode-outline" size={22} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginHorizontal: GUTTER,
    marginBottom: SPACE.md,
  },
  field: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
  },
  input: {
    ...TYPE.body,
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    color: MART.ink,
  },
  clear: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scan: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
