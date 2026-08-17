import React, { useState } from 'react';
import { StyleSheet, TextInput, View, ActivityIndicator } from 'react-native';
import { Text, Button } from '@kiosk/ui';
import { resolveShopperStore, type TenantContext } from '@kiosk/core';
import { API_BASE_URL, TENANT_HOST_SUFFIX } from '../lib/config';

interface TenantEntryScreenProps {
  onTenantResolved: (tenant: TenantContext) => void;
}

export function TenantEntryScreen({ onTenantResolved }: TenantEntryScreenProps) {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!slug.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const tenant = await resolveShopperStore(slug.trim(), API_BASE_URL, {
        hostSuffixes: [TENANT_HOST_SUFFIX],
      });
      onTenantResolved(tenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve store');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text variant="h1">Enter your store</Text>
      <Text variant="body">Shop from your favorite Kiosk Ke business</Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. palmart"
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Store slug"
      />
      <Text variant="muted">{slug ? `${slug}.${TENANT_HOST_SUFFIX}` : `yourstore.${TENANT_HOST_SUFFIX}`}</Text>
      <Text variant="muted" style={styles.apiHint}>API: {API_BASE_URL}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator size="large" color="#28a745" style={styles.loader} />
      ) : (
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!slug.trim()}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  button: {
    marginTop: 24,
  },
  loader: {
    marginTop: 24,
  },
  apiHint: {
    marginTop: 4,
    fontSize: 12,
  },
  error: {
    color: '#dc3545',
    marginTop: 16,
  },
});
