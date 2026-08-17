import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createApiClient,
  clearTenant,
  getEmbeddedTenantSlug,
  getTenantDisplayName,
  logout,
  fetchBranches,
  type TenantContext,
} from '@kiosk/core';
import {
  TenantEntryScreen,
  PinLoginScreen,
  BranchSelectScreen,
  WhiteLabelErrorScreen,
  useAuthStore,
  useStaffBoot,
} from '@kiosk/staff';
import { createSyncEngine } from '@kiosk/offline';
import { createRealtimeClient } from '@kiosk/realtime';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';

export function App() {
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  const { tenant, setTenant, branchId, branchName, setBranch, isAuthenticated, setAuthenticated, reset } =
    useAuthStore();
  const { phase, setPhase, bootError, retry } = useStaffBoot(API_BASE_URL, setTenant);
  const canChangeStore = !getEmbeddedTenantSlug();
  const goToTenant = async () => {
    if (!canChangeStore) return;
    await clearTenant();
    reset();
    setBranches([]);
    setPhase('tenant');
  };
  const goToBranch = () => {
    setBranch(null);
    setPhase('branch');
  };
  const storeName = tenant?.displayName ?? getTenantDisplayName();
  const appTitle = storeName ? `${storeName} Cashier` : 'Kiosk Ke Cashier';

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

  useEffect(() => {
    if (phase !== 'branch' || branches.length) return;
    void fetchBranches(API_BASE_URL)
      .then(setBranches)
      .catch(() => setBranches([{ id: 'default', name: 'Main Branch' }]));
  }, [phase, branches.length]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = createSyncEngine({ api });
    sync.start();
    const realtime = createRealtimeClient(API_BASE_URL, api);
    void realtime.connect();
    return () => {
      sync.stop();
      realtime.disconnect();
    };
  }, [api, isAuthenticated]);

  const onTenantResolved = (t: TenantContext) => {
    setTenant(t);
    setPhase('branch');
  };

  const onBranchSelected = (branch: { id: string; name: string }) => {
    setBranch(branch);
    setPhase('login');
  };

  const onLoginSuccess = (fetchedBranches?: { id: string; name: string; code?: string }[]) => {
    setAuthenticated(true);
    if (fetchedBranches?.length) setBranches(fetchedBranches);
    setPhase('ready');
  };

  const handleLogout = async () => {
    await logout(API_BASE_URL);
    reset();
    setPhase('login');
  };

  if (phase === 'loading') return <View style={styles.container} />;

  if (phase === 'error' && bootError) {
    return <WhiteLabelErrorScreen message={bootError} onRetry={retry} />;
  }

  if (phase === 'tenant') {
    return (
      <TenantEntryScreen
        baseURL={API_BASE_URL}
        appTitle={appTitle}
        onTenantResolved={onTenantResolved}
      />
    );
  }

  if (phase === 'branch' && !branchId) {
    return (
      <BranchSelectScreen
        branches={branches.length ? branches : [{ id: 'default', name: 'Main Branch' }]}
        onSelect={onBranchSelected}
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
        onSuccess={onLoginSuccess}
        allowPassword
        storeName={storeName}
        branchName={branchName}
        onBack={goToBranch}
        onChangeStore={canChangeStore ? goToTenant : undefined}
      />
    );
  }

  return <AppNavigator api={api} tenant={tenant!} branchId={branchId!} onLogout={handleLogout} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
