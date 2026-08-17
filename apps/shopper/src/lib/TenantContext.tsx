import React, { createContext, useContext } from 'react';
import { TenantContext as CoreTenantContext } from '@kiosk/core';

const TenantContext = createContext<CoreTenantContext | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: CoreTenantContext;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): CoreTenantContext {
  const tenant = useContext(TenantContext);
  if (!tenant) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return tenant;
}
