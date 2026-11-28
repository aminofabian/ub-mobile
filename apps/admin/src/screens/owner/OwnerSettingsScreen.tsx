import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Panel, Row, ScreenHeader, SectionHead } from '../../components/owner-ui';
import { FONT, GUTTER, MART, RADIUS, SPACE, tint, TYPE } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';
import { fetchCreditTabsSettings, setRequirePhoneVerification, type ApiClient } from '@kiosk/core';

type Props = {
  api: ApiClient;
  host: string;
  shopName: string;
  branchName: string | null;
  onOpenCatalogue: () => void;
  onOpenBranches: () => void;
};

type IconName = keyof typeof Ionicons.glyphMap;

// What the app shows natively, read from the server. Prices and branches have real data here.
const IN_APP: readonly { icon: IconName; title: string; subtitle: string; open: 'catalogue' | 'branches' }[] = [
  { icon: 'pricetags-outline', title: 'Prices & catalogue', subtitle: 'What the shop sells and what it costs', open: 'catalogue' },
  { icon: 'git-branch-outline', title: 'Branches', subtitle: 'The shops under this business', open: 'branches' },
];

/**
 * The shop at a glance, then the things it can show natively: prices and branches. Receipts and payment
 * setup are not on the phone; a quiet note says so rather than a link off to the web.
 */
export function OwnerSettingsScreen({ api, host, shopName, branchName, onOpenCatalogue, onOpenBranches }: Props) {
  /** The shop's credit rule: null while it is being read, so the switch never shows a guess. */
  const [requireVerification, setRequireVerification] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCreditTabsSettings(api).then(
      (settings) => alive && setRequireVerification(settings.requirePhoneVerificationForNewTabCustomers),
      () => alive && setRequireVerification(false)
    );
    return () => {
      alive = false;
    };
  }, [api]);

  const toggleVerification = useCallback(async () => {
    if (busy || requireVerification === null) return;
    setBusy(true);
    setProblem(null);
    try {
      const settings = await setRequirePhoneVerification(api, !requireVerification);
      setRequireVerification(settings.requirePhoneVerificationForNewTabCustomers);
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'Could not change that setting.');
    } finally {
      setBusy(false);
    }
  }, [api, busy, requireVerification]);

  const initials =
    (shopName.trim().split(/\s+/)[0]?.[0] ?? '?').toUpperCase() + (shopName.trim().split(/\s+/)[1]?.[0] ?? '').toUpperCase();
  const prettyHost = (host ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Appear delay={0} style={{ paddingBottom: SPACE.xs }}>
        <ScreenHeader title="Settings" />
      </Appear>

      {/* The shop's identity card: monogram, name, web address, branch. */}
      <Appear delay={70}>
        <Panel style={styles.shopCard}>
          <View style={[styles.logo, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
            <MartText style={[styles.logoText, { color: MART.fallbackPrimary }]}>{initials}</MartText>
          </View>
          <MartText variant="title" numberOfLines={2} style={{ textAlign: 'center' }}>
            {shopName}
          </MartText>
          <View style={styles.metaRow}>
            {prettyHost ? (
              <View style={styles.metaPill}>
                <Ionicons name="globe-outline" size={13} color={MART.inkMuted} />
                <MartText variant="meta" color={MART.inkMuted} numberOfLines={1}>
                  {prettyHost}
                </MartText>
              </View>
            ) : null}
            {branchName ? (
              <View style={styles.metaPill}>
                <Ionicons name="location-outline" size={13} color={MART.inkMuted} />
                <MartText variant="meta" color={MART.inkMuted} numberOfLines={1}>
                  {branchName}
                </MartText>
              </View>
            ) : null}
          </View>
        </Panel>
      </Appear>

      <Appear delay={120} style={{ gap: SPACE.md }}>
        <SectionHead>Credit</SectionHead>
        <Panel style={{ gap: SPACE.sm }}>
          <Pressable
            onPress={() => void toggleVerification()}
            disabled={busy || requireVerification === null}
            accessibilityRole="switch"
            accessibilityState={{ checked: requireVerification === true, disabled: busy }}
            accessibilityLabel="Require customer verification before granting credit"
            style={({ pressed }) => [styles.toggleRow, pressed && { opacity: 0.75 }]}
          >
            <Ionicons
              name={requireVerification ? 'toggle' : 'toggle-outline'}
              size={30}
              color={requireVerification ? MART.fallbackPrimary : MART.inkQuiet}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <MartText variant="label">Require customer verification before granting credit</MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                {requireVerification
                  ? 'A customer must have a verified number before a tab opens for them.'
                  : 'Off: anyone can take credit, verified or not. The badge only says who has been checked.'}
              </MartText>
            </View>
            {busy ? <ActivityIndicator color={MART.inkQuiet} /> : null}
          </Pressable>
          {problem ? (
            <MartText variant="meta" color={MART.danger}>
              {problem}
            </MartText>
          ) : null}
        </Panel>
      </Appear>

      <Appear delay={140} style={{ gap: SPACE.md }}>
        <SectionHead>In the app</SectionHead>
        {IN_APP.map((entry) => (
          <Row
            key={entry.title}
            icon={entry.icon}
            title={entry.title}
            subtitle={entry.subtitle}
            onPress={entry.open === 'catalogue' ? onOpenCatalogue : onOpenBranches}
          />
        ))}
      </Appear>

      <Appear delay={200} style={styles.note}>
        <Ionicons name="lock-closed-outline" size={15} color={MART.inkQuiet} />
        <MartText variant="meta" color={MART.inkQuiet} style={{ flex: 1 }}>
          Receipts and payment setup are changed from a computer, where there is room to get them right.
        </MartText>
      </Appear>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { padding: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  shopCard: { alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.xl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { ...TYPE.title, fontFamily: FONT.black },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    maxWidth: '100%',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.sm,
    paddingTop: SPACE.sm,
    paddingHorizontal: SPACE.xs,
  },
});
