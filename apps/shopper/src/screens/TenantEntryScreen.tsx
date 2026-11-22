import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { describeStoreResult, openStore, type TenantContext } from '@kiosk/core';
import { API_BASE_URL, TENANT_HOST_SUFFIX } from '../lib/config';
import { PLATFORM_NAME } from '../lib/brand';
import { MART, ON_BRAND, RADIUS, SPACE, TYPE } from '../theme/mart';

interface TenantEntryScreenProps {
  onTenantResolved: (tenant: TenantContext) => void;
}

export function TenantEntryScreen({ onTenantResolved }: TenantEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const [slug, setSlug] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const trimmed = slug.trim();

  async function handleContinue() {
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await openStore(trimmed, API_BASE_URL, { audience: 'shopper' });
      if (result.kind === 'opened') {
        onTenantResolved(result.store);
      } else if (result.kind === 'not_found') {
        setError(`No store answers at ${trimmed}.${TENANT_HOST_SUFFIX}. Check the spelling with the till.`);
      } else if (result.kind === 'blocked') {
        // A shopper phone holds no queued sales, so a switch is never held up. Kept so the result is not ignored.
        setError('Could not switch stores right now. Try again.');
      } else {
        setError(describeStoreResult(result, trimmed));
      }
    } catch {
      setError('Something went wrong opening that store. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.mark}>
          <Text style={styles.markText}>{PLATFORM_NAME}</Text>
          <View style={styles.markRule} />
        </View>

        <Text style={styles.title}>Which store are you shopping?</Text>
        <Text style={styles.body}>
          Enter the short name on your receipt or shelf tag and we will open that shop.
        </Text>

        <View style={[styles.field, focused && styles.fieldFocused, Boolean(error) && styles.fieldError]}>
          <TextInput
            style={styles.input}
            placeholder="your-shop"
            placeholderTextColor={MART.inkQuiet}
            value={slug}
            onChangeText={(value) => {
              setSlug(value);
              setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={() => void handleContinue()}
            returnKeyType="go"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Store short name"
          />
          <Text style={styles.suffix}>.{TENANT_HOST_SUFFIX}</Text>
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void handleContinue()}
          disabled={!trimmed || loading}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            (!trimmed || loading) && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={ON_BRAND.primary} />
          ) : (
            <Text style={styles.ctaLabel}>Open this store</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    paddingHorizontal: SPACE.xl,
  },
  mark: {
    alignSelf: 'flex-start',
    marginBottom: SPACE.xxl,
  },
  markText: {
    ...TYPE.title,
    color: MART.fallbackPrimary,
  },
  markRule: {
    marginTop: SPACE.xs,
    height: 2,
    backgroundColor: MART.fallbackAccent,
  },
  title: {
    ...TYPE.display,
    color: MART.ink,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  field: {
    marginTop: SPACE.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
  },
  fieldFocused: {
    borderColor: MART.fallbackPrimary,
  },
  fieldError: {
    borderColor: MART.danger,
  },
  input: {
    flex: 1,
    minHeight: 52,
    ...TYPE.heading,
    color: MART.ink,
  },
  suffix: {
    ...TYPE.label,
    color: MART.inkQuiet,
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    color: MART.danger,
  },
  cta: {
    marginTop: SPACE.xl,
    minHeight: 52,
    borderRadius: RADIUS.md,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
