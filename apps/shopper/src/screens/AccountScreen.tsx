import { StatusBar } from 'expo-status-bar';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { useSession } from '../hooks/useSession';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useAirtimeConfig } from '../hooks/useAirtimeConfig';
import { AccountAuthPanel } from '../components/AccountAuthPanel';
import { Segmented, useAuthGate } from '../components/AuthGate';
import { Capsule, PressScale, Tag } from '../components/Capsule';
import { Coast, COAST_SWELL, Lobe } from '../components/Coast';
import { StateBlock } from '../components/StateBlock';
import { AccountHubSkeleton, Bone, SkeletonScope } from '../components/Skeleton';
import { formatMoney, moneyFromUnknown } from '../lib/media';
import { CounterServices } from '../components/CounterServices';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { FONT, GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE, ZONE } from '../theme/mart';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import type { ShopperLedgerLine } from '../api/account';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Account'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function formatDate(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The flat colour an order's status sits on. Ink is written on all three. */
function statusTone(status?: string): string {
  const s = (status ?? '').toUpperCase();
  if (s.includes('READY') || s.includes('PAID') || s.includes('COMPLETE')) {
    return MART.successSurface;
  }
  if (s.includes('CANCEL') || s.includes('FAIL')) {
    return MART.dangerSurface;
  }
  return MART.warningSurface;
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

function formatWhen(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function ledgerKind(kind?: string): { label: string; icon: IconName; zone: string; shape: number } {
  const k = (kind ?? '').toLowerCase();
  if (k.startsWith('wallet')) return { label: 'Wallet', icon: 'wallet', zone: ZONE.sun, shape: 0 };
  if (k.startsWith('credit')) return { label: 'Tab', icon: 'receipt', zone: ZONE.lilac, shape: 1 };
  if (k.startsWith('loyalty')) return { label: 'Points', icon: 'sparkles', zone: ZONE.pond, shape: 2 };
  return { label: 'Shop', icon: 'storefront', zone: ZONE.leaf, shape: 3 };
}

function humanizeLedger(kind?: string, memo?: string): string {
  const raw = `${memo || ''} ${kind || ''}`.toUpperCase();
  if (/DEBIT_SALE|SALE/.test(raw) && /WALLET|DEBIT/.test(raw)) return 'Paid at the shop';
  if (/CREDIT_MPESA|MPESA_STK/.test(raw)) return 'M-Pesa into wallet';
  if (/COUNTER_TOPUP|TOPUP/.test(raw)) return 'Cash at the shop';
  if (/OVERPAY|CHANGE/.test(raw)) return 'Change to wallet';
  if (/REFUND/.test(raw)) return 'Refund';
  if (/CREDIT_/.test(raw) && /DEBT|SALE/.test(raw)) return 'Put on the tab';
  if (/LOYALTY/.test(raw) && /:/.test(memo ?? '')) {
    const pts = (memo ?? '').split(':')[1];
    return pts ? `${pts} loyalty points` : 'Loyalty';
  }
  const cleaned = (memo || kind || 'Shop movement')
    .replace(/^(wallet|credit|loyalty)_/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function LedgerRow({ currency, line, first }: { currency: string; line: ShopperLedgerLine; first: boolean }) {
  const kind = ledgerKind(line.kind);
  const debit = moneyFromUnknown(line.debit);
  const credit = moneyFromUnknown(line.credit);
  return (
    <View style={[styles.row, !first && styles.rule]}>
      <Lobe color={kind.zone} size={40} shape={kind.shape}>
        <Ionicons name={kind.icon} size={18} color={MART.ink} />
      </Lobe>
      <View style={styles.rowCopy}>
        <Text numberOfLines={2} style={styles.rowTitle}>
          {humanizeLedger(line.kind, line.memo)}
        </Text>
        <Text style={styles.rowMeta}>
          {kind.label}
          {formatWhen(line.occurredAt) ? ` · ${formatWhen(line.occurredAt)}` : ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {credit > 0 ? (
          <Text style={[styles.rowMoney, { color: MART.success }]}>+{formatMoney(currency, credit)}</Text>
        ) : null}
        {debit > 0 ? <Text style={styles.rowMoney}>−{formatMoney(currency, debit)}</Text> : null}
        {credit <= 0 && debit <= 0 ? <Text style={styles.rowMeta}>—</Text> : null}
      </View>
    </View>
  );
}

function humanizeStatus(status?: string): string {
  const raw = (status ?? 'Placed').replace(/[_-]+/g, ' ').trim();
  if (!raw) return 'Placed';
  return raw
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** One balance: a small zone lobe, what it is, and the amount set heavy. The wallet takes the wide tile. */
function Book({
  label,
  value,
  hint,
  icon,
  zone,
  shape,
  warn,
  wide,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  zone: string;
  shape: number;
  warn?: boolean;
  wide?: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      style={[styles.book, wide && styles.bookWide]}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}. ${hint}`}
    >
      <View style={styles.bookHead}>
        <Lobe color={zone} size={wide ? 44 : 36} shape={shape}>
          <Ionicons name={icon} size={wide ? 20 : 17} color={MART.ink} />
        </Lobe>
        <Text style={styles.bookLabel}>{label}</Text>
      </View>
      <View style={wide ? styles.bookWideValue : undefined}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[wide ? styles.bookValueWide : styles.bookValue, warn && { color: MART.danger }]}
        >
          {value}
        </Text>
        <Text numberOfLines={1} style={[styles.bookHint, wide && styles.bookHintWide]}>
          {hint}
        </Text>
      </View>
    </PressScale>
  );
}

const FEEDS = [
  { value: 'wallet', label: 'Credits' },
  { value: 'purchases', label: 'Purchases' },
] as const;

export function AccountScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const basketReserve = useBasketFloatReserve();
  const mart = useMemo(() => martFromTenant(tenant), [tenant]);
  const { signedIn, tokenLoading, me, hub, hubLoading, hubError, refreshAuth } = useSession();
  const { openAuth } = useAuthGate();
  const { data: localOrders, refetch: refetchLocal } = useOrderHistory(tenant.slug);
  const { data: airtime } = useAirtimeConfig(tenant.slug);

  const displayName = hub?.customerDirectoryName?.trim() || me?.name?.trim() || 'there';
  const email = me?.email || hub?.email || '';
  const currency = 'KES';
  const wallet = moneyFromUnknown(hub?.balances?.walletBalance);
  const owed = moneyFromUnknown(hub?.balances?.balanceOwed);
  const points = hub?.balances?.loyaltyPoints ?? 0;
  const kesPerPt = moneyFromUnknown(hub?.loyaltyKesPerPoint) || 0.01;
  const pickupOrders = hub?.pickupOrders ?? [];
  const ledger = hub?.recentLedgerLines ?? [];
  const [feed, setFeed] = useState<'wallet' | 'purchases'>('wallet');
  // The lobe behind the greeting is as tall as the greeting turns out to be.
  const [landHeight, setLandHeight] = useState(insets.top + 132);
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  function handleRefresh() {
    refreshAuth();
    void refetchLocal();
  }

  if (tokenLoading) {
    return (
      <View style={[styles.shell, styles.loading, { paddingTop: 16 + insets.top }]}>
        <AccountHubSkeleton />
      </View>
    );
  }

  const on = mart.onPrimary;
  const localOnly = (localOrders ?? []).filter((order) => !pickupOrders.some((p) => p.id === order.orderId));
  const movements = hub?.ledgerLinesTotal ?? ledger.length;

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={{ paddingBottom: SPACE.xxxl + basketReserve }}
      refreshControl={
        <RefreshControl
          refreshing={hubLoading && signedIn}
          onRefresh={handleRefresh}
          tintColor={on.primary}
          colors={[mart.primary]}
        />
      }
    >
      <View>
        {/* Land above the top edge too, so pulling down never shows water over the coast. */}
        <View style={[styles.overland, { backgroundColor: mart.primary }]} />
        <Coast color={mart.primary} height={landHeight} />
        <StatusBar style={mart.onPrimary.primary === MART.ink ? 'dark' : 'light'} />
        <View
          style={[styles.top, { paddingTop: insets.top + SPACE.lg }]}
          onLayout={(event) => setLandHeight(event.nativeEvent.layout.height)}
        >
          <View style={styles.helloBlock}>
            <Text accessibilityRole="header" style={[styles.hello, { color: on.primary }]}>
              {signedIn ? `${hello}, ${firstName(displayName)}` : hello}
            </Text>
            <Text style={[styles.helloSub, { color: on.secondary }]} numberOfLines={1}>
              {signedIn ? email || mart.displayName : mart.displayName}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(signedIn ? displayName : mart.displayName).slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.books} accessibilityRole="summary">
          <Book
            wide
            label="Wallet"
            icon="wallet"
            zone={ZONE.sun}
            shape={0}
            value={signedIn ? formatMoney(currency, wallet) : '—'}
            hint="Store credit"
            onPress={() => setFeed('wallet')}
          />
          <View style={styles.bookPair}>
            <Book
              label="Tab"
              icon="receipt"
              zone={ZONE.lilac}
              shape={1}
              value={signedIn ? formatMoney(currency, owed) : '—'}
              hint={owed > 0 ? 'Owed at the shop' : 'Nothing owed'}
              warn={owed > 0}
              onPress={() => setFeed('wallet')}
            />
            <Book
              label="Points"
              icon="sparkles"
              zone={ZONE.pond}
              shape={2}
              value={signedIn ? points.toLocaleString() : '—'}
              hint={signedIn ? `Worth ${formatMoney(currency, points * kesPerPt)}` : 'Loyalty'}
              onPress={() => setFeed('purchases')}
            />
          </View>
        </View>

        <View style={styles.services}>
          <CounterServices
            flush
            airtimeAvailable={Boolean(airtime?.available)}
            onAirtime={() => navigation.navigate('Airtime')}
            onTokens={() => navigation.navigate('Kplc')}
          />
        </View>
      </View>

      {signedIn ? (
        <>
          {hubError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="cloud-offline" size={20} color={MART.danger} />
              <Text style={styles.error}>We couldn’t load your account. Pull down to try again.</Text>
            </View>
          ) : null}

          <View style={styles.historyHead}>
            <Text accessibilityRole="header" style={styles.historyTitle}>
              History
            </Text>
            <Text style={styles.historyHint}>Wallet, tab, and what you bought</Text>
          </View>

          <View style={styles.feedSeg}>
            <Segmented options={FEEDS} value={feed} onChange={setFeed} label="History" />
          </View>

          {feed === 'wallet' ? (
            hubLoading && ledger.length === 0 ? (
              <SkeletonScope label="Loading wallet history" style={styles.orderSkel}>
                <Bone h={72} r={RADIUS.lg} />
                <Bone h={72} r={RADIUS.lg} />
                <Bone h={72} r={RADIUS.lg} />
              </SkeletonScope>
            ) : !hub?.linkedStorefrontProfile ? (
              <StateBlock
                tone="note"
                icon="link"
                title="Ask the shop to link this email"
                body={`Once they link ${email || 'your account'}, your wallet, tab and receipts show up here.`}
                style={styles.state}
              />
            ) : ledger.length === 0 ? (
              <StateBlock
                tone="note"
                icon="wallet"
                title="No wallet or tab activity yet"
                body="Your next purchase at the shop shows up here."
                style={styles.state}
              />
            ) : (
              <>
                <Text style={styles.ledgerHint}>
                  {movements.toLocaleString()} movement
                  {movements === 1 ? '' : 's'}
                  {hub.ledgerTruncated ? ' · latest shown' : ''}
                </Text>
                <View style={styles.list}>
                  {ledger.map((line, index) => (
                    <LedgerRow
                      key={`${line.occurredAt}-${index}-${line.kind}`}
                      currency={currency}
                      line={line}
                      first={index === 0}
                    />
                  ))}
                </View>
              </>
            )
          ) : hubLoading && pickupOrders.length === 0 && !(localOrders?.length) ? (
            <SkeletonScope label="Loading purchases" style={styles.orderSkel}>
              <Bone h={64} r={RADIUS.lg} />
              <Bone h={64} r={RADIUS.lg} />
            </SkeletonScope>
          ) : pickupOrders.length === 0 && !(localOrders?.length) ? (
            <StateBlock
              tone="note"
              icon="bag-handle"
              title="No orders yet"
              body="Orders you place from your basket show up here."
              style={styles.state}
            />
          ) : (
            <View style={styles.list}>
              {pickupOrders.map((order, index) => (
                <PressScale
                  key={order.id}
                  to={0.985}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  style={[styles.row, index > 0 && styles.rule]}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${order.id.slice(-8)}`}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>#{order.id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.rowMeta}>
                      {formatDate(order.createdAt)}
                      {order.catalogBranchName ? ` · ${order.catalogBranchName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowMoney}>
                      {formatMoney(order.currency || currency, moneyFromUnknown(order.grandTotal))}
                    </Text>
                    <Tag label={humanizeStatus(order.status)} color={statusTone(order.status)} style={styles.status} />
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
                </PressScale>
              ))}
              {localOnly.map((order, index) => (
                <PressScale
                  key={order.orderId}
                  to={0.985}
                  onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
                  style={[styles.row, (index > 0 || pickupOrders.length > 0) && styles.rule]}
                  accessibilityRole="button"
                  accessibilityLabel={`Order ${order.orderId.slice(-8)}`}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>#{order.orderId.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.rowMeta}>{formatDate(order.createdAt)} · this phone</Text>
                  </View>
                  <Text style={styles.rowMoney}>{formatMoney(order.currency, order.grandTotal)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
                </PressScale>
              ))}
            </View>
          )}

          <View style={styles.signOutWrap}>
            <AccountAuthPanel
              signedIn
              primary={mart.primary}
              storeName={mart.displayName}
              logoUrl={mart.logoUrl}
              onAuthChange={refreshAuth}
            />
          </View>
        </>
      ) : (
        <View style={styles.gateWrap}>
          <Text accessibilityRole="header" style={styles.historyTitle}>
            Your account
          </Text>
          <Text style={styles.gateBody}>
            Join with your phone, or sign in with the same email as the website.
          </Text>
          <Capsule
            label="Sign in or join"
            chip="arrow-forward"
            fill={mart.primary}
            onPress={() => void openAuth('pass')}
            style={styles.gateAction}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  loading: {
    paddingHorizontal: SPACE.xs,
  },
  overland: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -600,
    height: 600,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.lg,
  },
  helloBlock: {
    flex: 1,
    minWidth: 0,
  },
  hello: {
    ...TYPE.display,
  },
  helloSub: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPE.title,
    color: MART.ink,
  },
  body: {
    paddingHorizontal: GUTTER,
    paddingTop: COAST_SWELL + SPACE.lg,
  },
  books: {
    gap: SPACE.sm,
  },
  bookPair: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  book: {
    ...TILE,
    flex: 1,
    gap: SPACE.md,
  },
  bookWide: {
    flex: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 88,
  },
  bookHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  bookLabel: {
    ...TYPE.label,
    color: MART.ink,
  },
  bookWideValue: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  bookValue: {
    ...TYPE.price,
    fontSize: 20,
    lineHeight: 25,
    color: MART.ink,
  },
  bookValueWide: {
    ...TYPE.price,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1,
    color: MART.ink,
  },
  bookHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  bookHintWide: {
    textAlign: 'right',
  },
  services: {
    marginTop: SPACE.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginHorizontal: GUTTER,
    marginTop: SPACE.lg,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.dangerSurface,
  },
  error: {
    ...TYPE.label,
    flex: 1,
    color: MART.ink,
  },
  historyHead: {
    marginTop: SPACE.xxl + SPACE.xs,
    paddingHorizontal: GUTTER,
  },
  historyTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
  historyHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  feedSeg: {
    marginTop: SPACE.md,
    marginBottom: SPACE.md,
    paddingHorizontal: GUTTER,
  },
  ledgerHint: {
    ...TYPE.meta,
    marginBottom: SPACE.sm,
    paddingHorizontal: GUTTER + SPACE.xs,
    color: MART.inkQuiet,
  },
  list: {
    marginHorizontal: GUTTER,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 68,
    paddingVertical: SPACE.md,
  },
  rule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...TYPE.label,
    color: MART.ink,
  },
  rowMeta: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: SPACE.xs,
  },
  rowMoney: {
    ...TYPE.label,
    fontFamily: FONT.bold,
    color: MART.ink,
  },
  status: {
    alignSelf: 'flex-end',
  },
  state: {
    paddingTop: SPACE.lg,
  },
  orderSkel: {
    paddingHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  signOutWrap: {
    marginTop: SPACE.xxxl,
    paddingHorizontal: GUTTER,
  },
  gateWrap: {
    marginTop: SPACE.xxl + SPACE.xs,
    paddingHorizontal: GUTTER,
  },
  gateBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  gateAction: {
    marginTop: SPACE.xl,
  },
});
