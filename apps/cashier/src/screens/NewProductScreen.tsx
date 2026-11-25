import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import {
  createCategory,
  createSupplier,
  fetchCategories,
  fetchItemTypes,
  fetchSuppliers,
  linkItemSupplier,
  markWeighed,
  quickCreateItem,
  type Category,
  type Supplier,
} from '../api/pos-api';
import type { CartItem } from '../lib/cart';
import { CREATE_WAIT_MS, createProduct, leftUnweighedNotice, lookForItNotice, markAsWeighed, type CreateOutcome } from '../lib/create-flow';
import { CHECK_WAIT_MS, waitFor } from '../lib/reach';
import { mayCreateProduct, mayMarkWeighed } from '../lib/shop-flags';
import type { TillPerson } from '../lib/till-person';
import { PickerField } from '../components/PickerField';
import {
  checkProduct,
  EMPTY_FORM,
  type ItemType,
  type ProductField,
  type ProductForm,
} from '../lib/quick-product';
import { usePosStore } from '../store/pos-store';
import { reachSink } from '../store/reach-store';
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
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ field: ProductField | null; words: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [doubt, setDoubt] = useState<string | null>(null);
  const [unweighed, setUnweighed] = useState<{ made: CartItem; words: string } | null>(null);
  const here = useRef(true);
  useEffect(
    () => () => {
      here.current = false;
    },
    []
  );

  useEffect(() => {
    let alive = true;
    fetchItemTypes(api).then(
      (read) => {
        if (!alive) return;
        setTypes(read);
        const only = read.length === 1 ? read[0] : undefined;
        if (only) setForm((now) => ({ ...now, typeId: now.typeId ?? only.id }));
      },
      () => {
        if (alive) setTypesFailed(true);
      }
    );
    // Categories and suppliers are a help, not a gate: a failure just leaves the list empty, and the product still saves.
    fetchCategories(api).then((read) => alive && setCategories(read), () => alive && setCategories([]));
    fetchSuppliers(api).then((read) => alive && setSuppliers(read), () => alive && setSuppliers([]));
    return () => {
      alive = false;
    };
  }, [api]);

  const change = (patch: Partial<ProductForm>) => setForm((now) => ({ ...now, ...patch }));
  const at = (field: ProductField) => (problem?.field === field ? problem.words : null);

  const backToTill = (params: CashierStackParamList['Pos']) => navigation.popTo('Pos', params);

  const finish = (outcome: CreateOutcome, name: string) => {
    if (!here.current) return;
    switch (outcome.kind) {
      case 'done': {
        const shelf = usePosStore.getState();
        shelf.setItems([outcome.item, ...shelf.items.filter((item) => item.id !== outcome.item.id)]);
        // Link the chosen supplier to the new product. Best-effort: the product is already saved, so a failed link
        // never blocks selling — the owner can set the supplier later.
        if (supplierId) void linkItemSupplier(api, outcome.item.id, supplierId).catch(() => undefined);
        backToTill({ notice: outcome.notice });
        return;
      }
      case 'refused':
        setProblem({ field: null, words: outcome.words });
        return;
      case 'unknown':
        setDoubt(`${outcome.words} Its name is ${name}.`);
        return;
      case 'weight':
        setUnweighed({ made: outcome.made, words: outcome.words });
    }
  };

  const save = async () => {
    if (saving || doubt !== null || unweighed !== null) return;
    const check = checkProduct(form, branchId, types ?? []);
    if (!check.ok) {
      setProblem({ field: check.field, words: check.words });
      return;
    }
    setProblem(null);
    setSaving(true);
    try {
      const outcome = await createProduct({
        body: check.body,
        byWeight: check.byWeight,
        create: (body) => waitFor(() => quickCreateItem(api, body), CREATE_WAIT_MS, reachSink),
        mark: (itemId) => waitFor(async () => void (await markWeighed(api, itemId)), CHECK_WAIT_MS, reachSink),
      });
      finish(outcome, check.body.name);
    } finally {
      if (here.current) setSaving(false);
    }
  };

  const tryMarkingAgain = async () => {
    if (saving || !unweighed) return;
    setSaving(true);
    try {
      const outcome = await markAsWeighed(unweighed.made, (itemId) =>
        waitFor(async () => void (await markWeighed(api, itemId)), CHECK_WAIT_MS, reachSink)
      );
      if (outcome.kind === 'weight' && here.current) setUnweighed({ made: outcome.made, words: outcome.words });
      else finish(outcome, unweighed.made.name);
    } finally {
      if (here.current) setSaving(false);
    }
  };

  const leaveUnweighed = () => {
    if (!unweighed) return;
    const shelf = usePosStore.getState();
    shelf.setItems([unweighed.made, ...shelf.items.filter((item) => item.id !== unweighed.made.id)]);
    backToTill({ notice: leftUnweighedNotice(unweighed.made.name) });
  };

  const lookForIt = () => {
    const name = form.name.trim();
    backToTill({ notice: lookForItNotice(name), search: name });
  };

  if (!mayCreate) {
    return (
      <View style={styles.denied}>
        <Ionicons name="lock-closed-outline" size={36} color={MART.inkQuiet} />
        <MartText variant="heading" style={styles.center}>
          Not allowed
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.center}>
          Your role cannot add products from the till. Ask the owner to allow it.
        </MartText>
      </View>
    );
  }

  const blocked = saving || doubt !== null || unweighed !== null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* BASICS */}
      <Section icon="cube-outline" title="Basics">
        <Field label="Product name" error={at('name')}>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(name) => change({ name })}
            placeholder="e.g. Maize flour 2kg"
            placeholderTextColor={MART.inkQuiet}
            maxLength={160}
            autoFocus
            accessibilityLabel="Product name"
          />
        </Field>

        <Field label="Kind of product" error={at('type')}>
          {types === null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              {typesFailed ? 'Could not load the kinds of product. Go back and try again.' : 'Loading…'}
            </MartText>
          ) : types.length === 0 ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              This shop has no kinds of product yet. The owner adds them on the web.
            </MartText>
          ) : (
            <PickerField
              value={form.typeId}
              choices={types}
              noun="kind"
              onChange={(typeId) => change({ typeId })}
            />
          )}
        </Field>

        {mayWeigh ? (
          <Pressable style={styles.switchRow} onPress={() => change({ byWeight: !form.byWeight })}>
            <View style={{ flex: 1 }}>
              <MartText variant="label">Sold by weight</MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                Priced per kilogram, weighed at the till
              </MartText>
            </View>
            <Switch value={form.byWeight} onValueChange={(byWeight) => change({ byWeight })} accessibilityLabel="Sold by weight" />
          </Pressable>
        ) : null}
      </Section>

      {/* PRICING */}
      <Section icon="pricetag-outline" title="Pricing">
        <Field label={form.byWeight ? 'Selling price per kg' : 'Selling price'} error={at('price')}>
          <MoneyInput value={form.price} onChangeText={(price) => change({ price })} label="Selling price" />
        </Field>
        <Field label="Cost (optional)" error={at('cost')} hint="What you pay for it — for the owner's margins.">
          <MoneyInput value={form.cost} onChangeText={(cost) => change({ cost })} label="Cost" />
        </Field>
      </Section>

      {/* STOCK & SUPPLY */}
      <Section icon="file-tray-stacked-outline" title="Stock & supply">
        <Field
          label={form.byWeight ? 'On the shelf now, in kg (optional)' : 'On the shelf now (optional)'}
          error={at('stock')}
          hint="Left empty, the shop starts it at 1."
        >
          <TextInput
            style={styles.input}
            value={form.stock}
            onChangeText={(stock) => change({ stock })}
            keyboardType="decimal-pad"
            placeholder={form.byWeight ? 'Kilograms' : 'How many'}
            placeholderTextColor={MART.inkQuiet}
            maxLength={10}
            accessibilityLabel="On the shelf now"
          />
        </Field>
        <Field label="Supplier (optional)">
          <PickerField
            value={supplierId}
            choices={suppliers ?? []}
            loading={suppliers === null}
            noneLabel="No supplier"
            noun="supplier"
            onChange={setSupplierId}
            onCreate={(name) => createSupplier(api, name)}
          />
        </Field>
      </Section>

      {/* CATEGORY */}
      <Section icon="albums-outline" title="Category">
        <Field label="Put it under a category (optional)">
          <PickerField
            value={form.categoryId}
            choices={categories ?? []}
            loading={categories === null}
            noneLabel="No category"
            noun="category"
            onChange={(categoryId) => change({ categoryId })}
            onCreate={(name) => createCategory(api, name)}
          />
        </Field>
      </Section>

      {/* BARCODE */}
      <Section icon="barcode-outline" title="Barcode">
        <Field label="Barcode (optional)" error={at('barcode')}>
          <TextInput
            style={styles.input}
            value={form.barcode}
            onChangeText={(barcode) => change({ barcode })}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
            placeholder="Scan or type the barcode"
            placeholderTextColor={MART.inkQuiet}
            maxLength={64}
            accessibilityLabel="Barcode"
          />
        </Field>
      </Section>

      {problem && problem.field === null ? (
        <View style={styles.banner}>
          <MartText variant="label" color={MART.danger}>
            {problem.words}
          </MartText>
        </View>
      ) : null}

      {unweighed ? (
        <View style={styles.actionCard}>
          <MartText variant="label" color={MART.danger}>
            {unweighed.words}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            Until it is marked, it would be charged per unit, not per kilogram.
          </MartText>
          <Primary label={saving ? 'Trying…' : 'Try again'} onPress={() => void tryMarkingAgain()} disabled={saving} />
          <Secondary label="Leave it as it is" onPress={leaveUnweighed} disabled={saving} />
        </View>
      ) : doubt !== null ? (
        <View style={styles.actionCard}>
          <MartText variant="label" color={MART.danger}>
            {doubt}
          </MartText>
          <Primary label="Look for it" onPress={lookForIt} />
        </View>
      ) : (
        <Primary label={saving ? 'Adding…' : 'Add product'} onPress={() => void save()} disabled={blocked} />
      )}
    </ScrollView>
  );
}

function Section({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color={MART.fallbackPrimary} />
        </View>
        <MartText variant="shelf" color={MART.inkQuiet}>
          {title.toUpperCase()}
        </MartText>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <MartText variant="label" color={MART.inkMuted}>
        {label}
      </MartText>
      {children}
      {error ? (
        <MartText variant="meta" color={MART.danger}>
          {error}
        </MartText>
      ) : hint ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          {hint}
        </MartText>
      ) : null}
    </View>
  );
}

/** A price input with a KES prefix. */
function MoneyInput({ value, onChangeText, label }: { value: string; onChangeText: (t: string) => void; label: string }) {
  return (
    <View style={styles.moneyRow}>
      <MartText variant="label" color={MART.inkQuiet} style={styles.moneyPrefix}>
        KES
      </MartText>
      <TextInput
        style={styles.moneyInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={MART.inkQuiet}
        maxLength={14}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primary, disabled && styles.dim]} accessibilityRole="button">
      {label.includes('…') ? <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} /> : null}
      <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
        {label}
      </MartText>
    </Pressable>
  );
}

function Secondary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.secondary, disabled && styles.dim]} accessibilityRole="button">
      <MartText variant="label" color={MART.ink}>
        {label}
      </MartText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { padding: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.lg },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: GUTTER, gap: SPACE.sm, backgroundColor: MART.paper },
  center: { textAlign: 'center' },
  section: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.md,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBody: { gap: SPACE.lg },
  field: { gap: SPACE.sm },
  input: {
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 50,
    fontSize: 15,
    color: MART.ink,
    backgroundColor: MART.paper,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 50,
    backgroundColor: MART.paper,
  },
  moneyPrefix: { marginRight: SPACE.sm },
  moneyInput: { flex: 1, fontSize: 15, color: MART.ink, paddingVertical: SPACE.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  banner: { backgroundColor: MART.dangerSurface, borderRadius: RADIUS.md, padding: SPACE.md },
  actionCard: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  primary: {
    minHeight: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  secondary: {
    minHeight: 50,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.55 },
});
