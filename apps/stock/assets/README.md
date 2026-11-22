# Stock app assets

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
| `splash.png` | 1284×2778 | Native splash |
