import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { describeStoreResult, openStore, resolveTenantByEmail, type TenantContext } from '@kiosk/core';
import { AuthBackBar } from '../components/AuthBackBar';
import { confirmLeavingUnsent } from '../lib/store-switch';

interface TenantEntryScreenProps {
  baseURL: string;
  appTitle: string;
  onTenantResolved: (tenant: TenantContext) => void;
}

export function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }: TenantEntryScreenProps) {
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  /** Opens the store and tells the screen, or tells the person why it could not be opened. */
  const open = async (value: string, keepUnsent = false): Promise<void> => {
    const result = await openStore(value, baseURL, { audience: 'staff', keepUnsent });
    if (result.kind === 'opened') {
      onTenantResolved(result.store);
      return;
    }
    if (result.kind === 'blocked') {
      if (await confirmLeavingUnsent(result.unsent)) {
        await open(value, true);
      }
      return;
    }
    Alert.alert('Could not open store', describeStoreResult(result, value));
  };

  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await open(input.trim());
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not resolve tenant');
    } finally {
      setLoading(false);
    }
  };

  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await resolveTenantByEmail(baseURL, email.trim());
      await open(result.host);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not find tenant for email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AuthBackBar />
      <View style={styles.form}>
      <Text variant="h1">{appTitle}</Text>
      <Text variant="body" style={styles.subtitle}>
        Enter your business slug or host
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. your-shop"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Business slug or host"
      />
      <Button title={loading ? 'Loading...' : 'Continue'} onPress={resolve} disabled={loading} />

      <Button
        title={showEmailFallback ? 'Hide email lookup' : 'Find by email'}
        variant="secondary"
        onPress={() => setShowEmailFallback((v) => !v)}
        style={styles.secondary}
      />

      {showEmailFallback && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Staff email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            accessibilityLabel="Staff email"
          />
          <Button
            title="Look up tenant"
            variant="secondary"
            onPress={resolveByEmail}
            disabled={loading}
          />
        </>
      )}
      </View>
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
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: 16,
    minHeight: 48,
  },
  secondary: {
    marginTop: theme.spacing.md,
  },
});
