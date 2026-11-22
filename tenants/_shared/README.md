# Shared profile (the generic Kiosk build)

`config.json` brands the marketplace listing. It is what an EAS build or `expo start` resolves when no
`TENANT_ID` is set, or when `TENANT_ID=_shared`. It sets `marketplace: true`, so `expo-white-label.js` applies
the name, slug and bundle ids and adds the OTA identity, but never sets `isWhiteLabel`, `embeddedTenantSlug`
or any tenant extra. The shop is chosen at run time, in the picker.

`_shared` is not a valid shop slug (slugs are `[a-z0-9-]`), so no shop can collide with it.

## Expo projects

Each app needs an Expo project of its own, not one that belongs to a shop. Create them with

    pnpm eas:init _shared shopper     # and cashier, grocery, admin, stock

which writes `apps.<app>.easProjectId` into `config.json`. Until then the generic build has no `updates.url`
and `pnpm guard:config` stays red on it. Do not copy a shop's project id here.

## Assets (provisional)

`assets/` holds the generic brand art, rendered from the platform logomark (`source/kiosk-mark.svg`, copied
from `frontend/lib/platform-logo-mark.ts`). It is a stand-in until the owner supplies designed art.

| File | Used for |
| --- | --- |
| `icon.png` | iOS icon, 1024², full bleed, no alpha |
| `adaptive-icon.png` | Android foreground, art inside the 66% safe zone; the background colour is `iconBackground` |
| `favicon.png` | web, 48² |
| `splash.png` | native splash of the four staff apps, 1284×2778 |
| `shopper/splash.png` | native splash of the Shopper: a plain field, so the in-app splash can animate over it |
| `brand-mark.png` | the stamp in the Shopper's in-app splash |

`pnpm assets:default` copies these into each `apps/<app>/assets/`; `pnpm guard:config` fails when a copy drifts.
`pnpm assets:tenant _shared` needs `source/icon-source.png` and `source/splash-source.png`, which this folder
does not hold, so it stops instead of overwriting the art above.
