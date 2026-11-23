import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { AuthBackBar } from '../components/AuthBackBar';
import type { Notice, NoticeActionId } from '../lib/notices';

interface NoticeScreenProps {
  notice: Pick<Notice, 'title' | 'body' | 'actions'>;
  onAction: (id: NoticeActionId) => void;
  /** An action is running: the buttons wait. */
  busy?: boolean;
}

/** A screen with something to say and one way forward, for the places a person can be stopped after signing in. */
export function NoticeScreen({ notice, onAction, busy = false }: NoticeScreenProps) {
  return (
    <View style={styles.container}>
      <AuthBackBar />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="h1" accessibilityRole="header">
          {notice.title}
        </Text>
        <Text variant="body" style={styles.body}>
          {notice.body}
        </Text>
        {notice.actions.map((action) => (
          <Button
            key={action.id}
            title={action.label}
            variant={action.primary ? 'primary' : 'secondary'}
            onPress={() => onAction(action.id)}
            disabled={busy}
            style={styles.action}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: { flexGrow: 1, justifyContent: 'center' },
  body: { marginVertical: theme.spacing.lg, color: theme.colors.textMuted },
  action: { marginTop: theme.spacing.md },
});
