/**
 * The admin's theme is the platform's theme.
 *
 * This file used to be a copy, and copies drift: the admin was still green and set in Poppins while the till and the
 * counter had moved to amber and DM Sans. It is now a re-export, so one change in `@kiosk/staff` reaches every staff
 * app at once and there is nothing left here to forget.
 */
export {
  MART,
  ZONE,
  zoneFor,
  RADIUS,
  SPACE,
  GUTTER,
  FONT,
  WEIGHT,
  TYPE,
  ELEVATION,
  SHADOW,
  HAIRLINE,
  SPRING,
  SETTLE,
  MOTION,
  tint,
  onFill,
  ON_BRAND,
  martFromTenant,
  TILE,
} from '@kiosk/staff';

export type { OnFill, MartPalette } from '@kiosk/staff';
