import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller, type Control, type FieldErrors } from 'react-hook-form';
import { useTenant } from '../lib/TenantContext';
import { addOrder } from '../lib/orderHistory';
import { useCart } from '../hooks/useCart';
import { useCheckout } from '../hooks/useCheckout';
import { CartLinesSkeleton } from '../components/Skeleton';
import { looksLikeKenyanMobile } from '../lib/phone';
import { loadShopperProfile } from '../lib/shopper-profile';
import { formatMoney } from '../lib/media';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
}

function Field({
  control,
  errors,
  name,
  label,
  hint,
  placeholder,
  optional,
  multiline,
  keyboardType,
  autoCapitalize,
  rules,
}: {
  control: Control<CheckoutForm>;
  errors: FieldErrors<CheckoutForm>;
  name: keyof CheckoutForm;
  label: string;
  hint?: string;
  placeholder: string;
  optional?: boolean;
  multiline?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  rules?: React.ComponentProps<typeof Controller<CheckoutForm>>['rules'];
}) {
  const [focused, setFocused] = useState(false);
  const message = errors[name]?.message;

  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {optional ? <Text style={styles.fieldOptional}>Optional</Text> : null}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              multiline && styles.textArea,
              focused && styles.inputFocused,
              Boolean(message) && styles.inputError,
            ]}
            placeholder={placeholder}
            placeholderTextColor={MART.inkQuiet}
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            multiline={multiline}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            accessibilityLabel={label}
          />
        )}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function CheckoutScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { cart, cartId } = useCart(tenant.slug);
  const checkout = useCheckout(tenant.slug, cartId ?? undefined);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      notes: '',
    },
  });

  useEffect(() => {
    void loadShopperProfile().then((profile) => {
      if (!profile) return;
      reset({
        customerName: profile.name,
        customerPhone: profile.phone,
        customerEmail: profile.email,
        notes: profile.shipping,
      });
    });
  }, [reset]);

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
    } catch {
      // Surfaced through checkout.error below.
    }
  }

  if (!cart) {
    return (
      <View style={styles.shell}>
        <CartLinesSkeleton />
      </View>
    );
  }

  const currency = cart.currency ?? 'KES';
  const lineCount = cart.lines?.length ?? 0;

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            {lineCount} {lineCount === 1 ? 'line' : 'lines'} from {mart.displayName}
          </Text>
          <Text style={styles.summaryTotal}>{formatMoney(currency, cart.subtotal ?? 0)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Who is collecting?</Text>

        <Field
          control={control}
          errors={errors}
          name="customerName"
          label="Full name"
          placeholder="e.g. Amina Wanjiru"
          rules={{
            required: 'Add a name so the counter knows who to call.',
            minLength: { value: 2, message: 'That name looks too short.' },
          }}
        />

        <Field
          control={control}
          errors={errors}
          name="customerPhone"
          label="Phone number"
          hint="We send the M-Pesa prompt and pickup updates here."
          placeholder="0712 345 678"
          keyboardType="phone-pad"
          rules={{
            required: 'We need a phone number to reach you.',
            validate: (value: string) =>
              looksLikeKenyanMobile(value) || 'Enter a Kenyan mobile, e.g. 0712 345 678.',
          }}
        />

        <Field
          control={control}
          errors={errors}
          name="customerEmail"
          label="Email"
          placeholder="you@example.com"
          optional
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          control={control}
          errors={errors}
          name="notes"
          label="Estate / notes"
          hint="Saved from your store card. Change it if this order goes elsewhere."
          placeholder="Estate, street, anything the rider should know"
          optional
          multiline
        />

        {checkout.error ? (
          <Text accessibilityLiveRegion="polite" style={styles.submitError}>
            {checkout.error instanceof Error
              ? checkout.error.message
              : 'We could not place the order. Try again in a moment.'}
          </Text>
        ) : null}

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={checkout.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: mart.primary },
            checkout.isPending && styles.ctaBusy,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaLabel}>
            {checkout.isPending ? 'Placing order…' : 'Place order'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
  },
  summary: {
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  summaryLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  summaryTotal: {
    ...TYPE.title,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  sectionTitle: {
    ...TYPE.heading,
    marginTop: SPACE.xxl,
    color: MART.ink,
  },
  field: {
    marginTop: SPACE.xl,
  },
  fieldHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  fieldLabel: {
    ...TYPE.label,
    fontWeight: '700',
    color: MART.ink,
  },
  fieldOptional: {
    ...TYPE.meta,
    color: MART.inkQuiet,
  },
  fieldHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  input: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    minHeight: 50,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    color: MART.ink,
  },
  inputFocused: {
    borderColor: MART.borderStrong,
  },
  inputError: {
    borderColor: MART.danger,
  },
  textArea: {
    minHeight: 96,
    paddingTop: SPACE.md,
    textAlignVertical: 'top',
  },
  fieldError: {
    ...TYPE.meta,
    marginTop: SPACE.xs,
    color: MART.danger,
  },
  submitError: {
    ...TYPE.body,
    marginTop: SPACE.xl,
    color: MART.danger,
  },
  cta: {
    marginTop: SPACE.xxl,
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBusy: {
    opacity: 0.7,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
