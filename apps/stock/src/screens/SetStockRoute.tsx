import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SetStockScreen } from '@kiosk/staff';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'SetStock'>;

/** Says how many of an item are on the shelf. Opens on the item it was reached from, or asks which. */
export function SetStockRoute({ route }: Props) {
  const { api, branchId, renderScanner } = useStockSession();
  const itemId = route.params?.itemId;
  return <SetStockScreen api={api} branchId={branchId} {...(itemId ? { itemId } : {})} {...(renderScanner ? { renderScanner } : {})} />;
}
