import type { NavigatorScreenParams } from '@react-navigation/native';
import type { OwnerTab } from '../lib/owner-access';

/** The bottom tabs of the Owner app. A person sees only the ones their role allows (see `visibleTabs`). */
export type OwnerTabParamList = Record<OwnerTab, undefined>;

/** What sits above the tabs: the screens that are opened from them. */
export type OwnerStackParamList = {
  Main: NavigatorScreenParams<OwnerTabParamList> | undefined;
  /** Says how many of an item are on the shelf. */
  SetStock: { itemId: string };
  /** One customer's tab. The figures are what the list said when it was opened; the screen reads them again. */
  CreditTab: { customerId: string; name: string; owedCents: number; phone: string | null };
  OrderPortal: undefined;
  ReceiveOrders: undefined;
  ReceiveOrderDetail: { purchaseOrderId: string };
  /** Who works at the shop. */
  Staff: undefined;
  /** The shop's last days of takings and profit. */
  Reports: undefined;
  /** The shop's details and the way through to the settings managed on the web. */
  Settings: undefined;
  /** The shop's catalogue: what it sells and each item's price. */
  Catalogue: undefined;
  /** The shops under this business. */
  Branches: undefined;
};
