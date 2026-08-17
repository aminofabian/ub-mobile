# Shared marketplace + white-label apps

Same mobile monorepo, same API, two build targets. Palmart already has the white-label pipeline and a generic runtime tenant picker. The shared app is that generic path, promoted to a real store listing named `_shared`.

| | |
| --- | --- |
| Reuse | White-label, picker, deep links, public `/mobile` |
| One gap | `_shared` must **not** set `isWhiteLabel` or `embeddedTenantSlug` |
| First product | Shopper. Staff apps stay operator tools, not a store directory |

## Do not null the API base URL

Null `tenantId` / `embeddedTenantSlug` only. The shared app still needs:

```json
"apiBaseUrl": "https://api.kiosk.ke"
```

so every small tenant resolves against the platform API.

Today `applyWhiteLabel()` sets `isWhiteLabel: true` whenever `TENANT_ID` is present. That would skip the picker if you naively add `tenants/_shared`. That flag is the actual P0 gap.

## Two targets, one source

```
tenants/
  _shared/          ← marketplace listing (icon, name, platform bundle IDs)
  palmart/          ← white-label tenant
  acme/             ← white-label tenant
```

### Shared marketplace (`TENANT_ID=_shared`)

Store listing identity only: name, icon, bundle ID (`com.kioskke.shopper`), splash, scheme `kiosk`.

Runtime: no baked tenant. Boot → persisted slug, else deep link, else picker. After resolve, the same cart/checkout/theme path as a white-label build, fed by `TenantContext` plus `GET …/storefront` and `GET …/mobile`.

Small tenants appear automatically. Zero extra EAS apps.

### White-label tenant (`TENANT_ID=acme`)

Exact pipeline already documented in [README.md](./README.md): `tenants/acme/config.json` + assets, unique bundle IDs, `embeddedTenantSlug`, `isWhiteLabel: true`. Hide Change store.

Storefront “Get our app” points at Acme’s App Store / Play listing, not `kiosk://shop/acme`.

Paid / larger tenants. One EAS row per app you ship them.

## What already exists vs what to build

| Piece | Where it lives | Status |
| --- | --- | --- |
| Tenant folders + EAS | `tenants/{id}/config.json`, assets, `applyWhiteLabel`, `eas-tenant-build.js` | Reuse |
| Runtime picker | Shopper `TenantEntryScreen` + staff slug/email picker; `bootstrapTenant()` | Reuse |
| Deep links | `kiosk://shop/{slug}`, `https://{host}/shop`, `resolveTenantFromDeepLink` | Reuse |
| Public mobile config | `GET /api/v1/public/businesses/{slug}/mobile` — `whiteLabel`, bundle IDs, store links | Reuse |
| Platform bundle IDs | `app.mobile.platform-bundles.shopper=com.kioskke.shopper` (and staff apps) | Reuse |
| Marketplace listing identity | `TENANT_ID=_shared` must brand the store listing **without** embedding a tenant | New — P0 |
| Store directory | Browse/search live tenants instead of only typing a slug | New — P1 |
| Upgrade interstitial | If `apps[].whiteLabel` + `storeLinks`, send shoppers to the branded listing | New — P1 |

## Runtime resolution for `_shared` (shopper)

This is not a new screen from scratch. Shopper already boots this way when `TENANT_ID` is unset. `_shared` just makes that the production binary. Net-new UI is directory browse and the white-label upgrade prompt.

| Step | Logic | If it fails |
| --- | --- | --- |
| 1. Cold start | `Linking.getInitialURL` → `resolveTenantFromDeepLink` | Fall through |
| 2. Persisted store | `loadTenant()` from SecureStore (`kiosk.tenant`) | Fall through |
| 3. White-label only | If `embeddedTenantSlug` set, `resolveTenant(slug)` and never show picker | Error + retry (no Change store) |
| 4. Shared picker | Slug entry (exists) → later: search directory + recent stores | Inline error, stay on picker |
| 5. Enrich | `fetchPublicMobileConfig(slug)`. If `apps.shopper.whiteLabel`, show Get the branded app | Stay in shared app; still shoppable |
| 6. Session | Theme + API headers from `TenantContext`. Cart keyed by tenant `businessId` | Switch store clears local cart after confirm |

### Recommended `_shared` config shape

`tenants/_shared/config.json`:

- `marketplace: true`
- `displayName`: consumer listing name (e.g. `"Kiosk Ke"`)
- `apiBaseUrl`: `"https://api.kiosk.ke"`
- `scheme`: `"kiosk"`
- Shopper bundle `com.kioskke.shopper` — already the backend default in `app.mobile.platform-bundles.shopper`

`applyWhiteLabel` must apply name/icon/bundle when `marketplace` is true, and must leave `isWhiteLabel` false and `embeddedTenantSlug` empty.

## Account, cart, and upgrade continuity

**Carries over** (same `tenant_id`): server accounts, orders, saved addresses, loyalty. Customer re-logins in the new app with the same phone/email. No data migration job.

**Does not carry** (different bundle ID): access/refresh tokens, local cart, SecureStore tenant key, push token. iOS/Android isolate storage per app. Treat upgrade as “download Acme, sign in once.” Tell tenants that in onboarding copy.

**Default product rule:** stay shoppable in the shared app after a tenant goes white-label, unless they pay to hide from the directory. Always prefer the branded store listing when `whiteLabel` is true and store links exist — never break an existing shared-app customer.

## Product split

The marketplace is a **shopper** product. Cashier / grocery / admin / stock already have a generic slug+email picker for operators. Do not put a consumer store directory on staff apps. White-label those only when a tenant pays for branded staff binaries (Palmart Cashier today).

## Ship order

1. **P0** — `applyWhiteLabel`: marketplace profiles brand the listing without embedding a tenant
2. **P0** — add `tenants/_shared` (icon, name, `com.kioskke.*` bundles, production `apiBaseUrl`)
3. **P0** — EAS profile for `TENANT_ID=_shared` shopper (and optional generic staff)
4. **P1** — public directory/search API + shopper browse/recent stores (slug entry stays as fallback)
5. **P1** — after resolve, if `whiteLabel` + `storeLinks`, show Get the branded app interstitial
6. **P1** — storefront Get our app: shared deep link vs white-label store URL from `/mobile`
7. **P2** — local cart keyed by `businessId`; confirm before switch-store; server cart/orders unchanged
8. **P2** — tenant upgrade email: customers keep history after re-login in the new app

## Open decisions

| Decision | Recommendation | Owner |
| --- | --- | --- |
| Hide graduated tenants from directory? | No by default; optional paid flag later | Product |
| Multi-store cart in shared app? | No. One active tenant. Switch store = new cart | Product + mobile |
| Shared staff apps? | Keep generic Kiosk staff binaries; not a marketplace | Product |
| Apple review of shared shopper | Must look like a real shopping app (browse, not slug-only) | Mobile + storefront |
