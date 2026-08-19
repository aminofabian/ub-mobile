import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { useSession } from '../hooks/useSession';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useAirtimeConfig } from '../hooks/useAirtimeConfig';
import { AccountAuthPanel } from '../components/AccountAuthPanel';
import { useAuthGate } from '../components/AuthGate';
import { AccountHubSkeleton, Bone, SkeletonScope } from '../components/Skeleton';
import { formatMoney, moneyFromUnknown } from '../lib/media';
import { CounterServices } from '../components/CounterServices';
import { useBasketFloatReserve } from '../components/BasketFloat';
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

function statusTone(status?: string): { bg: string; fg: string } {
  const s = (status ?? '').toUpperCase();
  if (s.includes('READY') || s.includes('PAID') || s.includes('COMPLETE')) {
    return { bg: MART.successSurface, fg: MART.success };
  }
  if (s.includes('CANCEL') || s.includes('FAIL')) {
    return { bg: MART.dangerSurface, fg: MART.danger };
  }
  return { bg: MART.warningSurface, fg: MART.warning };
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

function ledgerKind(kind?: string): { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] } {
  const k = (kind ?? '').toLowerCase();
  if (k.startsWith('wallet')) return { label: 'Wallet', icon: 'wallet-outline' };
  if (k.startsWith('credit')) return { label: 'Tab', icon: 'receipt-outline' };
  if (k.startsWith('loyalty')) return { label: 'Points', icon: 'sparkles-outline' };
  return { label: 'Till', icon: 'storefront-outline' };
}

function humanizeLedger(kind?: string, memo?: string): string {
  const raw = `${memo || ''} ${kind || ''}`.toUpperCase();
  if (/DEBIT_SALE|SALE/.test(raw) && /WALLET|DEBIT/.test(raw)) return 'Paid at the till';
  if (/CREDIT_MPESA|MPESA_STK/.test(raw)) return 'M-Pesa into wallet';
  if (/COUNTER_TOPUP|TOPUP/.test(raw)) return 'Cash at the till';
  if (/OVERPAY|CHANGE/.test(raw)) return 'Change to wallet';
  if (/REFUND/.test(raw)) return 'Refund';
  if (/CREDIT_/.test(raw) && /DEBT|SALE/.test(raw)) return 'Put on the tab';
  if (/LOYALTY/.test(raw) && /:/.test(memo ?? '')) {
    const pts = (memo ?? '').split(':')[1];
    return pts ? `${pts} loyalty points` : 'Loyalty';
  }
  const cleaned = (memo || kind || 'Till movement')
    .replace(/^(wallet|credit|loyalty)_/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function LedgerRow({ currency, line }: { currency: string; line: ShopperLedgerLine }) {
  const kind = ledgerKind(line.kind);
  const debit = moneyFromUnknown(line.debit);
  const credit = moneyFromUnknown(line.credit);
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerIcon}>
        <Ionicons name={kind.icon} size={18} color={MART.ink} />
      </View>
      <View style={styles.orderCopy}>
        <Text style={styles.orderId}>{humanizeLedger(line.kind, line.memo)}</Text>
        <Text style={styles.orderMeta}>
          {kind.label}
          {formatWhen(line.occurredAt) ? ` · ${formatWhen(line.occurredAt)}` : ''}
        </Text>
      </View>
      <View style={styles.orderRight}>
        {credit > 0 ? (
          <Text style={styles.ledgerCredit}>+{formatMoney(currency, credit)}</Text>
        ) : null}
        {debit > 0 ? (
          <Text style={styles.ledgerDebit}>−{formatMoney(currency, debit)}</Text>
        ) : null}
        {credit <= 0 && debit <= 0 ? <Text style={styles.orderMeta}>—</Text> : null}
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

function Book({
  label,
  value,
  hint,
  warn,
  last,
  onPress,
}: {
  label: string;
  value: string;
  hint: string;
  warn?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.book, !last && styles.bookRule]}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
    >
      <View style={styles.bookCopy}>
        <Text style={styles.bookLabel}>{label}</Text>
        <Text style={styles.bookHint}>{hint}</Text>
      </View>
      <Text style={[styles.bookValue, warn && { color: MART.danger }]}>{value}</Text>
    </Pressable>
  );
}

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
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  function handleRefresh() {
    refreshAuth();
    void refetchLocal();
  }

  if (tokenLoading) {
    return (
      <View style={[styles.shell, { paddingTop: 16 + insets.top }]}>
        <AccountHubSkeleton />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 8 + insets.top, paddingBottom: SPACE.xxxl + basketReserve },
      ]}
      refreshControl={
        <RefreshControl refreshing={hubLoading && signedIn} onRefresh={handleRefresh} tintColor={mart.primary} />
      }
    >
      <View style={styles.top}>
        <View style={styles.helloBlock}>
          <Text style={styles.hello}>{signedIn ? `${hello}, ${firstName(displayName)}` : hello}</Text>
          <Text style={styles.helloSub} numberOfLines={1}>
            {signedIn ? email || mart.displayName : mart.displayName}
          </Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: mart.primary }]}>
          <Text style={styles.avatarText}>
            {(signedIn ? displayName : mart.displayName).slice(0, 1).toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.books} accessibilityRole="summary">
        <Book
          label="Wallet"
          value={signedIn ? formatMoney(currency, wallet) : '—'}
          hint="Store credit"
          onPress={() => setFeed('wallet')}
        />
        <Book
          label="Tab"
          value={signedIn ? formatMoney(currency, owed) : '—'}
          hint={owed > 0 ? 'Owed at the till' : 'Clear'}
          warn={owed > 0}
          onPress={() => setFeed('wallet')}
        />
        <Book
          label="Points"
          value={signedIn ? points.toLocaleString() : '—'}
          hint={signedIn ? formatMoney(currency, points * kesPerPt) : 'Loyalty'}
          last
          onPress={() => setFeed('purchases')}
        />
      </View>

      <View style={styles.services}>
        <CounterServices
          flush
          airtimeAvailable={Boolean(airtime?.available)}
          primary={mart.primary}
          accent={mart.accent}
          onAirtime={() => navigation.navigate('Airtime')}
          onTokens={() => navigation.navigate('Kplc')}
        />
      </View>

      {signedIn ? (
        <>
          {hubError ? (
            <Text style={styles.error}>Couldn’t load your store card. Pull down to retry.</Text>
          ) : null}

          <View style={styles.historyHead}>
            <Text style={styles.historyTitle}>History</Text>
            <Text style={styles.historyHint}>Wallet, tab, and what you bought</Text>
          </View>

          <View style={styles.feedSeg} accessibilityRole="tablist">
            <Pressable
              onPress={() => setFeed('wallet')}
              style={[styles.feedBtn, feed === 'wallet' && styles.feedBtnOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: feed === 'wallet' }}
            >
              <Text style={[styles.feedBtnText, feed === 'wallet' && styles.feedBtnTextOn]}>
                Credits
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFeed('purchases')}
              style={[styles.feedBtn, feed === 'purchases' && styles.feedBtnOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: feed === 'purchases' }}
            >
              <Text style={[styles.feedBtnText, feed === 'purchases' && styles.feedBtnTextOn]}>
                Purchases
              </Text>
            </Pressable>
          </View>

          {feed === 'wallet' ? (
            hubLoading && ledger.length === 0 ? (
              <SkeletonScope label="Loading wallet history" style={styles.orderSkel}>
                <Bone h={72} />
                <Bone h={72} />
                <Bone h={72} />
              </SkeletonScope>
            ) : !hub?.linkedStorefrontProfile ? (
              <View style={styles.tillEmpty}>
                <Ionicons name="link-outline" size={22} color={mart.primary} />
                <Text style={styles.tillEmptyTitle}>Ask the till to link this email</Text>
                <Text style={styles.empty}>
                  Once they tether {email || 'your account'}, wallet, tab, and till slips show up here.
                </Text>
              </View>
            ) : ledger.length === 0 ? (
              <Text style={styles.empty}>No wallet or tab lines yet. The next till sale leaves the first one.</Text>
            ) : (
              <>
                <Text style={styles.ledgerHint}>
                  {(hub.ledgerLinesTotal ?? ledger.length).toLocaleString()} movement
                  {(hub.ledgerLinesTotal ?? ledger.length) === 1 ? '' : 's'}
                  {hub.ledgerTruncated ? ' · latest shown' : ''}
                </Text>
                {ledger.map((line, index) => (
                  <LedgerRow key={`${line.occurredAt}-${index}-${line.kind}`} currency={currency} line={line} />
                ))}
              </>
            )
          ) : hubLoading && pickupOrders.length === 0 && !(localOrders?.length) ? (
            <SkeletonScope label="Loading purchases" style={styles.orderSkel}>
              <Bone h={64} />
              <Bone h={64} />
            </SkeletonScope>
          ) : pickupOrders.length === 0 && !(localOrders?.length) ? (
            <Text style={styles.empty}>No app orders yet. Basket checkout lands here.</Text>
          ) : (
            <>
              {pickupOrders.map((order) => {
                const tone = statusTone(order.status);
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                    style={styles.orderRow}
                    accessibilityRole="button"
                    accessibilityLabel={`Order ${order.id.slice(-8)}`}
                  >
                    <View style={styles.orderCopy}>
                      <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
                      <Text style={styles.orderMeta}>
                        {formatDate(order.createdAt)}
                        {order.catalogBranchName ? ` · ${order.catalogBranchName}` : ''}
                      </Text>
                    </View>
                    <View style={styles.orderRight}>
                      <Text style={styles.orderTotal}>
                        {formatMoney(order.currency || currency, moneyFromUnknown(order.grandTotal))}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.statusText, { color: tone.fg }]}>
                          {humanizeStatus(order.status)}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              {(localOrders ?? [])
                .filter((order) => !pickupOrders.some((p) => p.id === order.orderId))
                .map((order) => (
                  <Pressable
                    key={order.orderId}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: order.orderId })}
                    style={styles.orderRow}
                    accessibilityRole="button"
                  >
                    <View style={styles.orderCopy}>
                      <Text style={styles.orderId}>#{order.orderId.slice(-8).toUpperCase()}</Text>
                      <Text style={styles.orderMeta}>{formatDate(order.createdAt)} · this phone</Text>
                    </View>
                    <Text style={styles.orderTotal}>{formatMoney(order.currency, order.grandTotal)}</Text>
                  </Pressable>
                ))}
            </>
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
          <Text style={styles.historyTitle}>Your store card</Text>
          <Text style={styles.empty}>
            Join with your phone, or sign in with the same email as the website.
          </Text>
          <Pressable
            onPress={() => void openAuth('pass')}
            style={[styles.primary, { backgroundColor: mart.primary }]}
          >
            <Text style={styles.primaryText}>Come in</Text>
          </Pressable>
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
  content: {
    paddingHorizontal: GUTTER,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.xl,
    gap: SPACE.md,
  },
  helloBlock: {
    flex: 1,
    minWidth: 0,
  },
  hello: {
    ...TYPE.display,
    color: MART.ink,
  },
  helloSub: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...TYPE.heading,
    color: '#ffffff',
  },
  books: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    ...ELEVATION.ruled,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    minHeight: 64,
  },
  bookRule: {
    borderBottomWidth: 1,
    borderBottomColor: MART.border,
  },
  bookCopy: {
    flex: 1,
    minWidth: 0,
  },
  bookLabel: {
    ...TYPE.shelf,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    color: MART.inkQuiet,
  },
  bookValue: {
    ...TYPE.heading,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    color: MART.ink,
  },
  bookHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkMuted,
  },
  services: {
    marginTop: SPACE.xl,
  },
  historyHead: {
    marginTop: SPACE.xxl,
    marginBottom: SPACE.md,
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
    marginTop: SPACE.sm,
    marginBottom: SPACE.md,
    flexDirection: 'row',
    padding: 3,
    backgroundColor: MART.paperSunken,
    borderRadius: RADIUS.md,
  },
  feedBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  feedBtnOn: {
    backgroundColor: MART.paperElevated,
  },
  feedBtnText: {
    ...TYPE.label,
    fontWeight: '700',
    color: MART.inkMuted,
  },
  feedBtnTextOn: {
    color: MART.ink,
  },
  ledgerHint: {
    ...TYPE.meta,
    marginBottom: SPACE.sm,
    color: MART.inkQuiet,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    borderRadius: RADIUS.md,
    minHeight: 68,
    ...ELEVATION.ruled,
  },
  ledgerIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: MART.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ledgerCredit: {
    ...TYPE.label,
    fontWeight: '700',
    color: MART.success,
  },
  ledgerDebit: {
    ...TYPE.label,
    fontWeight: '700',
    color: MART.ink,
  },
  tillEmpty: {
    paddingVertical: SPACE.xl,
    alignItems: 'flex-start',
    gap: SPACE.sm,
  },
  tillEmptyTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  empty: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkQuiet,
  },
  orderSkel: {
    marginTop: SPACE.sm,
    gap: SPACE.sm,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.md,
    marginBottom: SPACE.sm,
    borderRadius: RADIUS.md,
    minHeight: 64,
    ...ELEVATION.ruled,
  },
  orderCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACE.sm,
  },
  orderId: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
  orderMeta: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: SPACE.xs,
  },
  orderTotal: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
  statusPill: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
  },
  statusText: {
    ...TYPE.meta,
    fontWeight: '700',
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.md,
    color: MART.danger,
  },
  signOutWrap: {
    marginTop: SPACE.xl,
  },
  gateWrap: {
    marginTop: SPACE.xl,
    gap: SPACE.md,
  },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
