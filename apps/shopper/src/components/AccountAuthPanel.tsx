import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';
import { Button, Text } from '@kiosk/ui';
import {
  getAccessToken,
  loginWithPassword,
  logout,
  registerAccount,
  resendVerificationEmail,
  clearTokens,
} from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';

type AuthMode = 'login' | 'register';

export function AccountAuthPanel() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void getAccessToken().then((token) => setSignedIn(Boolean(token)));
  }, []);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Missing name', 'Enter your name to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await registerAccount(
          API_BASE_URL,
          name.trim(),
          email.trim(),
          password
        );
        Alert.alert(
          'Account created',
          result.verificationUrl
            ? `Check your email to verify your account.\n\nDev link:\n${result.verificationUrl}`
            : 'Check your email to verify your account before signing in.'
        );
        setMode('login');
      } else {
        await loginWithPassword(API_BASE_URL, email.trim(), password);
        setSignedIn(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      const needsVerification = /email not verified|verify/i.test(message);
      if (needsVerification && email.trim()) {
        Alert.alert('Sign in failed', message, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resend verification',
            onPress: () => {
              void resendVerificationEmail(API_BASE_URL, email.trim())
                .then((result) => {
                  Alert.alert(
                    'Verification sent',
                    result.verificationUrl
                      ? `Open this link to verify:\n\n${result.verificationUrl}`
                      : 'Check your email for a new verification link.'
                  );
                })
                .catch((err) => {
                  Alert.alert(
                    'Could not resend',
                    err instanceof Error ? err.message : 'Try again later.'
                  );
                });
            },
          },
        ]);
      } else {
        Alert.alert(mode === 'register' ? 'Sign up failed' : 'Sign in failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await logout(API_BASE_URL);
    } catch {
      await clearTokens();
    }
    setSignedIn(false);
  };

  if (signedIn) {
    return (
      <View style={styles.panel}>
        <Text variant="body">Signed in as {email || 'your account'}</Text>
        <Button title="Sign out" variant="secondary" onPress={signOut} style={styles.button} />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text variant="h2">{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
      {mode === 'register' && (
        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          accessibilityLabel="Full name"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Email"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel="Password"
      />
      <Button
        title={loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
        onPress={submit}
        disabled={loading}
      />
      <Button
        title={mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        variant="secondary"
        onPress={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    backgroundColor: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    minHeight: 48,
  },
  button: {
    marginTop: 12,
  },
});
