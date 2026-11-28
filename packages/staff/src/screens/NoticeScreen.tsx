import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, RADIUS, SPACE, tint } from '../theme/mart';
import { MartButton, MartText, Screen } from '../theme/mart-ui';
import { Entrance } from '../theme/Entrance';
import type { Notice, NoticeActionId } from '../lib/notices';

interface NoticeScreenProps {
  notice: Pick<Notice, 'title' | 'body' | 'actions'>;
  onAction: (id: NoticeActionId) => void;
  /** An action is running: the buttons wait. */
  busy?: boolean;
}

/** A screen with something to say and one way forward, for the places a person can be stopped after signing in. */
export function NoticeScreen({ notice, onAction, busy = false }: NoticeScreenProps) {
  const brand = MART.fallbackPrimary;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Entrance delay={0} style={styles.card}>
          <View style={[styles.badge, { backgroundColor: tint(brand, 0.12) }]}>
            <Ionicons name="information-circle-outline" size={30} color={brand} />
          </View>
          <MartText variant="title" accessibilityRole="header" style={styles.title}>
            {notice.title}
          </MartText>
          <MartText variant="body" color={MART.inkMuted} style={styles.body}>
            {notice.body}
          </MartText>
          <View style={styles.actions}>
            {notice.actions.map((action) => (
              <MartButton
                key={action.id}
                label={action.label}
                kind={action.primary ? 'primary' : 'quiet'}
                onPress={() => onAction(action.id)}
                disabled={busy}
                style={styles.action}
              />
            ))}
          </View>
        </Entrance>

        <Entrance delay={120} style={styles.footerMark}>
          <View style={[styles.footerDot, { backgroundColor: brand }]} />
          <MartText variant="shelf" color={MART.inkQuiet}>
            POWERED BY KIOSK
          </MartText>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xxxl,
    gap: SPACE.xxl,
  },
  card: {
    alignItems: 'center',
    gap: SPACE.lg,
    padding: SPACE.xxl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: SPACE.sm, marginTop: SPACE.sm },
  action: {},
  footerMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 },
});
