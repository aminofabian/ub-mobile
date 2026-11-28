import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { stepFeel } from '../lib/haptics';
import { GUTTER, MART, onFill, RADIUS, SPACE, TYPE } from '../theme/mart';
import { Field } from './Field';
import { SheetPanel } from './SheetPanel';

interface Props {
  /** The areas the shop delivers to, as the shop spells them. */
  areas: readonly string[];
  value: string;
  onChange: (area: string) => void;
  error?: string;
  accent: string;
  onLayout?: (y: number) => void;
}

/** The shop's delivery areas as a list to choose from. Typing is not allowed to make up an area. */
export function AreaPicker({ areas, value, onChange, error, accent, onLayout }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const on = onFill(accent);

  const shown = useMemo(() => {
    const wanted = query.trim().toLowerCase();
    return wanted ? areas.filter((area) => area.toLowerCase().includes(wanted)) : [...areas];
  }, [areas, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View onLayout={(event) => onLayout?.(event.nativeEvent.layout.y)}>
      <Text style={styles.label}>Area</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `Area: ${value}. Change` : 'Choose your area'}
        style={({ pressed }) => [styles.input, Boolean(error) && styles.inputError, pressed && styles.pressed]}
      >
        <Ionicons name="location-outline" size={20} color={MART.inkMuted} />
        <Text style={[styles.inputText, !value && styles.placeholder]} numberOfLines={1}>
          {value || 'Choose your area'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={MART.ink} />
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
        <SheetPanel title="Where should it go?" onClose={close} style={styles.sheet}>
          {areas.length > 8 ? (
            <Field
              containerStyle={styles.search}
              icon="search"
              placeholder="Search areas"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              accessibilityLabel="Search areas"
            />
          ) : null}
          <View style={styles.list}>
            <FlatList
              data={shown}
              keyExtractor={(area) => area}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={Divider}
              ListEmptyComponent={<Text style={styles.empty}>No area matches that.</Text>}
              renderItem={({ item }) => {
                const selected = item.toLowerCase() === value.trim().toLowerCase();
                return (
                  <Pressable
                    onPress={() => {
                      stepFeel();
                      onChange(item);
                      close();
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <Text style={[styles.rowText, selected && styles.rowTextOn]}>{item}</Text>
                    {selected ? (
                      <View style={[styles.check, { backgroundColor: accent }]}>
                        <Ionicons name="checkmark" size={16} color={on.primary} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </SheetPanel>
      </Modal>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  label: {
    ...TYPE.label,
    marginBottom: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.ink,
  },
  input: {
    minHeight: 54,
    paddingHorizontal: SPACE.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paper,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  inputError: {
    borderColor: MART.danger,
  },
  pressed: {
    backgroundColor: MART.paperSunken,
  },
  inputText: {
    ...TYPE.body,
    flex: 1,
    color: MART.ink,
  },
  placeholder: {
    color: MART.inkQuiet,
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.danger,
  },
  sheet: {
    flex: 1,
  },
  search: {
    marginHorizontal: GUTTER,
    marginBottom: SPACE.md,
  },
  list: {
    flex: 1,
    marginHorizontal: GUTTER,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  rowPressed: {
    backgroundColor: MART.paperSunken,
  },
  rowText: {
    ...TYPE.body,
    flex: 1,
    color: MART.ink,
  },
  rowTextOn: {
    fontFamily: TYPE.heading.fontFamily,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginLeft: SPACE.lg,
    backgroundColor: MART.border,
  },
  empty: {
    ...TYPE.body,
    padding: SPACE.lg,
    color: MART.inkMuted,
  },
});
