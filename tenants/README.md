# White-label tenant profiles

Shared marketplace vs per-tenant branded apps: [SHARED-AND-WHITELABEL.md](./SHARED-AND-WHITELABEL.md).

Each tenant is a folder under `tenants/`. Build-time identity (name, icon, bundle ID) is baked in; day-to-day storefront content stays on the API.

```
tenants/
  palmart/
    config.json
    assets/icon.png
    assets/splash.png
    assets/adaptive-icon.png
    google-services.json          (optional, Android FCM)
    GoogleService-Info.plist      (optional, iOS)
  acme/
    config.json
    ...
```

`app.config.js` reads `TENANT_ID` (or `KIOSK_TENANT`) at start/build time and returns a different Expo config per tenant. Runtime JS reads the same values from `expo-constants`:

```ts
import Constants from 'expo-constants';
const { tenantId, apiBaseUrl, themeColors } = Constants.expoConfig.extra;
```

Generic Kiosk Ke apps (no tenant env var) still show the store picker on first launch.

## Quick start — Palmart Cashier

```bash
cd mobile
pnpm assets:tenant palmart
TENANT_ID=palmart pnpm cashier start
# or
pnpm start:tenant palmart cashier
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm assets:tenant palmart` | Generate icon/splash PNGs from source art |
| `pnpm start:tenant palmart cashier` | Run a white-label app locally |
| `pnpm eas:init palmart cashier` | Create/link the Expo EAS project for that tenant app |
| `pnpm eas:sync` | Copy `eas.json` into each app directory |
| `node scripts/eas-tenant-build.js palmart cashier all` | EAS cloud build (`TENANT_ID` is set for you) |
| `node scripts/eas-tenant-submit.js cashier palmart` | Submit latest build to stores |

Build without a helper script:

```bash
TENANT_ID=palmart eas build --platform all --profile tenant-production
```

## Adding a new business

1. Copy `tenants/palmart/` → `tenants/yourbusiness/`
2. Edit `config.json`: `id`, `slug`, `displayName`, unique `iosBundleId` / `androidPackage` per app
3. Drop `icon.png`, `splash.png`, `adaptive-icon.png` in the tenant folder (or `assets/`)
4. Optional: add Firebase `google-services.json` and `GoogleService-Info.plist` in the tenant folder
5. Optional: set `easProjectId` per app after `eas init` for that store listing
6. Register bundle IDs with Apple/Google

Do not branch in components with `if (tenant === 'acme')`. Identity and colors come from `config.json` / `Constants.expoConfig.extra`. Homepage layout, banners, and catalogs come from the API at runtime.
