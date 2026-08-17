# Kiosk Ke Mobile Apps

Monorepo for the Kiosk Ke mobile applications.

## Apps

| App | Package | Description |
|-----|---------|-------------|
| Shopper | `@kiosk/shopper` | Customer e-commerce app |
| Cashier | `@kiosk/cashier` | Point-of-sale app |
| Grocery | `@kiosk/grocery` | Invoice generation app |
| Admin | `@kiosk/admin` | Management app |
| Stock | `@kiosk/stock` | Inventory & stock management app |

## Shared Packages

| Package | Description |
|---------|-------------|
| `@kiosk/config` | Shared ESLint, Prettier, TypeScript, and Metro configs |
| `@kiosk/types` | TypeScript types generated from backend OpenAPI specs |
| `@kiosk/core` | API client, auth, tenant resolution, idempotency |
| `@kiosk/ui` | Shared React Native UI components |
| `@kiosk/offline` | Offline queue, sync engine, SQLite cache |
| `@kiosk/barcode` | Barcode scanner wrapper |
| `@kiosk/payments` | M-Pesa STK and payment processing |
| `@kiosk/realtime` | WebSocket realtime client |
| `@kiosk/notifications` | Push notification registration |

## Prerequisites

- Node.js 22 LTS (Node 26 may have compatibility issues with Expo)
- pnpm 9+ (`corepack pnpm` works if you don't have pnpm installed globally)
- Java 21 (for OpenAPI generation)

## Setup

```bash
cd mobile

# Install dependencies
corepack pnpm install

# Generate shared types from backend OpenAPI specs
pnpm --filter @kiosk/types generate

# Build shared packages
pnpm build

# Start a specific app
pnpm shopper start
pnpm cashier start
```

## Important: App Assets

Each app requires these image assets in its `assets/` folder:

- `icon.png` — 1024×1024 app icon
- `splash.png` — 1242×2438 splash screen
- `adaptive-icon.png` — 1024×1024 Android adaptive icon foreground
- `favicon.png` — 32×32 web favicon

Add real branded assets before running `expo export` or submitting to app stores.

## Notes

- `corepack pnpm` is used instead of a global pnpm install.
- The monorepo uses Turborepo for task orchestration and pnpm workspaces for package linking.
- Metro is configured to resolve symlinks across the monorepo.
