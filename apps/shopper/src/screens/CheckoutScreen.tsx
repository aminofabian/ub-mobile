import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AreaPicker } from '../components/AreaPicker';
import { Capsule } from '../components/Capsule';
import { Field } from '../components/Field';
import { StateBlock } from '../components/StateBlock';
import { failFeel, stepFeel } from '../lib/haptics';
import { CartLinesSkeleton } from '../components/Skeleton';
import { useCart } from '../hooks/useCart';
import { useCheckoutShop } from '../hooks/useCheckoutShop';
import { useSession } from '../hooks/useSession';
import { syncNote, totalText, notReadyText } from '../lib/basket-copy';
import {
  applyAddress,
  applyContact,
  blankValues,
  planOrder,
  rememberByDefault,
  resolvePaymentChoice,
  type CheckoutErrors,
  type CheckoutValues,
  type FieldKey,
  type OrderPlan,
} from '../lib/checkout-form';
import { clearDraft, loadAddressBook, loadDraft, saveAddressBook, saveDraft } from '../lib/checkout-memory';
import { parseOrderNotes } from '../lib/checkout-notes';
import type { DoubtRecord } from '../lib/checkout-outcome';
import type { PlacedOrder, PlaceResult } from '../lib/checkout-run';
import { describePlace, fulfilmentChoices, type Fulfilment } from '../lib/delivery-areas';
import { formatMoney } from '../lib/media';
import { addOrder } from '../lib/orderHistory';
import { toKenyanLocal07 } from '../lib/phone';
import {
  pickPrefill,
  rememberAddress,
  rememberContact,
  usableFirst,
  type AddressBook,
  type SavedAddress,
} from '../lib/saved-addresses';
import { loadShopperProfile, type ShopperProfile } from '../lib/shopper-profile';
import { useTenant } from '../lib/TenantContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { FONT, GUTTER, MART, martFromTenant, onFill, RADIUS, SPACE, TILE, TYPE } from '../theme/mart';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Notice = { tone: 'error' | 'info'; text: string; toBasket?: boolean };
type DoubtState = { phase: 'unsure' | 'probably-placed'; record: DoubtRecord; note?: string };

/** What happens after the order, whichever way the answer reached the phone. */
interface Landing {
  payLater: boolean;
  pickup: boolean;
  phone: string;
  remember: OrderPlan['remember'];
}

const FIELD_ORDER: FieldKey[] = ['name', 'phone', 'email', 'whatsApp', 'area', 'street', 'deliveryNotes', 'form'];
const SECTION_OF: Partial<Record<FieldKey, 'contact' | 'delivery'>> = {
  name: 'contact',
  phone: 'contact',
  email: 'contact',
  whatsApp: 'contact',
  area: 'delivery',
  street: 'delivery',
  deliveryNotes: 'delivery',
};

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** One line of the form, inside a white tile. `onLayout` reports where it sits in that tile. */
function FormField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  optional,
  multiline,
  keyboardType,
  autoCapitalize,
  maxLength,
  onLayout,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  hint?: string;
  placeholder: string;
  optional?: boolean;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  onLayout?: (y: number) => void;
}) {
  return (
    <View onLayout={(event) => onLayout?.(event.nativeEvent.layout.y)}>
      <Field
        on="tile"
        label={optional ? `${label} (optional)` : label}
        accessibilityLabel={label}
        hint={hint}
        error={error}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  );
}

/** The round mark at the leading edge of a choice: filled with the shop's colour when chosen. */
function Check({ on, accent }: { on: boolean; accent: string }) {
  return (
    <View style={[styles.check, on && { backgroundColor: accent, borderColor: accent }]}>
      {on ? <Ionicons name="checkmark" size={16} color={onFill(accent).primary} /> : null}
    </View>
  );
}

function Choice({
  label,
  hint,
  selected,
  disabled,
  onPress,
  accent,
  ruled,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  accent: string;
  /** Draw the divider above this row. */
  ruled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!selected) stepFeel();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      style={[styles.choice, ruled && styles.choiceRuled, disabled && styles.choiceDisabled]}
    >
      <Check on={selected} accent={accent} />
      <View style={styles.choiceBody}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {hint ? <Text style={styles.choiceHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export function CheckoutScreen() {
  const tenant = useTenant();
  const slug = tenant.slug;
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { lines, view, refusedCount, isLoading, offline, retryNow, session } = useCart(slug);
  const { signedIn, tokenLoading } = useSession();
  const known = useCheckoutShop(slug);
  const { shop } = known;
  const scrollRef = useRef<ScrollView>(null);
  const spots = useRef<Record<string, number>>({});
  const sections = useRef<Record<string, number>>({});

  const [book, setBook] = useState<AddressBook | null>(null);
  const [profile, setProfile] = useState<ShopperProfile | null | undefined>(undefined);
  const [draft, setDraft] = useState<CheckoutValues | null | undefined>(undefined);
  const [values, setValues] = useState<CheckoutValues | null>(null);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [changed, setChanged] = useState<{ was: number; now: number } | null>(null);
  const [doubt, setDoubt] = useState<DoubtState | null>(null);
  const [working, setWorking] = useState(false);

  // What was kept on the phone, and any order still waiting to be settled from an earlier visit.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadAddressBook(slug),
      loadShopperProfile(),
      loadDraft(slug, new Date()),
      session ? session.checkout.pending() : Promise.resolve(null),
    ]).then(([savedBook, savedProfile, savedDraft, pending]) => {
      if (cancelled) return;
      setBook(savedBook);
      setProfile(savedProfile);
      setDraft(savedDraft);
      if (pending) setDoubt({ phase: 'unsure', record: pending });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, session]);

  // Opening checkout is a good moment to tell the shop about the basket, so it is ready when asked to order.
  useFocusEffect(
    useCallback(() => {
      void retryNow();
    }, [retryNow]),
  );

  const areaObjects = useMemo(
    () => (shop.areaNames === null ? null : shop.areaNames.map((name) => ({ name, active: true }))),
    [shop.areaNames],
  );
  const choices = useMemo(() => fulfilmentChoices(areaObjects), [areaObjects]);

  // The form starts once everything it starts from is known: the shop's areas (or that they are not known),
  // who is signed in, and what was kept. A form left half-filled within the day comes back as it was.
  useEffect(() => {
    if (values || known.loading || tokenLoading || book === null || profile === undefined || draft === undefined) return;
    let next: CheckoutValues = draft ?? blankValues(choices.initial, rememberByDefault(signedIn));
    if (!draft) {
      const fromProfile = profile ? { name: profile.name, phone: profile.phone, email: profile.email, whatsApp: '' } : null;
      next = applyContact(next, book.contact ?? fromProfile);
      if (next.fulfilment === 'delivery') {
        const address = pickPrefill(book, shop.areaNames);
        if (address) next = applyAddress(next, address);
        else if (profile?.shipping) next = { ...next, street: profile.shipping };
      }
    }
    if (!choices.canDeliver && next.fulfilment === 'delivery') next = { ...next, fulfilment: 'pickup' };
    setValues(next);
  }, [values, known.loading, tokenLoading, book, profile, draft, choices, signedIn, shop.areaNames]);

  // A shop with one area has nothing to choose.
  useEffect(() => {
    if (!values || values.fulfilment !== 'delivery' || values.area || shop.areaNames?.length !== 1) return;
    setValues({ ...values, area: shop.areaNames[0] });
  }, [values, shop.areaNames]);

  // The form is kept as it is typed, so a call, a lost signal or a closed app does not lose it.
  useEffect(() => {
    if (!values) return;
    const timer = setTimeout(() => void saveDraft(slug, values, new Date()), 600);
    return () => clearTimeout(timer);
  }, [values, slug]);

  const patchValues = useCallback((patch: Partial<CheckoutValues>) => {
    setValues((current) => (current ? { ...current, ...patch } : current));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[key as FieldKey];
      delete next.form;
      return next;
    });
    setNotice(null);
  }, []);

  // An error notice or an unanswered order is felt as well as read.
  const trouble = notice?.tone === 'error' || Boolean(doubt);
  useEffect(() => {
    if (trouble) failFeel();
  }, [trouble]);

  const where = (key: string) => (y: number) => {
    spots.current[key] = y;
  };

  function showErrors(found: CheckoutErrors) {
    failFeel();
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (!first) return;
    const section = SECTION_OF[first];
    if (!section) {
      scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    const y = (sections.current[section] ?? 0) + (spots.current[first] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }

  const payment = values
    ? resolvePaymentChoice({ hasOnlinePay: shop.hasOnlinePay, touched: values.paymentTouched, choice: values.payment })
    : 'mpesa';
  const total = totalText(view, formatMoney);
  const note = syncNote({ waiting: view.waiting, offline, refused: refusedCount });

  async function finish(order: PlacedOrder, landing: Landing) {
    const phone = toKenyanLocal07(landing.phone) ?? landing.phone.trim();
    await addOrder({
      orderId: order.orderId,
      orderCode: order.orderCode,
      slug,
      grandTotal: order.grandTotal,
      currency: order.currency,
      customerPhone: phone,
      createdAt: order.createdAt ?? new Date().toISOString(),
    }).catch(() => undefined);
    if (landing.remember) {
      const current = book ?? (await loadAddressBook(slug));
      let next = rememberContact(current, landing.remember.contact);
      if (landing.remember.address) {
        next = rememberAddress(next, { ...landing.remember.address, makeDefault: true }, new Date(), newId);
      }
      await saveAddressBook(slug, next);
    }
    await clearDraft(slug);
    if (landing.payLater) {
      navigation.replace('OrderConfirmation', {
        orderId: order.orderId,
        orderCode: order.orderCode,
        payLater: true,
        pickup: landing.pickup,
      });
    } else {
      navigation.replace('Payment', {
        orderId: order.orderId,
        orderCode: order.orderCode,
        grandTotal: order.grandTotal,
        currency: order.currency,
        customerPhone: phone,
        pickup: landing.pickup,
      });
    }
  }

  function landingFromPlan(plan: OrderPlan): Landing {
    return {
      payLater: plan.payment === 'pay-later',
      pickup: plan.fulfilment === 'pickup',
      phone: plan.request.customerPhone,
      remember: plan.remember,
    };
  }

  async function onResult(result: PlaceResult, plan: OrderPlan) {
    switch (result.kind) {
      case 'busy':
        return;
      case 'placed':
        await finish(result.order, landingFromPlan(plan));
        return;
      case 'needs-basket':
        setNotice({ tone: 'error', text: notReadyText(result.why), toBasket: result.why === 'refused' || result.why === 'unpriced' || result.why === 'empty' });
        return;
      case 'total-changed':
        setChanged({ was: result.was, now: result.now });
        return;
      case 'refused':
        if (result.step === 'contact' && /email/i.test(result.message)) showErrors({ email: result.message });
        else if (result.step === 'delivery' && /area/i.test(result.message)) showErrors({ area: result.message });
        else setNotice({ tone: 'error', text: result.message });
        return;
      case 'basket-lapsed':
        setNotice({ tone: 'info', text: 'Your basket had expired at the shop, so we put it back together. Place the order again.' });
        return;
      case 'in-doubt':
        setDoubt({ phase: 'unsure', record: result.record });
        return;
    }
  }

  async function placeOrder(confirmed?: number | null) {
    if (!values || working || !session) return;
    setNotice(null);
    setChanged(null);
    const planned = planOrder(values, shop);
    if (!planned.ok) {
      showErrors(planned.errors);
      return;
    }
    setErrors({});
    setWorking(true);
    try {
      const result = await session.checkout.place(planned.plan, {
        confirmedTotal: confirmed === undefined ? view.subtotal : confirmed,
      });
      await onResult(result, planned.plan);
    } finally {
      setWorking(false);
    }
  }

  async function checkAgain() {
    if (!session || working || !doubt) return;
    const record = doubt.record;
    setWorking(true);
    try {
      const result = await session.checkout.checkAgain();
      switch (result.kind) {
        case 'busy':
          return;
        case 'nothing-pending':
          setDoubt(null);
          return;
        case 'too-soon':
          setDoubt({ phase: 'unsure', record, note: `The shop may still be answering. Wait ${Math.ceil(result.waitMs / 1000)} seconds, then check again.` });
          return;
        case 'probably-placed':
          setDoubt({ phase: 'probably-placed', record: result.record });
          return;
        case 'in-doubt':
          setDoubt({ phase: 'unsure', record: result.record, note: 'Still no answer from the shop.' });
          return;
        case 'placed': {
          const parsed = parseOrderNotes(record.request.notes);
          await finish(result.order, { payLater: parsed.payLater, pickup: parsed.pickup, phone: record.request.customerPhone, remember: null });
          return;
        }
        case 'refused':
          setDoubt(null);
          setNotice({ tone: 'error', text: result.message });
          return;
        default:
          setDoubt(null);
          return;
      }
    } finally {
      setWorking(false);
    }
  }

  async function settle(outcome: 'placed' | 'not-placed') {
    if (!session) return;
    await session.checkout.settle(outcome);
    setDoubt(null);
    if (outcome === 'placed') {
      navigation.navigate('MainTabs', { screen: 'Account' });
    } else {
      setNotice({ tone: 'info', text: 'Your basket is back as it was. You can place the order again.' });
    }
  }

  function startOver() {
    Alert.alert(
      'Start over?',
      'If the shop already has your order, ordering again would place it twice. Only start over if you did not get a message from the shop.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Start over', style: 'destructive', onPress: () => void settle('not-placed') },
      ],
    );
  }

  function applySaved(address: SavedAddress) {
    setValues((current) => (current ? applyAddress(current, address) : current));
    setErrors((current) => ({ ...current, area: undefined, street: undefined }));
  }

  if (isLoading || !values) {
    return (
      <View style={styles.shell}>
        <CartLinesSkeleton />
      </View>
    );
  }

  if (lines.length === 0 && !doubt) {
    return (
      <View style={styles.shell}>
        <StateBlock
          tone="empty"
          icon="basket"
          title="Your basket is empty"
          body="Add something from the shop, then come back to order."
          actionLabel="Start shopping"
          fill={mart.primary}
          onAction={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        />
      </View>
    );
  }

  const delivery = values.fulfilment === 'delivery';
  const saved = book ? usableFirst(book, shop.areaNames).slice(0, 3) : [];
  const lineCount = lines.length;
  const payLaterLabel = delivery ? 'Pay on delivery' : 'Pay at pickup';
  const on = mart.onPrimary;

  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxl + (doubt ? insets.bottom : 0) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>
            {lineCount} {lineCount === 1 ? 'item' : 'items'} from {mart.displayName}
          </Text>
          <Text style={total ? styles.summaryTotal : styles.summaryPending}>
            {total ?? 'Confirmed when you order'}
          </Text>
          {note ? (
            <Text accessibilityLiveRegion="polite" style={styles.summaryNote}>
              {note}
            </Text>
          ) : null}
        </View>

        {known.fromPhone ? (
          <View style={[styles.notice, styles.noticeWarn]}>
            <Text style={styles.noticeText}>
              The shop could not be reached, so its delivery areas are from your last visit.
            </Text>
          </View>
        ) : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          How do you want it?
        </Text>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {(['delivery', 'pickup'] as Fulfilment[]).map((kind) => {
            const disabled = kind === 'delivery' && !choices.canDeliver;
            const selected = values.fulfilment === kind;
            const ink = selected ? on.primary : MART.ink;
            return (
              <Pressable
                key={kind}
                onPress={() => {
                  if (!selected) stepFeel();
                  patchValues({ fulfilment: kind });
                }}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                style={[
                  styles.segmentItem,
                  selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                  disabled && styles.choiceDisabled,
                ]}
              >
                <Ionicons name={kind === 'delivery' ? 'bicycle' : 'storefront'} size={20} color={ink} />
                <Text style={[styles.segmentLabel, { color: ink }]}>
                  {kind === 'delivery' ? 'Delivery' : 'Pickup'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!choices.canDeliver ? (
          <Text style={styles.sectionHint}>
            {choices.whyNot === 'no-areas'
              ? 'This shop does not deliver yet. You can collect your order at the counter.'
              : 'The shop\'s delivery areas have not loaded. You can choose pickup, or check your connection.'}
          </Text>
        ) : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {delivery ? 'Who is it for?' : 'Who is collecting?'}
        </Text>
        <View style={styles.tile} onLayout={(event) => (sections.current.contact = event.nativeEvent.layout.y)}>
          <FormField
            label="Full name"
            value={values.name}
            onChangeText={(name) => patchValues({ name })}
            error={errors.name}
            placeholder="e.g. Amina Wanjiru"
            maxLength={255}
            onLayout={where('name')}
          />
          <FormField
            label="Phone number"
            hint="We send the M-Pesa prompt and updates here."
            value={values.phone}
            onChangeText={(phone) => patchValues({ phone })}
            error={errors.phone}
            placeholder="0712 345 678"
            keyboardType="phone-pad"
            maxLength={64}
            onLayout={where('phone')}
          />
          <FormField
            label="Email"
            hint={signedIn ? 'Orders with your email show in your account.' : 'Add one to get a receipt and to see this order later.'}
            value={values.email}
            onChangeText={(email) => patchValues({ email })}
            error={errors.email}
            placeholder="you@example.com"
            optional
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={255}
            onLayout={where('email')}
          />
          <FormField
            label="WhatsApp number"
            hint="Only if it is different from your phone."
            value={values.whatsApp}
            onChangeText={(whatsApp) => patchValues({ whatsApp })}
            error={errors.whatsApp}
            placeholder="0712 345 678"
            optional
            keyboardType="phone-pad"
            maxLength={64}
            onLayout={where('whatsApp')}
          />
        </View>

        {delivery ? (
          <>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Where should it go?
            </Text>
            {saved.length > 0 ? (
              <View style={styles.savedRow}>
                {saved.map((address) => {
                  const here = address.area.toLowerCase() === values.area.trim().toLowerCase() && address.street === values.street;
                  return (
                    <Pressable
                      key={address.id}
                      onPress={() => {
                        if (!here) stepFeel();
                        applySaved(address);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: here }}
                      accessibilityLabel={`Use saved address: ${describePlace({ ward: address.area })}, ${address.street}`}
                      style={[styles.savedChip, here && { backgroundColor: mart.primary, borderColor: mart.primary }]}
                    >
                      <Ionicons name={here ? 'checkmark-circle' : 'location-outline'} size={20} color={here ? on.primary : MART.ink} />
                      <View style={styles.choiceBody}>
                        <Text style={[styles.savedArea, here && { color: on.primary }]} numberOfLines={1}>
                          {address.area}
                        </Text>
                        <Text style={[styles.savedStreet, here && { color: on.secondary }]} numberOfLines={1}>
                          {address.street}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.tile} onLayout={(event) => (sections.current.delivery = event.nativeEvent.layout.y)}>
              {shop.areaNames && shop.areaNames.length > 0 ? (
                <AreaPicker
                  areas={shop.areaNames}
                  value={values.area}
                  onChange={(area) => patchValues({ area })}
                  error={errors.area}
                  accent={mart.primary}
                  onLayout={where('area')}
                />
              ) : errors.area ? (
                <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.fieldError}>
                  {errors.area}
                </Text>
              ) : null}
              <FormField
                label="Building, estate or landmark"
                value={values.street}
                onChangeText={(street) => patchValues({ street })}
                error={errors.street}
                placeholder="e.g. Maple Court, Gate B, near the petrol station"
                maxLength={500}
                onLayout={where('street')}
              />
              <FormField
                label="Notes for the rider"
                value={values.deliveryNotes}
                onChangeText={(deliveryNotes) => patchValues({ deliveryNotes })}
                error={errors.deliveryNotes}
                placeholder="Anything that helps them find you"
                optional
                multiline
                maxLength={1000}
                onLayout={where('deliveryNotes')}
              />
            </View>
          </>
        ) : null}

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          How will you pay?
        </Text>
        <View accessibilityRole="radiogroup" style={styles.rows}>
          <Choice
            label="M-Pesa now"
            hint={
              shop.hasOnlinePay === false
                ? 'This shop does not take M-Pesa in the app yet.'
                : 'You get the prompt on your phone after you place the order.'
            }
            selected={payment === 'mpesa'}
            disabled={shop.hasOnlinePay === false}
            accent={mart.primary}
            onPress={() => patchValues({ payment: 'mpesa', paymentTouched: true })}
          />
          <Choice
            ruled
            label={payLaterLabel}
            hint={delivery ? 'Pay the rider when it arrives.' : 'Pay at the counter when you collect.'}
            selected={payment === 'pay-later'}
            accent={mart.primary}
            onPress={() => patchValues({ payment: 'pay-later', paymentTouched: true })}
          />
        </View>

        <View style={[styles.rows, styles.rememberTile]}>
          <Pressable
            onPress={() => {
              stepFeel();
              patchValues({ remember: !values.remember });
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: values.remember }}
            style={styles.choice}
          >
            <Check on={values.remember} accent={mart.primary} />
            <View style={styles.choiceBody}>
              <Text style={styles.choiceLabel}>Remember these details</Text>
              <Text style={styles.choiceHint}>
                {delivery
                  ? 'Keeps your name, number and address on this phone, and asks the shop to keep them too, for next time.'
                  : 'Keeps your name and number on this phone for next time.'}
              </Text>
            </View>
          </Pressable>
        </View>

        {errors.form ? (
          <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.notice, styles.noticeError]}>
            <Text style={styles.noticeText}>{errors.form}</Text>
          </View>
        ) : null}

        {notice ? (
          <View accessibilityLiveRegion="polite" style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeInfo]}>
            <Text style={styles.noticeText}>{notice.text}</Text>
            {notice.toBasket ? (
              <Pressable
                onPress={() => navigation.navigate('MainTabs', { screen: 'Cart' })}
                accessibilityRole="button"
                style={styles.noticeLinkHit}
              >
                <Text style={styles.noticeLink}>Open your basket</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {changed ? (
          <View accessibilityLiveRegion="polite" style={[styles.notice, styles.noticeWarn]}>
            <Text style={styles.noticeText}>
              The shop's total is {formatMoney(view.currency, changed.now)}, not {formatMoney(view.currency, changed.was)}. Place the order at the shop's price?
            </Text>
            <View style={styles.noticeButtons}>
              <Capsule
                label="Place the order"
                size="md"
                chip="arrow-forward"
                fill={mart.primary}
                onPress={() => void placeOrder(changed.now)}
              />
              <Capsule label="Not now" size="md" kind="quiet" onPress={() => setChanged(null)} />
            </View>
          </View>
        ) : null}

        {doubt ? (
          <View accessibilityLiveRegion="polite" style={[styles.notice, styles.noticeWarn]}>
            <Text style={styles.doubtTitle}>
              {doubt.phase === 'probably-placed' ? 'Your order was probably placed' : 'We are not sure the shop got your order'}
            </Text>
            <Text style={styles.noticeText}>
              {doubt.phase === 'probably-placed'
                ? 'The shop no longer has this basket, which usually means it became an order. Did the shop confirm it, by SMS, WhatsApp or a call?'
                : 'The connection dropped while your order was going. Your basket is kept. Check again before ordering, so it is not placed twice.'}
            </Text>
            <Text style={styles.doubtMeta}>
              {doubt.record.total !== null ? `${formatMoney(doubt.record.currency, doubt.record.total)} · ` : ''}
              sent {new Date(doubt.record.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {doubt.note ? <Text style={styles.noticeText}>{doubt.note}</Text> : null}
            <View style={styles.noticeButtons}>
              {doubt.phase === 'probably-placed' ? (
                <Capsule
                  label="Yes, it was placed"
                  size="md"
                  chip="checkmark"
                  fill={mart.primary}
                  onPress={() => void settle('placed')}
                />
              ) : (
                <Capsule
                  label="Check again"
                  size="md"
                  chip="refresh"
                  fill={mart.primary}
                  busy={working}
                  onPress={() => void checkAgain()}
                />
              )}
            </View>
            {/* Starting over can place the order twice, so it stands apart from the safe answer. */}
            <View style={styles.apart}>
              <Capsule
                label={doubt.phase === 'probably-placed' ? 'No, start over' : 'Start over'}
                size="md"
                kind="danger"
                onPress={startOver}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      {doubt ? null : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
          {total ? (
            <View style={styles.footerTotal}>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerPrice} numberOfLines={1}>
                {total}
              </Text>
            </View>
          ) : null}
          <Capsule
            label="Place order"
            accessibilityLabel={total ? `Place order, ${total}` : 'Place order'}
            chip="arrow-forward"
            fill={mart.primary}
            busy={working}
            onPress={() => void placeOrder()}
            style={styles.footerAction}
          />
        </View>
      )}
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
    ...TILE,
  },
  summaryLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  summaryTotal: {
    ...TYPE.price,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.9,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  summaryPending: {
    ...TYPE.heading,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  summaryNote: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  sectionTitle: {
    ...TYPE.heading,
    marginTop: SPACE.xxl + SPACE.xs,
    marginBottom: SPACE.md,
    color: MART.ink,
  },
  sectionHint: {
    ...TYPE.meta,
    marginTop: SPACE.md,
    color: MART.inkMuted,
  },
  tile: {
    ...TILE,
    gap: SPACE.xl,
  },
  segment: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  segmentItem: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    gap: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: MART.ink,
    borderRadius: RADIUS.pill,
  },
  segmentLabel: {
    ...TYPE.label,
    fontFamily: FONT.bold,
  },
  savedRow: {
    marginBottom: SPACE.md,
    gap: SPACE.sm,
  },
  savedChip: {
    minHeight: 56,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    borderWidth: 1.5,
    borderColor: MART.ink,
    borderRadius: RADIUS.lg,
  },
  savedArea: {
    ...TYPE.label,
    fontFamily: FONT.bold,
    color: MART.ink,
  },
  savedStreet: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  fieldError: {
    ...TYPE.meta,
    color: MART.danger,
  },
  rows: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    paddingHorizontal: SPACE.lg,
  },
  rememberTile: {
    marginTop: SPACE.md,
  },
  choice: {
    minHeight: 64,
    paddingVertical: SPACE.lg,
    flexDirection: 'row',
    gap: SPACE.md,
    alignItems: 'flex-start',
  },
  choiceRuled: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  choiceDisabled: {
    opacity: 0.45,
  },
  choiceBody: {
    flex: 1,
    minWidth: 0,
  },
  choiceLabel: {
    ...TYPE.label,
    fontFamily: FONT.bold,
    fontSize: 15,
    lineHeight: 21,
    color: MART.ink,
  },
  choiceHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkMuted,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginTop: SPACE.xl,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    gap: SPACE.sm,
  },
  noticeError: {
    backgroundColor: MART.dangerSurface,
  },
  noticeInfo: {
    backgroundColor: MART.infoSurface,
  },
  noticeWarn: {
    backgroundColor: MART.warningSurface,
  },
  noticeText: {
    ...TYPE.body,
    color: MART.ink,
  },
  noticeLinkHit: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  noticeLink: {
    ...TYPE.label,
    fontFamily: FONT.bold,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
  noticeButtons: {
    marginTop: SPACE.sm,
    gap: SPACE.sm,
  },
  apart: {
    marginTop: SPACE.xl,
  },
  doubtTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  doubtMeta: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    backgroundColor: MART.paper,
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  footerTotal: {
    flexShrink: 1,
  },
  footerLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  footerPrice: {
    ...TYPE.price,
    color: MART.ink,
  },
  footerAction: {
    flex: 1,
    minWidth: 170,
  },
});
