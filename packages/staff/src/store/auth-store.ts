import { create } from 'zustand';
import type { BranchOption, TenantContext } from '@kiosk/core';

interface AuthState {
  tenant: TenantContext | null;
  branchId: string | null;
  branchName: string | null;
  email: string | null;
  isAuthenticated: boolean;
  setTenant: (tenant: TenantContext | null) => void;
  setBranch: (branch: BranchOption | null) => void;
  setEmail: (email: string) => void;
  setAuthenticated: (value: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  tenant: null,
  branchId: null,
  branchName: null,
  email: null,
  isAuthenticated: false,
  setTenant: (tenant) => set({ tenant }),
  setBranch: (branch) =>
    set({ branchId: branch?.id ?? null, branchName: branch?.name ?? null }),
  setEmail: (email) => set({ email }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  reset: () =>
    set({
      tenant: null,
      branchId: null,
      branchName: null,
      email: null,
      isAuthenticated: false,
    }),
}));
