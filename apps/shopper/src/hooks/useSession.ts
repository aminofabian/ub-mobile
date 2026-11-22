import { getAccessToken } from '@kiosk/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchMe, fetchShopperHub } from '../api/account';
import { useTenant } from '../lib/TenantContext';
import { forgetDepletionAlertRegistration, registerForDepletionAlerts } from '../lib/push';

export function useSession() {
  const queryClient = useQueryClient();
  const tenant = useTenant();

  // The session belongs to a store, so the question is asked per store. It is keyed by the store's address, which
  // never changes, and not its id: a store carried over from the old layout is given its confirmed id while the
  // app is open, and the session moves with it. The token is read for the store that is open when the question runs.
  const tokenQuery = useQuery({
    queryKey: ['access-token', tenant.slug],
    queryFn: () => getAccessToken(),
  });

  const signedIn = Boolean(tokenQuery.data);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: signedIn,
    retry: false,
  });

  const hubQuery = useQuery({
    queryKey: ['shopper-hub'],
    queryFn: () => fetchShopperHub(0, 20),
    enabled: signedIn,
    retry: false,
  });

  // The device token lives with the session, so it is claimed on sign-in and
  // released on sign-out. Both calls are idempotent, so mounting this hook from
  // several screens costs nothing.
  useEffect(() => {
    if (signedIn) {
      void registerForDepletionAlerts();
    } else {
      forgetDepletionAlertRegistration();
    }
  }, [signedIn]);

  function refreshAuth() {
    void queryClient.invalidateQueries({ queryKey: ['access-token'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
    void queryClient.invalidateQueries({ queryKey: ['shopper-hub'] });
  }

  return {
    signedIn,
    tokenLoading: tokenQuery.isLoading,
    me: meQuery.data,
    hub: hubQuery.data,
    hubLoading: meQuery.isLoading || hubQuery.isLoading,
    hubError: meQuery.error || hubQuery.error,
    refreshAuth,
  };
}
