import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { ChipButton } from './Capsule';

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
  placeholder = 'Search the shop',
  autoFocus = false,
  accent = MART.fallbackAccent,
}: SearchBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <Ionicons name="search" size={20} color={MART.ink} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={MART.inkQuiet}
          selectionColor={MART.ink}
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
            <Ionicons name="close-circle" size={20} color={MART.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {onBarcodePress ? (
        <ChipButton
          icon="barcode-outline"
          label="Scan a barcode"
          onPress={onBarcodePress}
          fill={accent}
          size={52}
        />
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
    height: 52,
    paddingLeft: SPACE.lg,
    paddingRight: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
  },
  input: {
    ...TYPE.body,
    flex: 1,
    height: 52,
    lineHeight: undefined,
    color: MART.ink,
  },
  clear: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
