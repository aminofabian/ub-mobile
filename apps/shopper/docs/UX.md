# Kiosk Ke Shopper App — UX Specification

**Phase:** 1 (E-commerce / Customer App)  
**Platform:** iOS & Android  
**Primary user:** Shoppers / B2C buyers  

---

## 1. User Flows

### 1.1 First-Time Use

```
Launch App
    │
    ▼
Splash / Branded Loader
    │
    ▼
Tenant Entry (slug input, QR scan, recent tenants)
    │
    ▼
Resolve Tenant → Fetch Storefront + Branding
    │
    ▼
Home Screen (catalog)
```

### 1.2 Browse & Buy

```
Home
    │
    ├──→ Search → Search Results
    │
    ├──→ Category → Category Items
    │
    ├──→ Product Card → Product Detail
    │                           │
    │                           ▼
    │                   Add to Cart
    │                           │
    ▼                           ▼
Cart ◄──────────────────────────┘
    │
    ▼
Checkout (customer details + payment method)
    │
    ▼
Payment (M-Pesa STK / manual instructions)
    │
    ▼
Order Confirmation
```

### 1.3 Order Tracking

```
Account Tab
    │
    ▼
Orders List
    │
    ▼
Order Detail (status, items, payment, reorder)
```

---

## 2. Navigation Structure

Bottom tab navigation with 4 tabs:

| Tab | Icon | Screen(s) |
|-----|------|-----------|
| **Home** | Home | Home, Category, Product Detail |
| **Search** | Search | Search, Search Results, Product Detail |
| **Cart** | ShoppingCart | Cart, Checkout, Payment, Confirmation |
| **Account** | User | Orders, Order Detail, Notification Preferences |

> **Note:** Cart tab shows badge with item count. Product Detail is reachable from Home, Search, and Category.

---

## 3. Screen Specifications

### 3.1 Splash / Launch Screen

**Purpose:** Brand recognition while tenant and storefront load.

**Content:**
- App logo (centered)
- Loading indicator (after 500ms)

**Behavior:**
- If tenant is cached, resolve in background and navigate to Home.
- If no tenant cached, navigate to Tenant Entry after 1.5s.

---

### 3.2 Tenant Entry

**Purpose:** Let the shopper identify which business they want to shop from.

**Content:**
- App logo
- Headline: "Enter your store"
- Slug input field with placeholder: e.g., `palmart`
- Helper text: `palmart.kiosk.ke`
- "Continue" button (disabled until input is valid)
- "Scan QR code" button
- "Recent stores" list (if available)

**Actions:**
- On Continue: call `GET /api/v1/public/host/resolve?host={slug}.kiosk.ke`
- On QR scan: parse `kiosk://shop/{slug}` or `kiosk://tenant/{slug}`
- On recent store tap: use cached tenant

**Error states:**
- Invalid slug format
- Tenant not found (404)
- Network error

**API:**
- `GET /api/v1/public/host/resolve?host={host}`

---

### 3.3 Home

**Purpose:** Main storefront discovery page.

**Content:**
- Search bar (tappable, navigates to Search)
- Hero banner / featured promotion (if configured)
- Category rail (horizontal scroll, icons + names)
- Featured products section (horizontal scroll)
- "Browse all" CTA
- Bottom tab bar

**Actions:**
- Tap category → Category screen
- Tap product card → Product Detail
- Tap search bar → Search screen
- Pull-to-refresh reloads storefront

**API:**
- `GET /api/v1/public/businesses/{slug}/storefront`
- `GET /api/v1/public/businesses/{slug}/catalog/categories`
- `GET /api/v1/public/businesses/{slug}/catalog/items?featured=true`

---

### 3.4 Category

**Purpose:** Show products within a selected category.

**Content:**
- Back button
- Category name header
- Subcategory chips (if children exist)
- Product grid (2 columns)
- Sort/filter bottom sheet
- Infinite scroll pagination

**Actions:**
- Tap product → Product Detail
- Tap subcategory → filter items
- Open sort/filter sheet
- Pull-to-refresh

**API:**
- `GET /api/v1/public/businesses/{slug}/catalog/items?categoryId={id}`

---

### 3.5 Search

**Purpose:** Find products by name, description, or barcode.

**Content:**
- Search input with clear button
- Recent searches (local storage)
- Search results list/grid
- Empty state with suggestions

**Actions:**
- Type query → debounced search (300ms)
- Tap result → Product Detail
- Tap barcode icon → Camera scanner
- Clear recent searches

**API:**
- `GET /api/v1/public/businesses/{slug}/catalog/items?search={query}`
- `GET /api/v1/public/businesses/{slug}/catalog/items/by-barcode/{barcode}`

---

### 3.6 Product Detail

**Purpose:** Show full product information and allow add-to-cart.

**Content:**
- Image gallery / carousel (swipeable)
- Product name
- Price (live, with tax info if applicable)
- Stock status (in stock / low stock / out of stock)
- Variant selector (if applicable)
- Quantity stepper
- Description
- "Add to Cart" button
- Related products (optional)

**Actions:**
- Swipe images
- Select variant
- Adjust quantity
- Tap "Add to Cart"
- Tap cart icon (top right)

**States:**
- Out of stock: disable add button, show "Notify when available" (optional)
- Low stock: show warning badge
- Variant required: prompt selection before add

**API:**
- `GET /api/v1/public/businesses/{slug}/catalog/items/{id}`
- Realtime: subscribe to `price_changed` and `stock_changed` for this item

---

### 3.7 Cart

**Purpose:** Review items before checkout.

**Content:**
- Header: "My Cart"
- List of cart lines:
  - Product image thumbnail
  - Name, variant, unit price
  - Quantity stepper
  - Line total
  - Remove button
- Cart summary:
  - Subtotal
  - Tax (if shown)
  - Delivery fee (if configured)
  - Total
- "Checkout" button (disabled if cart empty)
- "Continue shopping" link

**Actions:**
- Adjust quantity
- Remove item
- Tap product → Product Detail
- Tap Checkout → Checkout screen

**API:**
- `GET /api/v1/public/businesses/{slug}/carts/{cartId}`
- `POST /api/v1/public/businesses/{slug}/carts/{cartId}/lines`
- `POST /api/v1/public/businesses/{slug}/carts/{cartId}/lines/{lineId}`
- `DELETE /api/v1/public/businesses/{slug}/carts/{cartId}/lines/{lineId}`

---

### 3.8 Checkout

**Purpose:** Collect customer details and preferred payment method.

**Content:**
- Header: "Checkout"
- Order summary (collapsible)
- Customer form:
  - Full name (required)
  - Phone number (required)
  - Email (optional)
  - Delivery notes (optional)
- Payment method selector:
  - M-Pesa
  - Manual payment instructions (if configured)
- Terms checkbox (optional)
- "Place Order" button

**Validation:**
- Name: min 2 chars
- Phone: valid Kenyan/mobile format
- Email: valid format if provided

**Actions:**
- Tap Place Order → submit checkout
- On success → Payment screen or Confirmation

**API:**
- `POST /api/v1/public/businesses/{slug}/carts/{cartId}/checkout`

---

### 3.9 Payment

**Purpose:** Complete payment via M-Pesa STK or show manual instructions.

**Content:**
- Order number
- Total amount
- Payment method

**M-Pesa flow:**
- Phone number input (pre-filled from checkout)
- "Request STK Push" button
- Polling status indicator
- Success / failure message

**Manual instructions flow:**
- Display payment instructions from gateway config
- "I've paid" button (optional)

**Actions:**
- Request STK push
- Poll status
- On success → Order Confirmation
- On failure → retry or change method

**API:**
- `POST /api/v1/public/businesses/{slug}/orders/{orderId}/stk-push`
- `GET /api/v1/public/businesses/{slug}/orders/{orderId}/payment-status`

---

### 3.10 Order Confirmation

**Purpose:** Confirm order placement and provide next steps.

**Content:**
- Success icon / animation
- Order number
- Order summary
- Estimated fulfillment info (if available)
- "Continue Shopping" button
- "View Order" button

**Actions:**
- Continue Shopping → Home
- View Order → Order Detail
- Share order (optional)

---

### 3.11 Orders List (Account Tab)

**Purpose:** Show past and current orders.

**Content:**
- Header: "My Orders"
- List of orders:
  - Order number
  - Date
  - Status badge
  - Total
  - Thumbnail of first item
- Pull-to-refresh

**Actions:**
- Tap order → Order Detail
- Reorder (optional)

**API:**
- Public API does not currently support order history by customer.
- **Backend work needed:** endpoint to list orders by phone/token.
- Proposed: `GET /api/v1/public/businesses/{slug}/orders?phone={phone}`

---

### 3.12 Order Detail

**Purpose:** Show full order information and status.

**Content:**
- Order number and date
- Status badge with timeline
- Items list
- Customer details
- Payment method and status
- Total
- "Reorder" or "Cancel" actions (if applicable)

**API:**
- `GET /api/v1/public/businesses/{slug}/orders/{orderId}`
- (Pending backend support)

---

### 3.13 Notification Preferences

**Purpose:** Let shopper manage push notification opt-ins.

**Content:**
- Toggle: Order updates
- Toggle: Promotions
- Toggle: Back-in-stock alerts

**API:**
- `POST /api/v1/me/device-tokens/fcm` (after login or guest opt-in)

---

## 4. State Management

Use **Zustand** + **React Query**:

| State | Store | Persistence |
|-------|-------|-------------|
| Tenant context | Zustand | SecureStore |
| Cart handle | Zustand | AsyncStorage |
| Cart lines | React Query | Server cache + optimistic updates |
| Product catalog | React Query | Server cache |
| Search history | Zustand | AsyncStorage |
| Recent tenants | Zustand | AsyncStorage |
| Notification prefs | Zustand | AsyncStorage |

---

## 5. Accessibility Requirements

- All interactive elements min 44×44dp touch target
- Screen reader labels on all buttons and inputs
- Quantity stepper supports VoiceOver/TalkBack
- Images have alt text from product data
- Color contrast ≥ 4.5:1 for text

---

## 6. Offline Behavior

| Feature | Offline Support |
|---------|-----------------|
| Browse catalog | Cached last-viewed categories/items |
| Product detail | Cached if previously viewed |
| Search | No offline search; show cached suggestions |
| Cart | Local cart handle + lines; sync on reconnect |
| Checkout | Blocked; show "Connect to internet to checkout" |
| Order history | Show cached orders |

---

## 7. API Mapping Summary

| Screen | API |
|--------|-----|
| Tenant Entry | `GET /api/v1/public/host/resolve` |
| Home | `GET /api/v1/public/businesses/{slug}/storefront` |
| Category | `GET /api/v1/public/businesses/{slug}/catalog/items?categoryId=` |
| Search | `GET /api/v1/public/businesses/{slug}/catalog/items?search=` |
| Product Detail | `GET /api/v1/public/businesses/{slug}/catalog/items/{id}` |
| Cart | `GET/POST/DELETE /api/v1/public/businesses/{slug}/carts/{cartId}/lines` |
| Checkout | `POST /api/v1/public/businesses/{slug}/carts/{cartId}/checkout` |
| Payment | `POST/GET /api/v1/public/businesses/{slug}/orders/{orderId}/stk-push` |
| Orders | *(backend work needed)* |
