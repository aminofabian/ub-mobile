import { getAccessToken } from '@kiosk/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchMe, fetchShopperHub } from '../api/account';
import { forgetDepletionAlertRegistration, registerForDepletionAlerts } from '../lib/push';

export function useSession() {
  const queryClient = useQueryClient();

  const tokenQuery = useQuery({
    queryKey: ['access-token'],
    queryFn: getAccessToken,
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
