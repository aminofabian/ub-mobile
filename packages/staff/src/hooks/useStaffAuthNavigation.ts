import { useCallback } from 'react';
import { clearTenant, getEmbeddedTenantSlug } from '@kiosk/core';
import { useAuthStore } from '../store/auth-store';
import type { StaffBootPhase } from './useStaffBoot';

export function useStaffAuthNavigation(
  setPhase: (phase: StaffBootPhase) => void,
  onLeaveStore?: () => void
) {
  const { reset, setBranch } = useAuthStore();
  const canChangeStore = !getEmbeddedTenantSlug();

  const goToTenant = useCallback(async () => {
    if (!canChangeStore) {
      return;
    }
    await clearTenant();
    reset();
    onLeaveStore?.();
    setPhase('tenant');
  }, [canChangeStore, onLeaveStore, reset, setPhase]);

  const goToBranch = useCallback(() => {
    setBranch(null);
    setPhase('branch');
  }, [setBranch, setPhase]);

  return { canChangeStore, goToTenant, goToBranch };
}
