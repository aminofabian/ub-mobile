---
version: 1
slug: "mobile-apps-shopper"
primary_target: "mobile/apps/shopper"
related_targets: []
---

# Shopper App (mobile/apps/shopper)

Scope: every screen of the Expo Shopper App, iOS and Android phones. Mode: Operate.

Audience and job: a neighbourhood shopper on a phone, often outdoors in daylight, finding goods, paying by M-Pesa, card or cash on delivery, and checking orders, store credit, points and tab. Plain shopping words (Home, Search, Basket, Account). The shop's own name and colours carry identity; Kiosk never appears as the brand.

Constraints: basket, checkout and payment logic are in-flight and untouched; presentation only. Approved libraries: Reanimated, Gesture Handler, expo-haptics, expo-image, expo-font with one typeface, react-native-svg. Light appearance only (app.json pins it).

Unresolved: Dark Mode; a tablet layout; Dynamic Type scaling beyond the system default multiplier.

## Direction contract

THESIS: The shop is a guide map. Each area of the shop is a lobe of flat colour and the curved coast between lobes does the dividing. Refuses the category default of a white feed of shadowed cards under a straight header.

OWN-WORLD: Cream ground (water), the shop's primary colour as land, ink text, and four zone colours (sun, coral, pond, lilac) that colour-code aisles and states. Flat, unmodulated colour: no shadows, no gradients. One grotesk, tight display. Controls are capsules with a round chip on the trailing edge that crosses to the leading edge when live. Photographs keep their own colour and are cropped to lobes.
Translation: the source world's fixed green land is replaced by each shop's own primary, because tenant colours are product truth.

STORY: The shopper sees whose shop this is, sees the aisles as coloured areas, adds goods with one tap, and always knows the basket total.

FIRST VIEWPORT: Home. A shop-colour lobe swells from the top edge and leaves the frame on both sides; it holds the shop name, delivery area and a cream search capsule. Its lower coast is a curve, not a line. Below, on cream: a rail of aisle lobes in zone colours, then a two-column grid of white product tiles, each with an Add capsule. A floating capsule tab bar sits at the bottom; its Basket slot carries count and total.

FORM: Zoo and gardens guide map, adopted by the user from the dealt hand (catalogue challenger, not from the grounded list). Seed key 88e0b82f. Signature interaction: the coastline redraws as the screen scrolls, and the Add capsule's chip crosses sides as an item enters the basket. Motion grammar: one 0.4s spring with overshoot for everything that moves; Reduce Motion falls back to crossfade.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
