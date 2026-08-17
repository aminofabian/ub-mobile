import * as zustand from 'zustand';
import { TenantContext, BranchOption } from '@kiosk/core';
import * as react_jsx_runtime from 'react/jsx-runtime';

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
declare const useAuthStore: zustand.UseBoundStore<zustand.StoreApi<AuthState>>;

type StaffBootPhase = 'loading' | 'tenant' | 'branch' | 'login' | 'ready' | 'error';
declare function useStaffBoot(baseURL: string, setTenant: (tenant: TenantContext) => void): {
    phase: StaffBootPhase;
    setPhase: (phase: StaffBootPhase) => void;
    bootError: string | null;
    retry: () => void;
};

declare function useStaffAuthNavigation(setPhase: (phase: StaffBootPhase) => void, onLeaveStore?: () => void): {
    canChangeStore: boolean;
    goToTenant: () => Promise<void>;
    goToBranch: () => void;
};

interface TenantEntryScreenProps {
    baseURL: string;
    appTitle: string;
    onTenantResolved: (tenant: TenantContext) => void;
}
declare function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }: TenantEntryScreenProps): react_jsx_runtime.JSX.Element;

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
declare function PinLoginScreen({ baseURL, branchId, onSuccess, allowPassword, storeName, branchName, onBack, onChangeStore, }: PinLoginScreenProps): react_jsx_runtime.JSX.Element;

interface BranchSelectScreenProps {
    branches: BranchOption[];
    onSelect: (branch: BranchOption) => void;
    storeName?: string | null;
    onChangeStore?: () => void;
}
declare function BranchSelectScreen({ branches, onSelect, storeName, onChangeStore, }: BranchSelectScreenProps): react_jsx_runtime.JSX.Element;

interface WhiteLabelErrorScreenProps {
    message: string;
    onRetry: () => void;
}
declare function WhiteLabelErrorScreen({ message, onRetry }: WhiteLabelErrorScreenProps): react_jsx_runtime.JSX.Element;

export { BranchSelectScreen, PinLoginScreen, type StaffBootPhase, TenantEntryScreen, WhiteLabelErrorScreen, useAuthStore, useStaffAuthNavigation, useStaffBoot };
