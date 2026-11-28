export * from './theme/mart';
export * from './theme/mart-ui';
export * from './theme/CardGloss';
export * from './theme/Gloss';

/** The counter's typeface, ready for `useFonts`: the same files every staff app is set in. */
export const DM_SANS = {
  DMSans_400Regular: require('../assets/fonts/DMSans-Regular.ttf'),
  DMSans_500Medium: require('../assets/fonts/DMSans-Medium.ttf'),
  DMSans_600SemiBold: require('../assets/fonts/DMSans-SemiBold.ttf'),
  DMSans_700Bold: require('../assets/fonts/DMSans-Bold.ttf'),
};
export * from './components/Sheet';
export * from './components/VerifiedBadge';
export * from './components/FlyToCart';
export * from './components/WeightSheet';
export * from './components/ShelfTile';
export * from './store/auth-store';
export * from './hooks/useStaffBoot';
export * from './hooks/useStaffAuthNavigation';
export * from './hooks/useKept';
export * from './hooks/useFlushLoop';
export * from './hooks/useItemSearch';
export * from './components/ItemPicker';
export * from './lib/stock-calls';
export * from './lib/store-switch';
export * from './screens/TenantEntryScreen';
export * from './screens/PinLoginScreen';
export * from './screens/BranchSelectScreen';
export * from './screens/WhiteLabelErrorScreen';
export * from './screens/SetStockScreen';
export * from './screens/SpoilsScreen';
export { StaffShell, type StaffSession, type StaffShellProps } from './screens/StaffShell';
export type { PairScannerProps, PairScannerRenderer } from './screens/PairScreen';
