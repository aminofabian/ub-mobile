import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SpoilsScreen } from '@kiosk/staff';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'WriteOff'>;

/** The list of stock to write off. Opens with the item it was reached from already being added. */
export function WriteOffRoute({ route }: Props) {
  const { api, tenantId, branchId, userId, renderScanner } = useStockSession();
  const addItem = route.params?.item;
  return (
    <SpoilsScreen
      api={api}
      tenantId={tenantId}
      branchId={branchId}
      ownerId={userId}
      {...(addItem ? { addItem } : {})}
      {...(renderScanner ? { renderScanner } : {})}
    />
  );
}
