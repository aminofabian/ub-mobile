# Shopper app assets

The generic Kiosk art. These files are copies of `tenants/_shared/assets/`. Do not edit them here: change the
source, then run

```bash
pnpm assets:default
```

`pnpm guard:config` fails when a copy has drifted, or when one is a shop's art. A shop's build takes its own art
from `tenants/<shop>/assets/` instead (`expo-white-label.js`).

| File | Size | Used for |
| --- | --- | --- |
| `icon.png` | 1024×1024 | iOS icon |
| `adaptive-icon.png` | 1024×1024 | Android foreground (the background colour is in `app.json`) |
| `favicon.png` | 48×48 | Web |
| `splash.png` | – | Native splash: a plain field, so the in-app splash can animate over it |
| `brand-mark.png` | 512×512 | The stamp on the in-app splash (`BrandSplash`). A shop's build bundles `tenants/<shop>/assets/brand-mark.png` in its place (`packages/config/metro/tenant-assets.js`) |
