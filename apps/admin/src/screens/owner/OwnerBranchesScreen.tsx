import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { ApiClient, BranchOption } from '@kiosk/core';
import { Message, Panel, ScreenHeader, SkeletonRows } from '../../components/owner-ui';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, RADIUS, SPACE, tint, zoneFor } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

const REFRESH_MS = 300_000;

type Props = { api: ApiClient; currentBranchId: string };

/** Reads `GET /api/v1/auth/branches` through the signed-in client; tolerates the array or a `{ branches }` wrapper. */
async function loadBranches(api: ApiClient): Promise<BranchOption[]> {
  const body = await api.get<BranchOption[] | { branches?: BranchOption[] }>('/api/v1/auth/branches');
  const rows = Array.isArray(body) ? body : body?.branches ?? [];
  return rows.filter((b): b is BranchOption => Boolean(b && typeof b.id === 'string' && typeof b.name === 'string'));
}

/** The shops under this business. Read-only here. */
export function OwnerBranchesScreen({ api, currentBranchId }: Props) {
  const branches = useLoaded(() => loadBranches(api), REFRESH_MS);
  const loaded = branches.loaded;
  const list = loaded.state === 'ok' ? loaded.value : [];

  const header = (
    <Appear delay={0} style={{ paddingBottom: SPACE.lg }}>
      <ScreenHeader
        title="Branches"
        trailing={
          loaded.state === 'ok' && list.length > 0 ? (
            <View style={styles.countPill}>
              <MartText variant="title" color={MART.fallbackPrimary}>
                {list.length}
              </MartText>
              <MartText variant="shelf" color={MART.inkQuiet}>
                {list.length === 1 ? 'BRANCH' : 'BRANCHES'}
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
          <SkeletonRows count={3} />
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
          title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load branches'}
          body={loaded.words}
          {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void branches.reload() } } : {})}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(b) => b.id}
      refreshControl={<RefreshControl refreshing={branches.refreshing} onRefresh={() => void branches.refresh()} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Message icon="git-branch-outline" title="No branches yet" body="Branches added to the business will show here." />}
      ItemSeparatorComponent={() => <View style={{ height: SPACE.sm }} />}
      renderItem={({ item }) => {
        const accent = zoneFor(item.id);
        const here = item.id === currentBranchId;
        return (
          <Panel style={styles.row}>
            <View style={[styles.mark, { backgroundColor: tint(accent, 0.16) }]}>
              <MartText variant="heading" color={MART.ink}>
                {(item.name.trim()[0] ?? '?').toUpperCase()}
              </MartText>
            </View>
            <View style={{ flex: 1, gap: SPACE.xxs }}>
              <MartText variant="heading" numberOfLines={1}>
                {item.name}
              </MartText>
              {item.code ? (
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {item.code}
                </MartText>
              ) : null}
            </View>
            {here ? (
              <View style={[styles.hereTag, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
                <MartText variant="shelf" color={MART.fallbackPrimary}>
                  SIGNED IN HERE
                </MartText>
              </View>
            ) : null}
          </Panel>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  mark: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hereTag: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, borderRadius: RADIUS.pill },
});
