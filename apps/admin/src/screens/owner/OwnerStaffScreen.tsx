import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { fetchStaff } from '../../lib/owner-api';
import { fetchStaffPerformance, type StaffSales } from '../../lib/sales-intelligence';
import type { StaffPerson } from '../../lib/staff';
import { Message, Panel, ScreenHeader, SkeletonRows } from '../../components/owner-ui';
import { kesOrDash } from '../../lib/owner-money';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, RADIUS, SPACE, tint, zoneFor } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

const REFRESH_MS = 120_000;

type Props = { api: ApiClient };

function who(u: StaffPerson): { name: string; sub: string | null } {
  const name = (u.name ?? '').trim() || (u.email ?? '').trim() || 'Someone';
  const sub = u.name && u.email ? u.email : null;
  return { name, sub };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Who works at the shop, their role at a glance. Read from `/api/v1/users`; adding and editing are done in the Stock app or on a computer. */
export function OwnerStaffScreen({ api }: Props) {
  const users = useLoaded(() => fetchStaff(api), REFRESH_MS);
  const perf = useLoaded(() => fetchStaffPerformance(api), REFRESH_MS);
  const loaded = users.loaded;
  const list = loaded.state === 'ok' ? loaded.value : [];
  // Today's sales per person, keyed by id, so each row can show how they are doing today.
  const salesById = new Map<string, StaffSales>(
    perf.loaded.state === 'ok' ? perf.loaded.value.map((s) => [s.userId, s]) : [],
  );

  const header = (
    <Appear delay={0} style={{ gap: SPACE.lg, paddingBottom: SPACE.lg }}>
      <ScreenHeader
        title="Staff"
        trailing={
          loaded.state === 'ok' && list.length > 0 ? (
            <View style={styles.countPill}>
              <MartText variant="title" color={MART.fallbackPrimary}>
                {list.length}
              </MartText>
              <MartText variant="shelf" color={MART.inkQuiet}>
                {list.length === 1 ? 'PERSON' : 'PEOPLE'}
              </MartText>
            </View>
          ) : null
        }
      />
    </Appear>
  );


  if (loaded.state === 'loading') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>
          {header}
          <SkeletonRows count={5} />
        </View>
      </View>
    );
  }

  if (loaded.state === 'denied' || loaded.state === 'failed') {
    return (
      <View style={styles.screen}>
        <View style={styles.padded}>{header}</View>
        <Message
          icon={loaded.state === 'denied' ? 'lock-closed-outline' : 'cloud-offline-outline'}
          title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load the team'}
          body={loaded.words}
          {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void users.reload() } } : {})}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(u) => u.id}
      refreshControl={
        <RefreshControl
          refreshing={users.refreshing}
          onRefresh={() => {
            void users.refresh();
            void perf.refresh();
          }}
        />
      }
      ListHeaderComponent={header}
      ListEmptyComponent={<Message icon="people-outline" title="No one yet" body="People added to the shop will show here." />}
      ItemSeparatorComponent={() => <View style={{ height: SPACE.sm }} />}
      renderItem={({ item, index }) => {
        const { name, sub } = who(item);
        const accent = zoneFor(item.roleName ?? item.id);
        const sold = salesById.get(item.id);
        const soldToday = sold && (sold.revenueCents ?? 0) > 0;
        return (
          <Appear delay={Math.min(index, 6) * 40}>
            <Panel style={styles.person}>
              <View style={[styles.avatar, { backgroundColor: tint(accent, 0.18) }]}>
                <MartText variant="heading" color={MART.ink}>
                  {initials(name)}
                </MartText>
              </View>
              <View style={{ flex: 1, gap: SPACE.xxs }}>
                <MartText variant="heading" numberOfLines={1}>
                  {name}
                </MartText>
                {soldToday ? (
                  <MartText variant="meta" color={MART.inkMuted} numberOfLines={1}>
                    {kesOrDash(sold!.revenueCents)} today
                    {sold!.saleCount ? ` · ${sold!.saleCount} ${sold!.saleCount === 1 ? 'sale' : 'sales'}` : ''}
                  </MartText>
                ) : sub ? (
                  <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                    {sub}
                  </MartText>
                ) : null}
              </View>
              <View style={[styles.roleChip, { backgroundColor: tint(accent, 0.16) }]}>
                <MartText variant="shelf" color={MART.ink}>
                  {(item.roleName ?? 'Staff').toUpperCase()}
                </MartText>
              </View>
            </Panel>
          </Appear>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  padded: { paddingHorizontal: GUTTER, paddingTop: GUTTER },
  content: { padding: GUTTER, paddingBottom: SPACE.xxxl },
  countPill: {
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChip: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
  },
});
