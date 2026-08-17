# Palmart mobile release (EAS)

One-time setup, then build and submit white-label Palmart apps to the stores.

## Prerequisites

- [Expo account](https://expo.dev/signup) and `npm i -g eas-cli`
- Apple Developer Program membership (iOS)
- Google Play Console account (Android)
- Register bundle IDs in Apple / package names in Google:
  - `com.palmart.cashier`, `com.palmart.shopper`, `com.palmart.grocery`, `com.palmart.admin`, `com.palmart.stock`

## 1. Generate branding assets

```bash
cd mobile
pnpm assets:tenant palmart      # creates tenants/palmart/assets/*.png
pnpm assets:default             # copies into apps/*/assets for generic dev
```

Replace `tenants/palmart/assets/source/icon-source.png` with your official logo and re-run `pnpm assets:tenant palmart`.

## 2. Link each app to EAS (once per app)

From `mobile/` (requires `eas login` first):

```bash
pnpm eas:init palmart cashier
```

Repeat for `shopper`, `grocery`, `admin`, `stock`. Each white-label app is a separate EAS project (separate store listing). The Expo project id is stored on `tenants/palmart/config.json`, not generic `app.json`.

## 3. Configure store credentials

Edit `mobile/eas.json` submit section:

- **iOS:** set `appleTeamId` and `ascAppId` (App Store Connect app ID) under `submit.palmart.ios`
- **Android:** place a Play Console service account JSON at `mobile/google-service-account.json` (gitignored)

```bash
pnpm eas:sync   # copies eas.json into each apps/*/ folder
```

## 4. Cloud build

```bash
cd mobile
pnpm eas:sync
node scripts/eas-tenant-build.js palmart cashier all
node scripts/eas-tenant-build.js palmart shopper android
```

Profiles:

| Profile | Use |
|---------|-----|
| `palmart` | Production store build (AAB / IPA) |
| `palmart-preview` | Internal APK / iOS simulator |
| `production` | Generic Kiosk Ke (no baked-in tenant) |

## 5. Submit to stores

After a successful build:

```bash
node scripts/eas-tenant-submit.js cashier palmart
```

## Local testing (no EAS)

```bash
pnpm start:tenant palmart cashier
```

The app opens as **Palmart Cashier**, auto-connects to tenant `palmart`, and uses branded icon/splash from `tenants/palmart/assets/`.

## OTA updates (EAS Update)

Production Palmart builds use channel `palmart-production`. Push JS-only fixes without a store review:

```bash
cd mobile/apps/cashier
KIOSK_TENANT=palmart eas update --channel palmart-production --message "Fix checkout"
```
