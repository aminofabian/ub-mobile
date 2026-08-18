# Palmart mobile release (EAS Free plan)

Expo Free includes **15 Android + 15 iOS builds per month**, **1 concurrent job**, a **45-minute timeout**, medium workers only, and OTA updates for **1,000 MAUs**. Native cloud builds are scarce; JS-only fixes should go out as OTA updates.

## Stay on Free

| Do | Don't |
|----|--------|
| One app at a time (Cashier first) | Init/build all 5 apps |
| `android` only until Play works | `--platform all` (counts as 2 builds) |
| `palmart-preview` APK for testers | Production AAB until you submit |
| `pnpm eas:update:tenant` for JS/UI | Rebuild native for copy/color/bugfix |
| `pnpm start:tenant palmart cashier` locally | Burn quota iterating on EAS |

`pnpm eas:build:tenant` defaults to **android**, **does not wait** (check the Expo URL), and refuses `all` unless you set `EAS_ALLOW_ALL_PLATFORMS=1`.

## Prerequisites

- [Expo account](https://expo.dev/signup) — `cd mobile && pnpm exec eas login`
- Apple Developer Program membership only when you actually build iOS
- Google Play Console account (Android)
- Register `com.palmart.cashier` in Play (add other package names when those apps ship)

## 1. Generate branding assets

```bash
cd mobile
pnpm assets:tenant palmart      # creates tenants/palmart/assets/*.png
pnpm assets:default             # copies into apps/*/assets for generic dev
```

Replace `tenants/palmart/assets/source/icon-source.png` with your official logo and re-run `pnpm assets:tenant palmart`.

## 2. Link Cashier to EAS (once)

```bash
cd mobile
pnpm eas:init palmart cashier
```

Do **not** init shopper/grocery/admin/stock until you are ready to spend a native build on each. The Expo project id is stored on `tenants/palmart/config.json`.

## 3. Configure store credentials (when submitting)

Edit `mobile/eas.json` submit section:

- **iOS:** set `appleTeamId` and `ascAppId` under `submit.palmart.ios`
- **Android:** place a Play Console service account JSON at `mobile/google-service-account.json` (gitignored)

```bash
pnpm eas:sync   # copies eas.json into each apps/*/ folder
```

## 4. Native cloud build (quota)

```bash
cd mobile
pnpm eas:build:tenant palmart cashier android palmart-preview
```

Watch the Expo URL; the CLI returns as soon as the job is queued. Wait with `EAS_WAIT=1` only if you need the APK in this terminal.

Profiles:

| Profile | Use |
|---------|-----|
| `palmart-preview` | Internal APK (Free-plan default) |
| `palmart` | Play Store AAB / App Store IPA |
| `production` | Generic Kiosk Ke (no baked-in tenant) |

## 5. JS updates (no build quota)

After a preview/production binary is installed, push JS-only changes:

```bash
cd mobile
pnpm eas:update:tenant palmart cashier palmart-preview "Fix PIN login"
```

Production channel is `palmart-production`. Rebuild native only when you change native modules, app version, or credentials.

Free OTA cap is 1,000 monthly active users.

## 6. Submit to stores

After a successful **production** (`palmart`) build:

```bash
pnpm eas:submit cashier palmart
```

## Local testing (no EAS)

```bash
pnpm start:tenant palmart cashier
```

The app opens as **Palmart Cashier**, auto-connects to tenant `palmart`, and uses branded icon/splash from `tenants/palmart/assets/`.
