import React, { useMemo } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View  } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BranchOption } from '@kiosk/core';
import { FONT, MART, onFill, RADIUS, SPACE, tint, TYPE, zoneFor } from '../theme/mart';
import { MartText, Screen } from '../theme/mart-ui';
import { Entrance } from '../theme/Entrance';

interface BranchSelectScreenProps {
  branches: BranchOption[];
  onSelect: (branch: BranchOption) => void;
  storeName?: string | null;
  onChangeStore?: () => void;
  /** The heading. Defaults to "Select branch". */
  title?: string;
  /** The label of the way out at the top. Defaults to "Change store"; after sign-in it is "Sign out". */
  backLabel?: string;
}

export function BranchSelectScreen({
  branches,
  onSelect,
  storeName,
  onChangeStore,
  title = 'Pick a branch',
  backLabel = 'Change store',
}: BranchSelectScreenProps) {
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = useMemo(() => {
    const parts = (storeName ?? 'Kiosk').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'K').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }, [storeName]);

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Entrance delay={0} style={[styles.pass, { backgroundColor: brand }]}>
          <View style={[styles.glow, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbOne, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbTwo, { backgroundColor: on.hairline }]} pointerEvents="none" />
          <View style={styles.passTop}>
            <View style={styles.passBrand}>
              <View style={[styles.plaque, { backgroundColor: on.primary }]}>
                <MartText variant="title" color={brand} style={styles.plaqueMark}>
                  {initials}
                </MartText>
              </View>
              <View style={styles.passNames}>
                <MartText variant="shelf" color={on.secondary} numberOfLines={1} style={styles.passEyebrow}>
                  STAFF · KIOSK
                </MartText>
                <MartText variant="heading" color={on.primary} numberOfLines={1}>
                  {storeName ?? 'Your shop'}
                </MartText>
              </View>
            </View>
            {onChangeStore ? (
              <Pressable
                onPress={onChangeStore}
                accessibilityRole="button"
                accessibilityLabel={backLabel}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.storeChip,
                  { borderColor: on.hairline, backgroundColor: on.wash },
                  pressed && styles.pressed,
                ]}
              >
                <MartText variant="shelf" color={on.primary} style={styles.storeChipText}>
                  {backLabel}
                </MartText>
              </Pressable>
            ) : null}
          </View>
          <MartText variant="display" color={on.primary} style={styles.passTitle}>
            {title}
          </MartText>
          <MartText variant="body" color={on.secondary} style={styles.passHint}>
            {branches.length === 1
              ? 'One branch is open to you.'
              : `You can work at ${branches.length} branches — choose one to open.`}
          </MartText>
        </Entrance>

        <Entrance delay={90} style={styles.list}>
          {branches.map((item) => {
            const accent = zoneFor(item.id);
            const storeWords = new Set(
              (storeName ?? '')
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                .split(/\s+/)
                .filter(Boolean)
            );
            const words = item.name
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .trim()
              .split(/\s+/)
              .filter(Boolean);
            // "Tumaini Mini Mart — Town" is the shop's own name plus a place: the place is what tells them apart.
            const own = words.filter((word) => !storeWords.has(word.toLowerCase()));
            const mark = (own.length > 0 ? own : words)
              .slice(0, 2)
              .map((word) => word[0]?.toUpperCase() ?? '')
              .join('');
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item)}
                accessibilityRole="button"
                accessibilityLabel={`Open branch ${item.name}`}
                style={({ pressed }) => [styles.place, pressed && styles.placePressed]}
              >
                {/* Each branch keeps its own colour, so the place is recognised before the name is read. */}
                <View style={[styles.placeWell, { backgroundColor: tint(accent, 0.16) }]}>
                  <MartText variant="display" color={tint(MART.ink, 0.62)} style={styles.placeMark}>
                    {mark}
                  </MartText>
                </View>
                <View style={styles.placeBody}>
                  <View style={styles.placeText}>
                    <MartText variant="heading" numberOfLines={2}>
                      {item.name}
                    </MartText>
                    {item.code ? (
                      <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                        {item.code}
                      </MartText>
                    ) : (
                      <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                        Open this till
                      </MartText>
                    )}
                  </View>
                  <View style={[styles.placeGo, { backgroundColor: tint(brand, 0.1) }]}>
                    <Ionicons name="arrow-forward" size={16} color={brand} />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </Entrance>

        <Entrance delay={180} style={styles.footer}>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.footerText}>
            Each branch keeps its own tills, stock and takings.
          </MartText>
          <View style={styles.footerMark}>
            <View style={[styles.footerDot, { backgroundColor: brand }]} />
            <MartText variant="shelf" color={MART.inkQuiet}>
              POWERED BY KIOSK
            </MartText>
          </View>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const EDGE = SPACE.xxl; // 28

const styles = StyleSheet.create({
  container: { paddingHorizontal: 0, paddingBottom: SPACE.lg },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: Platform.select({ ios: 72, android: 40, default: 72 }),
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: 'hidden',
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 999, top: -160, left: -80, opacity: 0.5 },
  orb: { position: 'absolute', borderRadius: 999 },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  passTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    marginBottom: SPACE.lg,
  },
  passBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  plaque: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MART.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  plaqueMark: { letterSpacing: -0.5 },
  passNames: { flex: 1, gap: 2 },
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  place: {
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    overflow: 'hidden',
    shadowColor: MART.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  placePressed: { transform: [{ scale: 0.985 }], shadowOpacity: 0.16 },
  placeWell: { height: 72, alignItems: 'center', justifyContent: 'center' },
  placeMark: { letterSpacing: -1 },
  placeBody: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  placeText: { flex: 1, gap: 2 },
  placeGo: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passRing: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  passMark: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  passMonogram: { ...TYPE.label, fontFamily: FONT.black },
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  storeChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  storeChipText: { letterSpacing: 0.2 },
  pressed: { opacity: 0.6 },
  // The branches ride up into the header's curve as a column of place cards, each one its own object.
  list: {
    marginTop: SPACE.md,
    marginHorizontal: SPACE.lg,
    gap: SPACE.md,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm,
  },
  rowPressed: { opacity: 0.55 },
  rowDot: { width: 10, height: 10, borderRadius: RADIUS.pill },
  rowBody: { flex: 1, gap: SPACE.xxs },
  // A hairline between rows, inset so it clears the dot and the chevron.
  rowRule: {
    position: 'absolute',
    left: SPACE.sm + 10 + SPACE.md,
    right: SPACE.sm,
    bottom: 0,
    height: 1,
    backgroundColor: MART.border,
  },
  footer: { marginTop: 'auto', paddingTop: SPACE.xxl, paddingHorizontal: SPACE.lg, alignItems: 'center', gap: SPACE.lg },
  footerText: { textAlign: 'center', maxWidth: 300 },
  footerMark: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 },
});
