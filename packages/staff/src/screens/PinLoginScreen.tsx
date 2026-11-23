import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { loginWithPin, loginWithPassword, fetchBranches, type BranchOption } from '@kiosk/core';
import { AuthBackBar } from '../components/AuthBackBar';

interface PinLoginScreenProps {
  baseURL: string;
  branchId: string;
  onSuccess: (branches?: BranchOption[]) => void;
  allowPassword?: boolean;
  storeName?: string | null;
  branchName?: string | null;
  onBack?: () => void;
  onChangeStore?: () => void;
}

/**
 * @deprecated No app uses this any more: `StaffShell` signs people in (`SignInScreen`), asks the server who they
 * are, and finds their branch. Kept exported until a release has gone out without it; it still sends the branch
 * chosen before sign-in and shows server errors in a system dialog.
 */
export function PinLoginScreen({
  baseURL,
  branchId,
  onSuccess,
  allowPassword = false,
  storeName,
  branchName,
  onBack,
  onChangeStore,
}: PinLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      if (usePassword && allowPassword) {
        await loginWithPassword(baseURL, email.trim(), password);
      } else {
        if (pin.length < 4) {
          Alert.alert('Error', 'Enter your PIN');
          return;
        }
        await loginWithPin(baseURL, email.trim(), pin, branchId);
      }
      const branches = await fetchBranches(baseURL);
      onSuccess(branches);
    } catch (e) {
      Alert.alert('Login failed', e instanceof Error ? e.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const contextBits = [branchName, storeName].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <AuthBackBar
        onBack={onBack}
        backLabel="Back"
        onSecondary={onChangeStore}
        secondaryLabel="Change store"
      />
      <View style={styles.form}>
      <Text variant="h1">Sign in</Text>
      {contextBits ? (
        <Text variant="muted" style={styles.context}>
          {contextBits}
        </Text>
      ) : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Email"
      />
      {usePassword ? (
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          accessibilityLabel="Password"
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="PIN"
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          accessibilityLabel="PIN"
        />
      )}
      <Button title={loading ? 'Signing in...' : 'Sign in'} onPress={login} disabled={loading} />
      {allowPassword && (
        <Button
          title={usePassword ? 'Use PIN instead' : 'Use password instead'}
          variant="secondary"
          onPress={() => setUsePassword((v) => !v)}
          style={styles.secondary}
        />
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
  context: {
    marginBottom: theme.spacing.lg,
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
