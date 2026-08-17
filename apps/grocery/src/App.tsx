import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { createApiClient, clearTenant, getEmbeddedTenantSlug, getTenantDisplayName, logout, type TenantContext } from '@kiosk/core';
import {
  TenantEntryScreen,
  PinLoginScreen,
  BranchSelectScreen,
  WhiteLabelErrorScreen,
  useAuthStore,
  useStaffBoot,
} from '@kiosk/staff';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';

export function App() {
  const { tenant, setTenant, branchId, branchName, setBranch, isAuthenticated, setAuthenticated, reset } =
    useAuthStore();
  const { phase, setPhase, bootError, retry } = useStaffBoot(API_BASE_URL, setTenant);
  const canChangeStore = !getEmbeddedTenantSlug();
  const goToTenant = async () => {
    if (!canChangeStore) return;
    await clearTenant();
    reset();
    setPhase('tenant');
  };
  const goToBranch = () => {
    setBranch(null);
    setPhase('branch');
  };
  const storeName = tenant?.displayName ?? getTenantDisplayName();
  const appTitle = storeName ? `${storeName} Grocery` : 'Kiosk Ke Grocery';

  const api = useMemo(
    () =>
      createApiClient({
        baseURL: API_BASE_URL,
        onAuthFailed: () => {
          setAuthenticated(false);
          setPhase('login');
        },
      }),
    [setAuthenticated, setPhase]
  );

  if (phase === 'loading') return <View style={styles.container} />;
  if (phase === 'error' && bootError) {
    return <WhiteLabelErrorScreen message={bootError} onRetry={retry} />;
  }
  if (phase === 'tenant') {
    return (
      <TenantEntryScreen
        baseURL={API_BASE_URL}
        appTitle={appTitle}
        onTenantResolved={(t: TenantContext) => {
          setTenant(t);
          setPhase('branch');
        }}
      />
    );
  }
  if (phase === 'branch' && !branchId) {
    return (
      <BranchSelectScreen
        branches={[{ id: 'default', name: 'Main Branch' }]}
        onSelect={(b) => {
          setBranch(b);
          setPhase('login');
        }}
        storeName={storeName}
        onChangeStore={canChangeStore ? goToTenant : undefined}
      />
    );
  }
  if (phase === 'login' || !isAuthenticated) {
    return (
      <PinLoginScreen
        baseURL={API_BASE_URL}
        branchId={branchId!}
        onSuccess={() => {
          setAuthenticated(true);
          setPhase('ready');
        }}
        storeName={storeName}
        branchName={branchName}
        onBack={goToBranch}
        onChangeStore={canChangeStore ? goToTenant : undefined}
      />
    );
  }

  return (
    <AppNavigator
      api={api}
      branchId={branchId!}
      onLogout={async () => {
        await logout(API_BASE_URL);
        reset();
        setPhase('login');
      }}
    />
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' } });
