import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchItemTypes, markWeighed, quickCreateItem } from '../api/pos-api';
import type { CartItem } from '../lib/cart';
import { mayCreateProduct, mayMarkWeighed } from '../lib/shop-flags';
import type { TillPerson } from '../lib/till-person';
import {
  checkProduct,
  describeCreateFailure,
  EMPTY_FORM,
  weighedFailureWords,
  type ItemType,
  type ProductField,
  type ProductForm,
} from '../lib/quick-product';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'NewProduct'> & {
  api: ApiClient;
  branchId: string;
  person: TillPerson;
};

export function NewProductScreen({ navigation, route, api, branchId, person }: Props) {
  const flags = usePosStore((state) => state.flags);
  const mayCreate = mayCreateProduct(flags, person.permissions);
  const mayWeigh = mayMarkWeighed(flags, person.permissions);

  const [form, setForm] = useState<ProductForm>(() => ({ ...EMPTY_FORM, barcode: route.params?.barcode ?? '' }));
  const [types, setTypes] = useState<ItemType[] | null>(null);
  const [typesFailed, setTypesFailed] = useState(false);
  const [problem, setProblem] = useState<{ field: ProductField | null; words: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchItemTypes(api).then(
      (read) => {
        if (!alive) return;
        setTypes(read);
        // A shop with one kind of product has nothing to choose.
        const only = read.length === 1 ? read[0] : undefined;
        if (only) setForm((now) => ({ ...now, typeId: now.typeId ?? only.id }));
      },
      () => {
        if (alive) setTypesFailed(true);
      }
    );
    return () => {
      alive = false;
    };
  }, [api]);

  const change = (patch: Partial<ProductForm>) => setForm((now) => ({ ...now, ...patch }));
  const at = (field: ProductField) => (problem?.field === field ? problem.words : null);

  const save = async () => {
    if (saving) return;
    const check = checkProduct(form, branchId, types ?? []);
    if (!check.ok) {
      setProblem({ field: check.field, words: check.words });
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      const made = await quickCreateItem(api, check.body);
      let weighed = false;
      let afterwards = '';
      if (check.byWeight) {
        try {
          await markWeighed(api, made.id);
          weighed = true;
        } catch (error) {
          afterwards = ` ${weighedFailureWords(error)}`;
        }
      }
      // At the top of the list, ready to sell. It is not put in the basket: only the cashier knows how many.
      const ready: CartItem = weighed ? { ...made, weighed: true, unitType: 'kg' } : made;
      const shelf = usePosStore.getState();
      shelf.setItems([ready, ...shelf.items.filter((item) => item.id !== ready.id)]);
      navigation.navigate('Pos', { notice: `Added ${ready.name}. Tap it to sell it.${afterwards}` });
    } catch (error) {
      setProblem({ field: null, words: describeCreateFailure(error).words });
    } finally {
      setSaving(false);
    }
  };

  if (!mayCreate) {
    return (
      <View style={styles.container}>
        <Text variant="body">Your role is not allowed to add products from the till. Ask the owner to allow it.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="Name" error={at('name')}>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(name) => change({ name })}
          placeholder="Product name"
          maxLength={160}
          autoFocus
          accessibilityLabel="Product name"
        />
      </Field>

      <Field label="Kind of product" error={at('type')}>
        {types === null ? (
          <Text variant="muted">{typesFailed ? 'Could not load the kinds of product. Go back and try again.' : 'Loading...'}</Text>
        ) : types.length === 0 ? (
          <Text variant="muted">This shop has no kinds of product yet. The owner adds them on the web.</Text>
        ) : (
          <View style={styles.chips}>
            {types.map((type) => (
              <TouchableOpacity
                key={type.id}
                onPress={() => change({ typeId: type.id })}
                style={[styles.chip, form.typeId === type.id ? styles.chipOn : null]}
                accessibilityRole="button"
                accessibilityState={{ selected: form.typeId === type.id }}
              >
                <Text variant="body" style={form.typeId === type.id ? styles.chipOnText : undefined}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Field>

      {mayWeigh ? (
        <View style={styles.switchRow}>
          <Text variant="body" style={styles.switchLabel}>
            Sold by weight (price per kg)
          </Text>
          <Switch value={form.byWeight} onValueChange={(byWeight) => change({ byWeight })} accessibilityLabel="Sold by weight" />
        </View>
      ) : null}

      <Field label={form.byWeight ? 'Selling price per kg' : 'Selling price'} error={at('price')}>
        <TextInput
          style={styles.input}
          value={form.price}
          onChangeText={(price) => change({ price })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          maxLength={14}
          accessibilityLabel="Selling price"
        />
      </Field>

      <Field label={form.byWeight ? 'On the shelf now, in kg (optional)' : 'On the shelf now (optional)'} error={at('stock')}>
        <TextInput
          style={styles.input}
          value={form.stock}
          onChangeText={(stock) => change({ stock })}
          keyboardType="decimal-pad"
          placeholder={form.byWeight ? 'Kilograms' : 'How many'}
          maxLength={10}
          accessibilityLabel="On the shelf now"
        />
        <Text variant="muted">Left empty, the shop starts it at 1.</Text>
      </Field>

      <Field label="Cost (optional)" error={at('cost')}>
        <TextInput
          style={styles.input}
          value={form.cost}
          onChangeText={(cost) => change({ cost })}
          keyboardType="decimal-pad"
          placeholder="0.00"
          maxLength={14}
          accessibilityLabel="Cost"
        />
      </Field>

      <Field label="Barcode (optional)" error={at('barcode')}>
        <TextInput
          style={styles.input}
          value={form.barcode}
          onChangeText={(barcode) => change({ barcode })}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={64}
          accessibilityLabel="Barcode"
        />
      </Field>

      {problem && problem.field === null ? (
        <Text variant="body" style={styles.problem}>
          {problem.words}
        </Text>
      ) : null}
      <Button title={saving ? 'Adding...' : 'Add product'} onPress={() => void save()} disabled={saving} />
    </ScrollView>
  );
}

function Field({ label, error, children }: { label: string; error: string | null; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="caption">{label}</Text>
      {children}
      {error ? (
        <Text variant="caption" style={styles.problem}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.md },
  field: { gap: theme.spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 48,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipOnText: { color: '#ffffff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  switchLabel: { flex: 1 },
  problem: { color: theme.colors.danger },
});
