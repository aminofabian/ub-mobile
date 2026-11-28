import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { StockItem } from '@kiosk/core';
import { ItemPicker, Sheet } from '@kiosk/staff';
import { ItemDrawer } from '../components/ItemDrawer';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Items'>;

/**
 * The shop's items at this branch: search, scan, and the Low and Out filters.
 *
 * A tile does not carry the person to another page. It raises the item's drawer over the lower part of the list, so the
 * shelf stays visible behind it and the drawer closes back onto exactly where it was opened.
 */
export function ItemsScreen({ navigation, route }: Props) {
  const { api, branchId, mayWrite, renderScanner } = useStockSession();
  const [open, setOpen] = useState<StockItem | null>(null);

  return (
    <>
      <ItemPicker
        api={api}
        branchId={branchId}
        withFilters
        cards
        initialFilter={route.params?.filter ?? 'all'}
        onPick={(item) => setOpen(item)}
        {...(renderScanner ? { renderScanner } : {})}
      />
      <Sheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={open ? String(open.name) : 'Item'}
        maxHeight="62%"
      >
        {open ? (
          <ItemDrawer
            api={api}
            branchId={branchId}
            itemId={open.id}
            mayWrite={mayWrite}
            onSetStock={(item) => {
              setOpen(null);
              navigation.navigate('SetStock', { itemId: item.id });
            }}
            onWriteOff={(item) => {
              setOpen(null);
              navigation.navigate('WriteOff', { item });
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}
