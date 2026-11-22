import { useCallback } from 'react';
import { getEmbeddedTenantSlug } from '@kiosk/core';
import { leaveStore } from '../lib/store-switch';
import { useAuthStore } from '../store/auth-store';
import type { StaffBootPhase } from './useStaffBoot';

export function useStaffAuthNavigation(
  setPhase: (phase: StaffBootPhase) => void,
  onLeaveStore?: () => void
) {
  const { reset, setBranch, tenant } = useAuthStore();
  const canChangeStore = !getEmbeddedTenantSlug();

  const goToTenant = useCallback(async () => {
    if (!canChangeStore) {
      return;
    }
    // Sales that were never sent are asked about first; leaving without confirming changes nothing.
    if (!(await leaveStore(tenant?.displayName))) {
      return;
    }
    reset();
    onLeaveStore?.();
    setPhase('tenant');
  }, [canChangeStore, onLeaveStore, reset, setPhase, tenant?.displayName]);

  const goToBranch = useCallback(() => {
    setBranch(null);
    setPhase('branch');
  }, [setBranch, setPhase]);

  return { canChangeStore, goToTenant, goToBranch };
}
