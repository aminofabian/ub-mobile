"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// assets/gloss.png
var require_gloss = __commonJS({
  "assets/gloss.png"(exports2, module2) {
    module2.exports = "./gloss-XHPBAMBP.png";
  }
});

// assets/fonts/SandeMore-Regular.otf
var require_SandeMore_Regular = __commonJS({
  "assets/fonts/SandeMore-Regular.otf"(exports2, module2) {
    module2.exports = "./SandeMore-Regular-ZCP725IO.otf";
  }
});

// assets/fonts/SandeMore-Medium.otf
var require_SandeMore_Medium = __commonJS({
  "assets/fonts/SandeMore-Medium.otf"(exports2, module2) {
    module2.exports = "./SandeMore-Medium-RZXOC7OI.otf";
  }
});

// assets/fonts/SandeMore-Bold.otf
var require_SandeMore_Bold = __commonJS({
  "assets/fonts/SandeMore-Bold.otf"(exports2, module2) {
    module2.exports = "./SandeMore-Bold-IJVUI6MK.otf";
  }
});

// assets/fonts/SandeMore-ExtraBold.otf
var require_SandeMore_ExtraBold = __commonJS({
  "assets/fonts/SandeMore-ExtraBold.otf"(exports2, module2) {
    module2.exports = "./SandeMore-ExtraBold-QK2GDK3B.otf";
  }
});

// assets/fonts/DMSans-Regular.ttf
var require_DMSans_Regular = __commonJS({
  "assets/fonts/DMSans-Regular.ttf"(exports2, module2) {
    module2.exports = "./DMSans-Regular-Y2PJ5BOZ.ttf";
  }
});

// assets/fonts/DMSans-Medium.ttf
var require_DMSans_Medium = __commonJS({
  "assets/fonts/DMSans-Medium.ttf"(exports2, module2) {
    module2.exports = "./DMSans-Medium-WJMKLIXC.ttf";
  }
});

// assets/fonts/DMSans-SemiBold.ttf
var require_DMSans_SemiBold = __commonJS({
  "assets/fonts/DMSans-SemiBold.ttf"(exports2, module2) {
    module2.exports = "./DMSans-SemiBold-AFJ5CDW4.ttf";
  }
});

// assets/fonts/DMSans-Bold.ttf
var require_DMSans_Bold = __commonJS({
  "assets/fonts/DMSans-Bold.ttf"(exports2, module2) {
    module2.exports = "./DMSans-Bold-75G63SEB.ttf";
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BRAND: () => BRAND,
  BranchSelectScreen: () => BranchSelectScreen,
  CardGloss: () => CardGloss,
  DM_SANS: () => DM_SANS,
  ELEVATION: () => ELEVATION,
  FONT: () => FONT,
  FlyToCart: () => FlyToCart,
  GUTTER: () => GUTTER,
  Gloss: () => Gloss,
  HAIRLINE: () => HAIRLINE,
  HISTORY_LIMIT: () => HISTORY_LIMIT,
  HeroMetric: () => HeroMetric,
  ItemPicker: () => ItemPicker,
  JAKARTA: () => JAKARTA,
  MART: () => MART,
  MOTION: () => MOTION,
  MartButton: () => MartButton,
  MartText: () => MartText,
  MiniTile: () => MiniTile,
  ON_BRAND: () => ON_BRAND,
  PinLoginScreen: () => PinLoginScreen,
  PressableScale: () => PressableScale,
  RADIUS: () => RADIUS,
  SETTLE: () => SETTLE,
  SHADOW: () => SHADOW,
  SPACE: () => SPACE,
  SPRING: () => SPRING,
  Screen: () => Screen,
  SectionHead: () => SectionHead,
  SetStockScreen: () => SetStockScreen,
  Sheet: () => Sheet,
  ShelfTile: () => ShelfTile,
  Sparkline: () => Sparkline,
  SpoilsScreen: () => SpoilsScreen,
  StaffShell: () => StaffShell,
  StatTile: () => StatTile,
  TILE: () => TILE,
  TYPE: () => TYPE,
  TenantEntryScreen: () => TenantEntryScreen,
  Tile: () => Tile,
  VerifiedBadge: () => VerifiedBadge,
  WEIGHT: () => WEIGHT,
  WeightSheet: () => WeightSheet,
  WhiteLabelErrorScreen: () => WhiteLabelErrorScreen,
  ZONE: () => ZONE,
  confirmLeavingUnsent: () => confirmLeavingUnsent,
  confirmSignOut: () => confirmSignOut,
  confirmSigningOutWithUnsent: () => confirmSigningOutWithUnsent,
  describeUnsent: () => describeUnsent,
  fetchAllocation: () => fetchAllocation,
  fetchFreshItem: () => fetchFreshItem,
  fetchHistory: () => fetchHistory,
  leaveStore: () => leaveStore,
  martFromTenant: () => martFromTenant,
  onFill: () => onFill,
  postBatchDecrease: () => postBatchDecrease,
  postStockIncrease: () => postStockIncrease,
  postWastage: () => postWastage,
  setUiFace: () => setUiFace,
  setUiTypeface: () => setUiTypeface,
  tint: () => tint,
  useAuthStore: () => useAuthStore,
  useFlushLoop: () => useFlushLoop,
  useItemSearch: () => useItemSearch,
  useKept: () => useKept,
  useStaffAuthNavigation: () => useStaffAuthNavigation,
  useStaffBoot: () => useStaffBoot,
  zoneFor: () => zoneFor
});
module.exports = __toCommonJS(index_exports);

// src/theme/mart.ts
var import_expo_constants = __toESM(require("expo-constants"));
var import_react_native = require("react-native");

// src/theme/brand-colors.ts
function asHex(value, fallback) {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}
function resolveBrandColors(input) {
  const { whiteLabel, baked, cms, fallback } = input;
  if (whiteLabel) {
    return {
      primary: asHex(baked?.primary, fallback.primary),
      accent: asHex(baked?.accent, fallback.accent)
    };
  }
  return {
    primary: asHex(cms?.primaryColor, fallback.primary),
    accent: asHex(cms?.accentColor, fallback.accent)
  };
}

// src/theme/mart.ts
var import_ui = require("@kiosk/ui");
var MART = {
  ink: "#16180f",
  inkMuted: "#565a4e",
  /** Darkest quiet tone that still clears 4.5:1 on `paper`. */
  inkQuiet: "#8c8f82",
  /** The ground of every screen: a warm, soft off-white with the faintest green undertone. */
  paper: "#f7f6f0",
  /** Cards and fields: pure white, lifted by a soft shadow. */
  paperElevated: "#ffffff",
  /** Pressed tiles, skeleton bones, quiet wells. */
  paperSunken: "#eceae1",
  /** Hairline dividers and card edges. */
  border: "#e8e6db",
  /** Outlined capsules and fields at rest. */
  borderStrong: "#d4d1c4",
  /** The accent that leads: the counter's amber, so the till and the shop floor read as one product. */
  fallbackPrimary: "#F08A24",
  /** A deeper amber for pressed states and text on the wash. */
  fallbackPrimaryLift: "#D97515",
  fallbackAccent: "#e8650e",
  gold: "#f2c438",
  danger: "#b42318",
  dangerSurface: "#fee4e2",
  success: "#2f7a21",
  successSurface: "#dcf5d0",
  warning: "#7a5a00",
  warningSurface: "#fdf2c4",
  info: "#0b5cab",
  infoSurface: "#d4e9ff",
  /** The soft shadow colour — a warm brown-black, never pure black. */
  shadowTint: "#7A5A2E",
  radius: 16
};
var ZONE = {
  sun: "#f5e211",
  coral: "#ff705d",
  pond: "#2ba0ff",
  lilac: "#ebc1ff",
  leaf: "#8ed462"
};
var ZONE_ORDER = [ZONE.leaf, ZONE.sun, ZONE.coral, ZONE.pond, ZONE.lilac];
function zoneFor(key) {
  const text = key ?? "";
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = hash * 31 + text.charCodeAt(i) >>> 0;
  }
  return ZONE_ORDER[hash % ZONE_ORDER.length];
}
var RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999
};
var SPACE = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40
};
var GUTTER = SPACE.xl;
var SYSTEM_FACE = import_react_native.Platform.select({ ios: "System", android: "sans-serif", default: "System" });
var FONT = {
  regular: "SandeMore_400Regular",
  medium: "SandeMore_500Medium",
  semibold: "SandeMore_500Medium",
  bold: "SandeMore_700Bold",
  black: "SandeMore_800ExtraBold"
};
var JAKARTA = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  black: "PlusJakartaSans_800ExtraBold"
};
function setUiFace(family) {
  (0, import_ui.setUiFont)(family);
  FONT.regular = family.regular;
  FONT.medium = family.medium;
  FONT.semibold = family.semibold;
  FONT.bold = family.bold;
  FONT.black = family.black;
}
function setUiTypeface(face) {
  if (face === "system") {
    setUiFace({ regular: SYSTEM_FACE, medium: SYSTEM_FACE, semibold: SYSTEM_FACE, bold: SYSTEM_FACE, black: SYSTEM_FACE });
    return;
  }
  setUiFace(JAKARTA);
}
var WEIGHT = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  black: "800"
};
var BRAND = {
  semibold: FONT.semibold,
  bold: FONT.bold,
  black: FONT.black
};
var TYPE = {
  display: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7
  },
  hero: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6
  },
  title: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.45
  },
  heading: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 16.5,
    lineHeight: 21,
    letterSpacing: -0.4
  },
  body: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 14,
    lineHeight: 21
  },
  label: {
    fontFamily: FONT.medium,
    fontWeight: WEIGHT.medium,
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.2
  },
  meta: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.1
  },
  shelf: {
    // the reference's small caps: tiny, tracked out, and never bold
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.1
  },
  price: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.35
  }
};
var ELEVATION = {
  ruled: {
    backgroundColor: MART.paperElevated
  },
  lifted: {
    backgroundColor: MART.paper,
    borderWidth: 1.5,
    borderColor: MART.ink
  }
};
var SHADOW = {
  card: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3
  },
  hero: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8
  },
  floating: {
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10
  }
};
var HAIRLINE = {
  borderWidth: import_react_native.StyleSheet.hairlineWidth,
  borderColor: MART.border
};
var SPRING = { duration: 400, dampingRatio: 0.62 };
var SETTLE = { duration: 400, dampingRatio: 1 };
var MOTION = {
  feedback: 130,
  state: 220,
  view: 400,
  entrance: 400,
  exit: 220,
  easeOut: import_react_native.Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: import_react_native.Easing.bezier(0.7, 0, 0.84, 0)
};
function tint(hex, alpha) {
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255).toString(16).padStart(2, "0");
  return `${hex}${byte}`;
}
function luminance(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const h = hex.replace("#", "");
  if (h.length !== 6) return 0;
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
var ON_DARK = {
  primary: "#fffdf6",
  secondary: "rgba(255,253,246,0.88)",
  hairline: "rgba(255,253,246,0.28)",
  wash: "rgba(255,253,246,0.16)"
};
var ON_LIGHT = {
  primary: MART.ink,
  secondary: "rgba(44,46,42,0.86)",
  hairline: "rgba(44,46,42,0.24)",
  wash: "rgba(44,46,42,0.1)"
};
function onFill(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return ON_DARK;
  const inkContrast = (luminance(hex) + 0.05) / (luminance(MART.ink) + 0.05);
  return inkContrast >= 4.5 ? ON_LIGHT : ON_DARK;
}
var ON_BRAND = ON_DARK;
function asText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function bakedBrand() {
  const extra = import_expo_constants.default.expoConfig?.extra;
  return { whiteLabel: Boolean(extra?.isWhiteLabel), baked: extra?.themeColors ?? null };
}
function martFromTenant(tenant, extras) {
  const branding = tenant.branding ?? {};
  const colors = resolveBrandColors({
    ...bakedBrand(),
    cms: { primaryColor: branding.primaryColor, accentColor: branding.accentColor },
    fallback: { primary: MART.fallbackPrimary, accent: MART.fallbackAccent }
  });
  const banners = Array.isArray(branding.heroBannerUrls) ? branding.heroBannerUrls.filter((url) => typeof url === "string" && /^https?:\/\//i.test(url)) : [];
  return {
    primary: colors.primary,
    accent: colors.accent,
    gold: MART.gold,
    onPrimary: onFill(colors.primary),
    onAccent: onFill(colors.accent),
    logoUrl: asText(branding.logoUrl),
    displayName: extras?.businessName?.trim() || asText(branding.displayName) || tenant.displayName,
    tagline: extras?.announcement?.trim() || asText(branding.metaTitle),
    description: asText(branding.metaDescription),
    heroBanners: banners
  };
}
var TILE = {
  backgroundColor: MART.paperElevated,
  borderRadius: RADIUS.lg,
  padding: SPACE.lg
};

// src/theme/mart-ui.tsx
var import_react = require("react");
var import_react_native2 = require("react-native");
var import_vector_icons = require("@expo/vector-icons");
var import_jsx_runtime = require("react/jsx-runtime");
function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.97,
  ...rest
}) {
  const scale = (0, import_react.useRef)(new import_react_native2.Animated.Value(1)).current;
  const to = (value, duration) => import_react_native2.Animated.timing(scale, { toValue: value, duration, easing: MOTION.easeOut, useNativeDriver: true }).start();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_react_native2.Pressable,
    {
      ...rest,
      disabled,
      onPressIn: (e) => {
        if (!disabled) to(scaleTo, MOTION.feedback);
        onPressIn?.(e);
      },
      onPressOut: (e) => {
        to(1, MOTION.state);
        onPressOut?.(e);
      },
      children: (state) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Animated.View, { style: [{ transform: [{ scale }] }, typeof style === "function" ? style(state) : style], children: typeof children === "function" ? children(state) : children })
    }
  );
}
function MartText({
  variant = "body",
  color = MART.ink,
  style,
  ...rest
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { ...rest, style: [TYPE[variant], { color }, style] });
}
function Screen({ style, ...rest }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { ...rest, style: [styles.screen, style] });
}
function Tile({ style, ...rest }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { ...rest, style: [styles.tile, style] });
}
function StatTile({
  label,
  value,
  zoneKey
}) {
  const accent = zoneFor(zoneKey ?? label);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.stat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.statHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { style: [styles.statDot, { backgroundColor: accent }] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.meta, { color: MART.inkQuiet }], numberOfLines: 1, children: label })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.title, { color: MART.ink }], numberOfLines: 1, adjustsFontSizeToFit: true, children: value })
  ] });
}
function Sparkline({
  data,
  color = MART.fallbackPrimary,
  height = 34
}) {
  const max = Math.max(1, ...data);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { style: [styles.spark, { height }], children: data.map((v, i) => {
    const h = Math.max(3, Math.round(v / max * height));
    const last = i === data.length - 1;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native2.View,
      {
        style: {
          flex: 1,
          height: h,
          borderRadius: RADIUS.pill,
          backgroundColor: last ? color : tint(color, 0.28)
        }
      },
      i
    );
  }) });
}
function HeroMetric({
  label,
  value,
  delta,
  trendUp = true,
  spark,
  accent = MART.fallbackPrimary
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.hero, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.meta, { color: MART.inkQuiet }], children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.heroRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.display, styles.heroValue], numberOfLines: 1, adjustsFontSizeToFit: true, children: value }),
      delta ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.heroDelta, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_vector_icons.Ionicons,
          {
            name: trendUp ? "trending-up" : "trending-down",
            size: 15,
            color: trendUp ? MART.success : MART.danger
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.label, { color: trendUp ? MART.success : MART.danger }], children: delta })
      ] }) : null
    ] }),
    spark ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, { data: spark, color: accent, height: 26 }) : null
  ] });
}
function MiniTile({
  icon,
  label,
  value,
  accent = MART.inkQuiet
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.mini, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { style: [styles.miniIcon, { backgroundColor: tint(accent, 0.16) }], children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_vector_icons.Ionicons, { name: icon, size: 16, color: accent }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.meta, { color: MART.inkQuiet }], numberOfLines: 1, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.heading, { color: MART.ink }], numberOfLines: 1, adjustsFontSizeToFit: true, children: value })
  ] });
}
function SectionHead({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { accessibilityRole: "header", style: [TYPE.title, styles.sectionHead], children });
}
function MartButton({
  label,
  kind = "primary",
  busy,
  disabled,
  style,
  ...rest
}) {
  const fill = kind === "primary" ? MART.fallbackPrimary : kind === "accent" ? MART.fallbackAccent : "transparent";
  const inkOn = kind === "quiet" ? MART.inkQuiet : onFill(fill).primary;
  const isOff = disabled || busy;
  const inkWhenOff = isOff && kind !== "quiet" ? tint(inkOn, 0.75) : inkOn;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    PressableScale,
    {
      accessibilityRole: "button",
      disabled: isOff,
      style: [
        styles.button,
        kind === "quiet" && styles.buttonQuiet,
        // A filled button carries a soft shadow in its own colour, so it reads as a raised, tappable surface.
        kind !== "quiet" && !isOff ? tintedLift(fill) : null,
        { backgroundColor: isOff && kind !== "quiet" ? tint(fill, 0.35) : fill },
        style
      ],
      ...rest,
      children: busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.ActivityIndicator, { color: inkWhenOff }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [TYPE.label, styles.buttonLabel, { color: inkWhenOff }], children: label })
    }
  );
}
function tintedLift(fill) {
  return {
    shadowColor: fill,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4
  };
}
var styles = import_react_native2.StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.paper
  },
  tile: {
    ...TILE
  },
  stat: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 92,
    justifyContent: "space-between",
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    gap: SPACE.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.pill
  },
  hero: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.sm
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACE.sm
  },
  heroValue: {
    flex: 1,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -1.2,
    color: MART.ink
  },
  heroDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xxs,
    paddingBottom: SPACE.xxs
  },
  spark: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3
  },
  mini: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.sm
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs
  },
  sectionHead: {
    marginBottom: SPACE.md
  },
  button: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.xl
  },
  buttonQuiet: {
    minHeight: 44
  },
  buttonLabel: {
    fontFamily: TYPE.label.fontFamily
  }
});

// src/theme/CardGloss.tsx
var import_react_native3 = require("react-native");
var import_jsx_runtime2 = require("react/jsx-runtime");
function CardGloss({ radius = RADIUS.lg, strength = "high" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native3.View, { style: [styles2.clip, { borderRadius: radius }], pointerEvents: "none", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: styles2.body }),
    strength === "high" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: styles2.streak }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: styles2.streakThin })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: styles2.sheen }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: styles2.sheenSoft })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: [styles2.rim, styles2.rimTop] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: [styles2.rim, styles2.rimLeft] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: [styles2.shade, styles2.shadeBottom] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: [styles2.shade, styles2.shadeRight] })
  ] });
}
var styles2 = import_react_native3.StyleSheet.create({
  clip: { ...import_react_native3.StyleSheet.absoluteFillObject, overflow: "hidden" },
  sheenSoft: {
    position: "absolute",
    top: "4%",
    left: "-30%",
    right: "-30%",
    height: "26%",
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    transform: [{ rotate: "-7deg" }]
  },
  sheen: {
    position: "absolute",
    top: "-18%",
    left: "-30%",
    right: "-30%",
    height: "46%",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    transform: [{ rotate: "-7deg" }]
  },
  body: { ...import_react_native3.StyleSheet.absoluteFillObject, backgroundColor: "#f8f4e3" },
  streak: {
    position: "absolute",
    top: "-6%",
    left: "-30%",
    right: "-30%",
    height: "30%",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    transform: [{ rotate: "-13deg" }]
  },
  streakThin: {
    position: "absolute",
    top: "26%",
    left: "-30%",
    right: "-30%",
    height: "8%",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    transform: [{ rotate: "-12deg" }]
  },
  rim: { position: "absolute", backgroundColor: "rgba(255, 255, 255, 0.95)" },
  rimTop: { top: 0, left: 0, right: 0, height: 2.5 },
  rimLeft: { top: 0, bottom: 0, left: 0, width: 1.5 },
  shade: { position: "absolute", backgroundColor: "rgba(26, 36, 22, 0.10)" },
  shadeBottom: { bottom: 0, left: 0, right: 0, height: 2 },
  shadeRight: { top: 0, bottom: 0, right: 0, width: 1.5 }
});

// src/theme/Gloss.tsx
var import_react_native4 = require("react-native");
var import_jsx_runtime3 = require("react/jsx-runtime");
function Gloss() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native4.View, { style: import_react_native4.StyleSheet.absoluteFill, pointerEvents: "none", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native4.Image, { source: require_gloss(), style: import_react_native4.StyleSheet.absoluteFill, resizeMode: "cover" }) });
}

// src/components/Sheet.tsx
var import_react_native6 = require("react-native");

// ../../node_modules/react-native-safe-area-context/lib/module/SafeAreaContext.js
var React2 = __toESM(require("react"));
var import_react_native5 = require("react-native");
var isDev = process.env.NODE_ENV !== "production";
var SafeAreaInsetsContext = /* @__PURE__ */ React2.createContext(null);
if (isDev) {
  SafeAreaInsetsContext.displayName = "SafeAreaInsetsContext";
}
var SafeAreaFrameContext = /* @__PURE__ */ React2.createContext(null);
if (isDev) {
  SafeAreaFrameContext.displayName = "SafeAreaFrameContext";
}
var styles3 = import_react_native5.StyleSheet.create({
  fill: {
    flex: 1
  }
});
var NO_INSETS_ERROR = "No safe area value available. Make sure you are rendering `<SafeAreaProvider>` at the top of your app.";
function useSafeAreaInsets() {
  const insets = React2.useContext(SafeAreaInsetsContext);
  if (insets == null) {
    throw new Error(NO_INSETS_ERROR);
  }
  return insets;
}
var SafeAreaConsumer = SafeAreaInsetsContext.Consumer;

// src/components/Sheet.tsx
var import_vector_icons2 = require("@expo/vector-icons");
var import_jsx_runtime4 = require("react/jsx-runtime");
function Sheet({
  visible,
  onClose,
  children,
  title,
  maxHeight = "88%"
}) {
  const insets = useSafeAreaInsets();
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native6.Modal, { visible, transparent: true, animationType: "slide", onRequestClose: onClose, statusBarTranslucent: true, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    import_react_native6.KeyboardAvoidingView,
    {
      style: styles4.backdrop,
      behavior: import_react_native6.Platform.OS === "ios" ? "padding" : void 0,
      keyboardVerticalOffset: 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native6.Pressable, { style: import_react_native6.StyleSheet.absoluteFill, onPress: onClose, accessibilityRole: "button", accessibilityLabel: "Close" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native6.View, { style: [styles4.sheet, { maxHeight, paddingBottom: Math.max(SPACE.lg, insets.bottom + SPACE.sm) }], children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native6.View, { style: styles4.grabber }),
          title ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native6.View, { style: styles4.head, children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(MartText, { variant: "title", style: styles4.title, numberOfLines: 2, children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_react_native6.Pressable, { onPress: onClose, hitSlop: 10, accessibilityRole: "button", accessibilityLabel: "Close", style: styles4.close, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_vector_icons2.Ionicons, { name: "close", size: 20, color: MART.inkMuted }) })
          ] }) : null,
          children
        ] })
      ]
    }
  ) });
}
var styles4 = import_react_native6.StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: tint(MART.ink, 0.38), justifyContent: "flex-end" },
  sheet: {
    backgroundColor: MART.paperElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    ...SHADOW.floating
  },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { flex: 1 },
  close: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: RADIUS.pill, backgroundColor: MART.borderStrong, marginBottom: SPACE.sm }
});

// src/components/VerifiedBadge.tsx
var import_react_native7 = require("react-native");
var import_vector_icons3 = require("@expo/vector-icons");
var import_jsx_runtime5 = require("react/jsx-runtime");
function VerifiedBadge({ verified, compact = false }) {
  if (!verified) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native7.View, { style: [styles5.badge, compact && styles5.compact], accessibilityLabel: "Verified customer", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_vector_icons3.Ionicons, { name: "checkmark-circle", size: compact ? 11 : 13, color: MART.success }),
    compact ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MartText, { variant: "shelf", color: MART.success, children: "VERIFIED" })
  ] });
}
var styles5 = import_react_native7.StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: tint(MART.success, 0.12)
  },
  compact: { paddingHorizontal: 3, paddingVertical: 2 }
});

// src/components/FlyToCart.tsx
var import_react2 = require("react");
var import_react_native8 = require("react-native");
var import_jsx_runtime6 = require("react/jsx-runtime");
var TRAVEL = import_react_native8.Easing.bezier(0.77, 0, 0.175, 1);
var FLIGHT_MS = 400;
var GHOST = 44;
function FlyToCart({ flights, onDone }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native8.View, { style: import_react_native8.StyleSheet.absoluteFill, pointerEvents: "none", children: flights.map((flight) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Ghost, { flight, onDone }, flight.id)) });
}
function Ghost({ flight, onDone }) {
  const progress = (0, import_react2.useRef)(new import_react_native8.Animated.Value(0)).current;
  (0, import_react2.useEffect)(() => {
    const run = import_react_native8.Animated.timing(progress, {
      toValue: 1,
      duration: FLIGHT_MS,
      easing: TRAVEL,
      useNativeDriver: true
    });
    run.start(({ finished }) => {
      if (finished) onDone(flight.id);
    });
    return () => run.stop();
  }, [flight.id]);
  const dx = flight.to.x - (flight.from.x + flight.from.w / 2);
  const dy = flight.to.y - (flight.from.y + flight.from.h / 2);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_react_native8.Animated.View,
    {
      style: [
        styles6.ghost,
        {
          left: flight.from.x + flight.from.w / 2 - GHOST / 2,
          top: flight.from.y + flight.from.h / 2 - GHOST / 2,
          backgroundColor: tint(flight.colour, 0.22),
          opacity: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
            // An arc, not a straight line: it rises a little before it drops into the basket.
            { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy * 0.5 - 46, dy] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.42] }) }
          ]
        }
      ],
      children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native8.Animated.Text, { style: styles6.initials, children: flight.initials })
    }
  );
}
var styles6 = import_react_native8.StyleSheet.create({
  ghost: {
    position: "absolute",
    width: GHOST,
    height: GHOST,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: MART.border
  },
  initials: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    letterSpacing: 0.3,
    color: MART.ink
  }
});

// src/components/WeightSheet.tsx
var import_react3 = require("react");
var import_react_native9 = require("react-native");
var import_jsx_runtime7 = require("react/jsx-runtime");
var QUICK = [
  { label: "\xBC", thousandths: 250 },
  { label: "\xBD", thousandths: 500 },
  { label: "\xBE", thousandths: 750 },
  { label: "1", thousandths: 1e3 },
  { label: "2", thousandths: 2e3 }
];
function WeightSheet({
  visible,
  name,
  unit = "kg",
  perUnitCents,
  onCancel,
  onConfirm,
  onNotWeighed
}) {
  const [by, setBy] = (0, import_react3.useState)("weight");
  const [weightText, setWeightText] = (0, import_react3.useState)("");
  const [moneyText, setMoneyText] = (0, import_react3.useState)("");
  const [refused, setRefused] = (0, import_react3.useState)(null);
  const thousandths = (0, import_react3.useMemo)(() => {
    if (by === "weight") {
      const value = Number(weightText.replace(/[^0-9.]/g, ""));
      return Number.isFinite(value) && value > 0 ? Math.round(value * 1e3) : null;
    }
    if (perUnitCents === null) return null;
    const spend = Number(moneyText.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(spend) || spend <= 0) return null;
    return Math.round(spend * 100 * 1e3 / perUnitCents);
  }, [by, weightText, moneyText, perUnitCents]);
  const totalCents = thousandths !== null && perUnitCents !== null ? Math.round(thousandths * perUnitCents / 1e3) : null;
  const kg = thousandths === null ? null : thousandths / 1e3;
  const problem = perUnitCents === null ? "This product has no price, so it cannot be weighed." : refused;
  const submit = () => {
    if (thousandths === null) {
      setRefused(by === "weight" ? "Type a weight above zero." : "Type an amount above zero.");
      return;
    }
    setRefused(onConfirm(thousandths));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Sheet, { visible, onClose: onCancel, title: name, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native9.View, { style: styles7.body, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native9.View, { style: styles7.modes, children: ["weight", "money"].map((mode) => {
      const on = by === mode;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_react_native9.Pressable,
        {
          onPress: () => {
            setBy(mode);
            setRefused(null);
          },
          accessibilityRole: "button",
          accessibilityState: { selected: on },
          style: [styles7.mode, on && styles7.modeOn],
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "label", color: on ? MART.paper : MART.inkMuted, children: mode === "weight" ? `By ${unit}` : "By money" })
        },
        mode
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native9.View, { style: styles7.amount, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: by === "weight" ? unit.toUpperCase() : "WHAT THEY ARE SPENDING" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        import_react_native9.TextInput,
        {
          value: by === "weight" ? weightText : moneyText,
          onChangeText: (text) => {
            setRefused(null);
            if (by === "weight") setWeightText(text);
            else setMoneyText(text);
          },
          keyboardType: "decimal-pad",
          placeholder: by === "weight" ? "0.35" : "100",
          placeholderTextColor: MART.inkQuiet,
          style: styles7.input,
          accessibilityLabel: by === "weight" ? `Weight in ${unit}` : "Amount in shillings"
        }
      )
    ] }),
    by === "weight" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native9.View, { style: styles7.quick, children: QUICK.map((choice) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_react_native9.Pressable,
      {
        onPress: () => {
          setWeightText(String(choice.thousandths / 1e3));
          setRefused(null);
        },
        accessibilityRole: "button",
        accessibilityLabel: `${choice.thousandths / 1e3} ${unit}`,
        style: ({ pressed }) => [styles7.quickKey, pressed && styles7.pressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "label", children: choice.label })
      },
      choice.label
    )) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native9.View, { style: styles7.live, children: kg !== null && totalCents !== null ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(MartText, { variant: "title", numberOfLines: 1, children: [
      kg.toLocaleString("en-KE", { maximumFractionDigits: 3 }),
      " ",
      unit,
      " \xB7 KES",
      " ",
      (totalCents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: by === "weight" ? `Type how many ${unit}, or tap a fraction.` : "Type what the customer is spending." }) }),
    problem ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "meta", color: MART.danger, children: problem }) : null,
    onNotWeighed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      import_react_native9.Pressable,
      {
        onPress: () => {
          setRefused(null);
          void onNotWeighed().then((problem2) => setRefused(problem2));
        },
        accessibilityRole: "button",
        style: styles7.notWeighed,
        children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "meta", color: MART.inkMuted, style: styles7.notWeighedText, children: "This item isn't sold by weight \u2014 stop weighing it" })
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_react_native9.View, { style: styles7.actions, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native9.Pressable, { onPress: onCancel, accessibilityRole: "button", style: ({ pressed }) => [styles7.cancel, pressed && styles7.pressed], children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "label", color: MART.inkMuted, children: "Cancel" }) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_react_native9.Pressable, { onPress: submit, accessibilityRole: "button", style: ({ pressed }) => [styles7.add, pressed && styles7.pressed], children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MartText, { variant: "label", color: MART.paper, children: "Add to basket" }) })
    ] })
  ] }) });
}
var styles7 = import_react_native9.StyleSheet.create({
  body: { gap: SPACE.md, paddingTop: SPACE.xs },
  modes: { flexDirection: "row", gap: 6, padding: 3, borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken },
  mode: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill },
  modeOn: { backgroundColor: MART.fallbackPrimary },
  amount: { alignItems: "center", gap: 2 },
  input: { fontSize: 40, fontWeight: "700", color: MART.ink, textAlign: "center", minWidth: 160, paddingVertical: 4 },
  quick: { flexDirection: "row", gap: 6 },
  quickKey: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.md, backgroundColor: tint(MART.fallbackPrimary, 0.08) },
  live: { alignItems: "center", minHeight: 30, justifyContent: "center" },
  notWeighed: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 10 },
  notWeighedText: { textDecorationLine: "underline" },
  actions: { flexDirection: "row", gap: SPACE.sm, paddingTop: SPACE.xs },
  cancel: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken },
  add: { flex: 2, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill, backgroundColor: MART.fallbackPrimary },
  pressed: { opacity: 0.85 }
});

// src/components/ShelfTile.tsx
var import_react4 = require("react");
var import_react_native10 = require("react-native");
var import_vector_icons4 = require("@expo/vector-icons");
var import_core = require("@kiosk/core");
var import_jsx_runtime8 = require("react/jsx-runtime");
function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}
function money(cents) {
  return `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function ShelfTile({
  item,
  onPress,
  onAdd,
  onRemove,
  onPressRect,
  disabled = false,
  columns = 3,
  nameLines = 2,
  frame = "grid"
}) {
  const press = (0, import_react4.useRef)(new import_react_native10.Animated.Value(0)).current;
  const size = (0, import_react4.useRef)({ w: 0, h: 0 });
  const report = (pageX, pageY) => {
    if (!onPressRect || pageX === void 0 || pageY === void 0) return;
    const { w, h } = size.current;
    if (w === 0 || h === 0) return;
    onPressRect({ x: pageX - w / 2, y: pageY - h / 2, w, h });
  };
  const lift = (to) => {
    import_react_native10.Animated.timing(press, {
      toValue: to,
      duration: to ? MOTION.feedback : MOTION.state,
      easing: MOTION.easeOut,
      useNativeDriver: true
    }).start();
  };
  const out = item.onHandUnits !== null && item.onHandUnits <= 0;
  const count = item.inBasket ?? 0;
  const selected = count > 0;
  const accent = zoneFor(item.name);
  const add = onAdd ?? onPress;
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    import_react_native10.Animated.View,
    {
      onLayout: (event) => {
        const { width, height } = event.nativeEvent.layout;
        size.current = { w: width, h: height };
      },
      style: [
        styles8.tile,
        frame === "rail" ? styles8.tileRail : columns === 2 ? styles8.tileTwo : styles8.tileThree,
        selected && styles8.tileSelected,
        disabled && styles8.off,
        { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }
      ],
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          import_react_native10.Pressable,
          {
            onPressIn: (event) => {
              lift(1);
              report(event.nativeEvent.pageX, event.nativeEvent.pageY);
            },
            onPressOut: () => lift(0),
            onPress: add,
            disabled,
            accessibilityRole: "button",
            accessibilityLabel: [
              item.name,
              item.priceCents === null ? "no price" : money(item.priceCents),
              out ? "out of stock" : item.onHandUnits === null ? null : `${(0, import_core.formatQty)(item.onHandUnits)} on hand`,
              selected ? `${count} in basket` : null
            ].filter(Boolean).join(", "),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native10.View, { style: styles8.wellPad, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native10.View, { style: [styles8.well, columns === 2 && styles8.wellWide, { backgroundColor: tint(accent, out ? 0.08 : 0.12) }], children: [
                item.imageUrl ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native10.Image, { source: { uri: item.imageUrl }, style: [styles8.image, out && styles8.imageOut], resizeMode: "cover" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "label", color: tint(MART.ink, out ? 0.28 : 0.5), style: styles8.mark, children: initialsOf(item.name) }),
                selected ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native10.View, { style: styles8.check, accessibilityElementsHidden: true, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons4.Ionicons, { name: "checkmark", size: 12, color: onFill(MART.fallbackPrimary).primary }) }) : null
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native10.View, { style: styles8.info, children: [
                /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "heading", numberOfLines: nameLines, style: styles8.name, children: item.name }),
                item.priceCents === null ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "price", color: MART.inkQuiet, style: styles8.price, children: "No price" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "price", color: MART.ink, style: styles8.price, children: money(item.priceCents) }),
                out ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "meta", color: MART.danger, style: styles8.stockOut, children: "Out of stock" }) : item.onHandUnits !== null ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles8.stock, children: `${(0, import_core.formatQty)(item.onHandUnits)} on hand` }) : item.weighed ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles8.stock, children: "by weight" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_react_native10.View, { style: styles8.stockSpacer })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_react_native10.View, { style: [styles8.stepper, selected && styles8.stepperOn], children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            import_react_native10.Pressable,
            {
              onPress: onRemove,
              disabled: disabled || !selected || !onRemove,
              hitSlop: 4,
              accessibilityRole: "button",
              accessibilityLabel: selected ? `One fewer ${item.name}` : void 0,
              style: ({ pressed }) => [styles8.stepHit, (!selected || !onRemove) && styles8.stepDim, pressed && styles8.stepPressed],
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons4.Ionicons, { name: "remove", size: 16, color: selected ? MART.ink : MART.inkQuiet })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MartText, { variant: "heading", color: MART.ink, style: styles8.stepCount, children: count }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            import_react_native10.Pressable,
            {
              onPress: add,
              disabled,
              hitSlop: 4,
              accessibilityRole: "button",
              accessibilityLabel: `Add ${item.name}`,
              style: ({ pressed }) => [styles8.stepPlus, pressed && styles8.stepPressed],
              children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_vector_icons4.Ionicons, { name: "add", size: 16, color: onFill(MART.fallbackPrimary).primary })
            }
          )
        ] })
      ]
    }
  );
}
var styles8 = import_react_native10.StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    overflow: "hidden",
    paddingBottom: SPACE.xs,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...SHADOW.card
  },
  tileTwo: { maxWidth: "48.5%" },
  tileThree: { maxWidth: "31.5%" },
  tileRail: { width: "100%", maxWidth: "100%", flexGrow: 0 },
  tileSelected: {
    borderColor: MART.fallbackPrimary
  },
  off: { opacity: 0.5 },
  wellPad: { paddingHorizontal: SPACE.xs, paddingTop: SPACE.xs },
  // Compact media — initials or a short photo strip, not a half-card pastel block.
  well: {
    width: "100%",
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  wellWide: { height: 108 },
  image: { width: "100%", height: "100%" },
  imageOut: { opacity: 0.45 },
  mark: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, letterSpacing: -0.3 },
  check: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  info: { paddingHorizontal: SPACE.sm, paddingTop: SPACE.xs, paddingBottom: 2, gap: 1 },
  name: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.15
  },
  price: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2
  },
  stock: { fontSize: 11, lineHeight: 14 },
  stockOut: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, fontSize: 11, lineHeight: 14 },
  stockSpacer: { height: 14 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginHorizontal: SPACE.xs,
    marginTop: SPACE.xs,
    minHeight: 34,
    paddingLeft: 2,
    paddingRight: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken
  },
  stepperOn: {
    backgroundColor: tint(MART.fallbackPrimary, 0.12)
  },
  stepHit: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center"
  },
  stepDim: { opacity: 0.35 },
  stepPressed: { opacity: 0.7 },
  stepCount: {
    flex: 1,
    textAlign: "center",
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    fontVariant: ["tabular-nums"]
  },
  stepPlus: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: "center",
    justifyContent: "center"
  }
});

// src/store/auth-store.ts
var import_zustand = require("zustand");
var useAuthStore = (0, import_zustand.create)((set) => ({
  tenant: null,
  branchId: null,
  branchName: null,
  email: null,
  isAuthenticated: false,
  setTenant: (tenant) => set({ tenant }),
  setBranch: (branch) => set({ branchId: branch?.id ?? null, branchName: branch?.name ?? null }),
  setEmail: (email) => set({ email }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  reset: () => set({
    tenant: null,
    branchId: null,
    branchName: null,
    email: null,
    isAuthenticated: false
  })
}));

// src/hooks/useStaffBoot.ts
var import_react5 = require("react");
var import_react_native12 = require("react-native");
var import_core3 = require("@kiosk/core");

// src/lib/store-switch.ts
var import_react_native11 = require("react-native");
var import_core2 = require("@kiosk/core");
function describeUnsent(unsent) {
  const sales = `${unsent.total} unsent ${unsent.total === 1 ? "sale" : "sales"}`;
  const stuck = unsent.needsAttention;
  return stuck > 0 ? `${sales} (${stuck} ${stuck === 1 ? "needs" : "need"} attention)` : sales;
}
function confirmLeavingUnsent(unsent, storeName) {
  const name = storeName?.trim() || void 0;
  return new Promise((resolve) => {
    import_react_native11.Alert.alert(
      "Sales not sent yet",
      `${name ?? "This store"} has ${describeUnsent(unsent)}. They stay on this phone and are sent the next time you sign in to ${name ?? "it"}. Switch anyway?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Switch anyway", onPress: () => resolve(true) }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
function confirmSigningOutWithUnsent(unsent, storeName) {
  const name = storeName?.trim() || void 0;
  return new Promise((resolve) => {
    import_react_native11.Alert.alert(
      "Sales not sent yet",
      `${name ?? "This store"} has ${describeUnsent(unsent)}. Whoever signs in next on this phone sends them, under their own name and shift. Sign out anyway?`,
      [
        { text: "Stay signed in", style: "cancel", onPress: () => resolve(false) },
        { text: "Sign out anyway", onPress: () => resolve(true) }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
async function confirmSignOut(storeName) {
  const unsent = await (0, import_core2.getUnsentSummary)();
  if (unsent.total === 0) {
    return true;
  }
  return confirmSigningOutWithUnsent(unsent, storeName);
}
async function leaveStore(storeName) {
  const first = await (0, import_core2.switchStore)(null);
  if (first.kind === "switched") {
    return true;
  }
  if (!await confirmLeavingUnsent(first.unsent, storeName)) {
    return false;
  }
  return (await (0, import_core2.switchStore)(null, { keepUnsent: true })).kind === "switched";
}

// src/hooks/useStaffBoot.ts
async function tryResolveStaffDeepLink(url, baseURL, keepUnsent = false) {
  if (!url?.trim()) {
    return null;
  }
  const result = await (0, import_core3.resolveTenantFromDeepLink)(url, baseURL, { audience: "staff", keepUnsent });
  if (!result || !(0, import_core3.isStaffDeepLinkIntent)(result.intent)) {
    return null;
  }
  return result.tenant;
}
function useStaffBoot(baseURL, setTenant, mayFollowLink) {
  const [phase, setPhase] = (0, import_react5.useState)("loading");
  const [bootError, setBootError] = (0, import_react5.useState)(null);
  const applyDeepLinkTenant = (0, import_react5.useCallback)(
    (tenant) => {
      if (useAuthStore.getState().tenant?.slug !== tenant.slug) {
        useAuthStore.getState().reset();
      }
      setTenant(tenant);
      setBootError(null);
      setPhase("branch");
    },
    [setTenant]
  );
  const runBootstrap = (0, import_react5.useCallback)(async () => {
    setPhase("loading");
    setBootError(null);
    try {
      const initialUrl = await import_react_native12.Linking.getInitialURL();
      let fromDeepLink = null;
      try {
        fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
      } catch (error) {
        if (!(error instanceof import_core3.StoreSwitchBlockedError)) {
          throw error;
        }
      }
      if (fromDeepLink) {
        applyDeepLinkTenant(fromDeepLink);
        return;
      }
      const tenant = await (0, import_core3.bootstrapTenant)(baseURL);
      if (tenant) {
        setTenant(tenant);
        setPhase("branch");
        return;
      }
      if ((0, import_core3.getEmbeddedTenantSlug)()) {
        setBootError("Could not connect to your store. Check your network and try again.");
        setPhase("error");
        return;
      }
      setPhase("tenant");
    } catch (error) {
      if ((0, import_core3.getEmbeddedTenantSlug)()) {
        setBootError(error instanceof Error ? error.message : "Could not load your store");
        setPhase("error");
      } else {
        setPhase("tenant");
      }
    }
  }, [applyDeepLinkTenant, baseURL, setTenant]);
  (0, import_react5.useEffect)(() => {
    void runBootstrap();
  }, [runBootstrap]);
  (0, import_core3.useTenantDeepLink)(async (url) => {
    if (mayFollowLink && !mayFollowLink(url)) {
      return;
    }
    try {
      const tenant = await tryResolveStaffDeepLink(url, baseURL);
      if (!tenant) {
        return;
      }
      applyDeepLinkTenant(tenant);
    } catch (error) {
      if (error instanceof import_core3.StoreSwitchBlockedError && await confirmLeavingUnsent(error.unsent)) {
        try {
          const tenant = await tryResolveStaffDeepLink(url, baseURL, true);
          if (tenant) {
            applyDeepLinkTenant(tenant);
          }
        } catch {
        }
      }
    }
  });
  return { phase, setPhase, bootError, retry: runBootstrap };
}

// src/hooks/useStaffAuthNavigation.ts
var import_react6 = require("react");
var import_core4 = require("@kiosk/core");
function useStaffAuthNavigation(setPhase, onLeaveStore) {
  const { reset, setBranch, tenant } = useAuthStore();
  const canChangeStore = !(0, import_core4.getEmbeddedTenantSlug)();
  const goToTenant = (0, import_react6.useCallback)(async () => {
    if (!canChangeStore) {
      return;
    }
    if (!await leaveStore(tenant?.displayName)) {
      return;
    }
    reset();
    onLeaveStore?.();
    setPhase("tenant");
  }, [canChangeStore, onLeaveStore, reset, setPhase, tenant?.displayName]);
  const goToBranch = (0, import_react6.useCallback)(() => {
    setBranch(null);
    setPhase("branch");
  }, [setBranch, setPhase]);
  return { canChangeStore, goToTenant, goToBranch };
}

// src/hooks/useKept.ts
var import_react7 = require("react");
function useKept(keeper) {
  const value = (0, import_react7.useSyncExternalStore)(keeper.subscribe, keeper.get, keeper.get);
  const [state, setState] = (0, import_react7.useState)(keeper.isLoaded() ? "ready" : "loading");
  const [attempt, setAttempt] = (0, import_react7.useState)(0);
  (0, import_react7.useEffect)(() => {
    if (keeper.isLoaded()) {
      setState("ready");
      return void 0;
    }
    let live = true;
    setState("loading");
    keeper.load(Date.now()).then(
      () => {
        if (live) setState("ready");
      },
      () => {
        if (live) setState("failed");
      }
    );
    return () => {
      live = false;
    };
  }, [keeper, attempt]);
  const retry = (0, import_react7.useCallback)(() => setAttempt((n) => n + 1), []);
  return { value, ready: state === "ready", failed: state === "failed", retry };
}

// src/hooks/useFlushLoop.ts
var import_react8 = require("react");
var import_react_native13 = require("react-native");
function useFlushLoop(flush, options = {}) {
  const { everyMs = 3e4, enabled = true } = options;
  const latest = (0, import_react8.useRef)(flush);
  latest.current = flush;
  (0, import_react8.useEffect)(() => {
    if (!enabled) return void 0;
    const run = () => {
      latest.current().catch(() => void 0);
    };
    run();
    const timer = setInterval(run, everyMs);
    const subscription = import_react_native13.AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [everyMs, enabled]);
}

// src/hooks/useItemSearch.ts
var import_react9 = require("react");
var import_core5 = require("@kiosk/core");
var TYPING_PAUSE_MS = 350;
function oneOfEach(items) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => seen.has(item.id) ? false : (seen.add(item.id), true));
}
function useItemSearch(api, branchId, options = {}) {
  const { lowStock, zeroStock, categoryId, itemTypeId, idle } = options;
  const [query, setQuery] = (0, import_react9.useState)("");
  const [items, setItems] = (0, import_react9.useState)([]);
  const [loading, setLoading] = (0, import_react9.useState)(false);
  const [failed, setFailed] = (0, import_react9.useState)(null);
  const [total, setTotal] = (0, import_react9.useState)(null);
  const [more, setMore] = (0, import_react9.useState)(false);
  const [version, setVersion] = (0, import_react9.useState)(0);
  const sequence = (0, import_react9.useRef)(0);
  const page = (0, import_react9.useRef)(0);
  const run = (0, import_react9.useCallback)(
    async (wanted, append) => {
      const mine = ++sequence.current;
      setLoading(true);
      try {
        const terms = (0, import_core5.searchTerms)(query);
        const path = (0, import_core5.itemsPath)({
          branchId,
          ...terms ?? {},
          ...categoryId ? { categoryId } : {},
          ...itemTypeId ? { itemTypeId } : {},
          ...lowStock ? { lowStock } : {},
          ...zeroStock ? { zeroStock } : {},
          page: wanted
        });
        const raw = await api.get(path);
        if (mine !== sequence.current) return;
        const result = (0, import_core5.readItemsPage)(raw, { page: wanted, size: import_core5.ITEM_PAGE_SIZE });
        if (!result) {
          setFailed("unreadable");
          return;
        }
        page.current = wanted;
        setItems((before) => {
          if (!append) return oneOfEach(result.items);
          const known = new Set(before.map((item) => item.id));
          return [...before, ...result.items.filter((item) => !known.has(item.id))];
        });
        setMore(result.more);
        setTotal(result.total);
        setFailed(null);
      } catch {
        if (mine === sequence.current) setFailed("network");
      } finally {
        if (mine === sequence.current) setLoading(false);
      }
    },
    [api, branchId, query, lowStock, zeroStock, categoryId, itemTypeId]
  );
  (0, import_react9.useEffect)(() => {
    if (idle && (0, import_core5.searchTerms)(query) === null) {
      sequence.current += 1;
      setItems([]);
      setMore(false);
      setTotal(null);
      setFailed(null);
      setLoading(false);
      return void 0;
    }
    const timer = setTimeout(() => void run(0, false), query ? TYPING_PAUSE_MS : 0);
    return () => clearTimeout(timer);
  }, [run, idle, query, version]);
  const loadMore = (0, import_react9.useCallback)(() => {
    if (more && !loading && failed === null) void run(page.current + 1, true);
  }, [more, loading, failed, run]);
  const reload = (0, import_react9.useCallback)(() => setVersion((n) => n + 1), []);
  const lookup = (0, import_react9.useCallback)(
    async (barcode) => {
      const terms = (0, import_core5.searchTerms)(barcode);
      if (!terms) return null;
      try {
        const raw = await api.get((0, import_core5.itemsPath)({ branchId, ...terms, size: 5 }));
        return (0, import_core5.readItemsPage)(raw, { page: 0, size: 5 })?.items ?? null;
      } catch {
        return null;
      }
    },
    [api, branchId]
  );
  return { query, setQuery, items, loading, failed, total, more, loadMore, reload, lookup };
}

// src/components/ItemPicker.tsx
var import_react10 = require("react");
var import_react_native14 = require("react-native");
var import_vector_icons5 = require("@expo/vector-icons");
var import_core6 = require("@kiosk/core");
var import_ui2 = require("@kiosk/ui");
var import_jsx_runtime9 = require("react/jsx-runtime");
var SAME_CODE_MS = 2500;
function ItemPicker({ api, branchId, onPick, onRemove, renderScanner, withFilters = false, initialFilter = "all", idle = false, continuous = false, scanNote = null, scanTone = "ok", placeholder = "Name, code or barcode", cards = false, columns = 3, nameLines = 2, featured, categoryId, itemTypeId, onPickRect, inBasket, focusSignal = 0, showFilter = false, showAdd = false, accent }) {
  const [filter, setFilter] = (0, import_react10.useState)(initialFilter);
  const [scanning, setScanning] = (0, import_react10.useState)(false);
  const [message, setMessage] = (0, import_react10.useState)(null);
  const last = (0, import_react10.useRef)(null);
  const search = useItemSearch(api, branchId, {
    ...filter === "low" ? { lowStock: true } : {},
    ...filter === "out" ? { zeroStock: true } : {},
    ...categoryId ? { categoryId } : {},
    ...itemTypeId ? { itemTypeId } : {},
    idle
  });
  const { lookup, setQuery } = search;
  const input = (0, import_react10.useRef)(null);
  const featuredIds = (0, import_react10.useMemo)(() => new Set((featured ?? []).map((item) => item.id)), [featured]);
  const showFeatured = cards && !search.query && (featured?.length ?? 0) > 0;
  const rows = showFeatured ? search.items.filter((item) => !featuredIds.has(item.id)) : search.items;
  (0, import_react10.useEffect)(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);
  const onBarcode = (0, import_react10.useCallback)(
    async (value) => {
      const now = Date.now();
      if (last.current && last.current.code === value && now - last.current.at < SAME_CODE_MS) return;
      last.current = { code: value, at: now };
      if (!continuous) setScanning(false);
      const found = await lookup(value);
      if (found === null) setMessage("Could not look that code up. Check the signal and try again.");
      else if (found.length === 0) setMessage(`No item has the code ${value}.`);
      else if (found.length === 1 && found[0]) {
        setMessage(null);
        onPick(found[0]);
      } else {
        setMessage(null);
        setScanning(false);
        setQuery(value);
      }
    },
    [continuous, lookup, onPick, setQuery]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.fill, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.searchRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.searchField, children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons5.Ionicons, { name: "search", size: 17, color: MART.inkQuiet }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          import_react_native14.TextInput,
          {
            ref: input,
            value: search.query,
            onChangeText: search.setQuery,
            placeholder,
            placeholderTextColor: MART.inkQuiet,
            autoCapitalize: "none",
            autoCorrect: false,
            returnKeyType: "search",
            style: styles9.searchInput,
            accessibilityLabel: placeholder
          }
        ),
        showFilter ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          import_react_native14.Pressable,
          {
            onPress: () => setFilter(filter === "all" ? "low" : filter === "low" ? "out" : "all"),
            hitSlop: 8,
            accessibilityRole: "button",
            accessibilityLabel: filter === "all" ? "Filter: all items" : filter === "low" ? "Filter: low stock" : "Filter: out of stock",
            style: [styles9.filterDot, filter !== "all" && { backgroundColor: accent ?? MART.fallbackPrimary }],
            children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons5.Ionicons, { name: "options-outline", size: 15, color: filter === "all" ? MART.inkMuted : MART.paper })
          }
        ) : null,
        search.query ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.Pressable, { onPress: () => search.setQuery(""), hitSlop: 8, accessibilityLabel: "Clear search", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons5.Ionicons, { name: "close-circle", size: 17, color: MART.inkQuiet }) }) : null
      ] }),
      renderScanner ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        import_react_native14.Pressable,
        {
          onPress: () => setScanning(true),
          accessibilityRole: "button",
          accessibilityLabel: "Scan a barcode",
          style: ({ pressed }) => [styles9.scanBtn, pressed && styles9.scanPressed],
          children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons5.Ionicons, { name: "barcode-outline", size: 20, color: MART.paper })
        }
      ) : null
    ] }),
    showAdd ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_react_native14.Pressable,
      {
        onPress: () => renderScanner ? setScanning(true) : input.current?.focus(),
        accessibilityRole: "button",
        accessibilityLabel: "Add an item",
        style: ({ pressed }) => [styles9.fab, accent ? { backgroundColor: accent } : null, pressed && styles9.fabPressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_vector_icons5.Ionicons, { name: "add", size: 26, color: MART.paper })
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.View, { style: styles9.controls, children: withFilters ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.chips, children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Chip, { label: "All", selected: filter === "all", onPress: () => setFilter("all") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Chip, { label: "Low", selected: filter === "low", onPress: () => setFilter("low") }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Chip, { label: "Out", selected: filter === "out", onPress: () => setFilter("out") })
    ] }) : null }),
    message ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Banner, { tone: "warn", children: message }) : null,
    search.failed ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_ui2.Banner, { tone: "danger", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Text, { variant: "caption", children: search.failed === "network" ? "Could not load items. Check the signal." : "The server sent something the app could not read." }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Button, { title: "Try again", variant: "secondary", onPress: search.reload, style: styles9.retry })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      import_react_native14.FlatList,
      {
        style: styles9.fill,
        data: rows,
        keyExtractor: (item, index) => `${item.id}:${index}`,
        keyboardShouldPersistTaps: "handled",
        onEndReachedThreshold: 0.4,
        onEndReached: search.loadMore,
        ...cards ? {
          numColumns: columns,
          key: `cols-${columns}`,
          columnWrapperStyle: styles9.gridRow,
          contentContainerStyle: styles9.grid
        } : {},
        ListHeaderComponent: showFeatured && featured ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          BestSellers,
          {
            items: featured,
            nameLines,
            inBasket,
            onPick,
            ...onRemove ? { onRemove } : {}
          }
        ) : null,
        renderItem: ({ item }) => cards ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          ShelfTile,
          {
            item: {
              name: (0, import_core6.itemLabel)(item),
              priceCents: item.sellingCents,
              onHandUnits: item.onHandUnits,
              weighed: item.weighed,
              imageUrl: item.imageUrl,
              ...inBasket?.[item.id] ? { inBasket: inBasket[item.id] } : {}
            },
            columns,
            nameLines,
            onPress: () => onPick(item),
            onAdd: () => onPick(item),
            ...onRemove ? { onRemove: () => onRemove(item) } : {},
            ...onPickRect ? { onPressRect: (rect) => onPickRect({ ...rect, name: (0, import_core6.itemLabel)(item) }) } : {},
            disabled: !item.active || !item.sellable
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          PickerRow,
          {
            item,
            disabled: !item.active || !item.sellable,
            onPress: () => onPick(item)
          }
        ),
        ListEmptyComponent: search.loading || search.failed || showFeatured ? null : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Text, { variant: "muted", style: styles9.empty, children: idle && !search.query ? "Type a name or scan a barcode." : "No items found." }),
        ListFooterComponent: search.loading ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.ActivityIndicator, { style: styles9.spinner, color: MART.fallbackPrimary }) : null
      }
    ),
    renderScanner ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.Modal, { visible: scanning, animationType: "slide", onRequestClose: () => setScanning(false), children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.fill, children: [
      renderScanner({ onBarcode: (value) => void onBarcode(value), onClose: () => setScanning(false) }),
      continuous && (scanNote || message) ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.View, { style: styles9.scanNote, pointerEvents: "none", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_ui2.Banner, { tone: message ? "warn" : scanTone, children: message ?? scanNote ?? "" }) }) : null
    ] }) }) : null
  ] });
}
function BestSellers({
  items,
  nameLines,
  inBasket,
  onPick,
  onRemove
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.feature, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MartText, { variant: "heading", style: styles9.featureTitle, children: "Best sellers" }),
    /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles9.featureRow, children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.View, { style: styles9.featureCard, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      ShelfTile,
      {
        frame: "rail",
        columns: 2,
        nameLines: Math.min(nameLines, 3),
        item: {
          name: (0, import_core6.itemLabel)(item),
          priceCents: item.sellingCents,
          onHandUnits: item.onHandUnits,
          weighed: item.weighed,
          imageUrl: item.imageUrl,
          ...inBasket?.[item.id] ? { inBasket: inBasket[item.id] } : {}
        },
        onPress: () => onPick(item),
        onAdd: () => onPick(item),
        ...onRemove ? { onRemove: () => onRemove(item) } : {},
        disabled: !item.active || !item.sellable
      }
    ) }, item.id)) })
  ] });
}
function PickerRow({
  item,
  disabled,
  onPress
}) {
  const zone = zoneFor(item.name);
  const words = [item.sku, item.barcode, item.active && item.sellable ? null : "Not for sale"].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    import_react_native14.Pressable,
    {
      onPress,
      disabled,
      accessibilityRole: "button",
      accessibilityLabel: `${(0, import_core6.itemLabel)(item)}${item.onHandUnits === null ? "" : `, ${(0, import_core6.formatQty)(item.onHandUnits)} on hand`}`,
      style: ({ pressed }) => [styles9.pickerRow, disabled && styles9.pickerRowOff, pressed && styles9.pickerRowPressed],
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.View, { style: [styles9.pickerMark, { backgroundColor: tint(zone, 0.16) }], children: item.imageUrl ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.Image, { source: { uri: item.imageUrl }, style: styles9.pickerPhoto, resizeMode: "cover" }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MartText, { variant: "shelf", color: tint(MART.ink, 0.6), children: ((0, import_core6.itemLabel)(item).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("") || "?").toUpperCase() }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_react_native14.View, { style: styles9.pickerBody, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MartText, { variant: "label", numberOfLines: 2, children: (0, import_core6.itemLabel)(item) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: words || "No code" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_react_native14.View, { style: styles9.pickerFigure, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MartText, { variant: "shelf", color: MART.inkMuted, children: item.onHandUnits === null ? "NOT COUNTED" : `${(0, import_core6.formatQty)(item.onHandUnits)} ON HAND` }) })
      ]
    }
  );
}
var styles9 = import_react_native14.StyleSheet.create({
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: 9,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border
  },
  pickerRowOff: { opacity: 0.5 },
  pickerRowPressed: { opacity: 0.9 },
  pickerMark: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  pickerPhoto: { width: "100%", height: "100%" },
  feature: { paddingTop: SPACE.sm, gap: SPACE.xs },
  featureTitle: { paddingHorizontal: SPACE.xs },
  featureRow: { gap: SPACE.sm, paddingVertical: SPACE.xs, paddingRight: SPACE.sm },
  featureCard: { width: 168 },
  pickerBody: { flex: 1, gap: 1 },
  pickerFigure: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: MART.paperSunken },
  fill: { flex: 1 },
  grid: { paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm, gap: SPACE.sm, paddingBottom: SPACE.xxl },
  gridRow: { gap: SPACE.sm },
  filterDot: { width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: MART.paperSunken },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.fallbackPrimary,
    shadowColor: MART.ink,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    zIndex: 5
  },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingTop: SPACE.sm },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: import_react_native14.StyleSheet.hairlineWidth,
    borderColor: MART.borderStrong
  },
  searchInput: { flex: 1, minHeight: 40, fontFamily: FONT.regular, fontWeight: WEIGHT.regular, fontSize: 15, color: MART.ink, paddingVertical: 0 },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.fallbackPrimary
  },
  scanPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  controls: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", paddingHorizontal: SPACE.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs, paddingTop: SPACE.xs },
  retry: { marginTop: SPACE.sm },
  empty: { textAlign: "center", padding: SPACE.xl, color: MART.inkQuiet },
  spinner: { padding: SPACE.md },
  scanNote: { position: "absolute", left: SPACE.md, right: SPACE.md, top: 56 }
});

// src/lib/stock-calls.ts
var import_core7 = require("@kiosk/core");
async function fetchFreshItem(api, branchId, itemId) {
  const raw = await (0, import_core7.withTimeout)(api.get(`/api/v1/items/${encodeURIComponent(itemId)}?branchId=${encodeURIComponent(branchId)}`), import_core7.READ_TIMEOUT_MS);
  return (0, import_core7.readStockItem)(raw);
}
var HISTORY_LIMIT = 100;
async function fetchHistory(api, itemId, limit = HISTORY_LIMIT) {
  const raw = await (0, import_core7.withTimeout)(api.get(`/api/v1/items/${encodeURIComponent(itemId)}/timeline?limit=${limit}`), import_core7.READ_TIMEOUT_MS);
  return (0, import_core7.readItemHistory)(raw, limit);
}
function postStockIncrease(api, body) {
  return (0, import_core7.withTimeout)(api.post("/api/v1/inventory/stock-increase", body), import_core7.WRITE_TIMEOUT_MS);
}
function fetchAllocation(api, itemId, branchId, units) {
  return (0, import_core7.withTimeout)(api.get((0, import_core7.allocationPreviewPath)(itemId, branchId, units)), import_core7.READ_TIMEOUT_MS);
}
function postBatchDecrease(api, body) {
  return (0, import_core7.withTimeout)(api.post("/api/v1/inventory/batch-decrease", body), import_core7.WRITE_TIMEOUT_MS);
}
function postWastage(api, body) {
  return (0, import_core7.withTimeout)(api.post("/api/v1/inventory/wastage", body), import_core7.WRITE_TIMEOUT_MS);
}

// src/screens/TenantEntryScreen.tsx
var import_react13 = require("react");
var import_react_native17 = require("react-native");
var import_core8 = require("@kiosk/core");

// src/theme/Field.tsx
var import_vector_icons6 = require("@expo/vector-icons");
var import_react11 = require("react");
var import_react_native15 = require("react-native");
var import_jsx_runtime10 = require("react/jsx-runtime");
var Field = (0, import_react11.forwardRef)(function Field2({ label, hint, error, icon, prefix, trailing, on = "water", containerStyle, style, multiline, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = (0, import_react11.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_react_native15.View, { style: containerStyle, children: [
    label ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native15.Text, { style: styles10.label, children: label }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
      import_react_native15.View,
      {
        style: [
          styles10.field,
          multiline && styles10.multiline,
          { backgroundColor: on === "tile" ? MART.paper : MART.paperElevated },
          focused && styles10.focused,
          error ? styles10.invalid : null
        ],
        children: [
          icon ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_vector_icons6.Ionicons, { name: icon, size: 20, color: MART.inkMuted }) : null,
          prefix ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native15.Text, { style: styles10.prefix, children: prefix }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            import_react_native15.TextInput,
            {
              ref,
              placeholderTextColor: MART.inkQuiet,
              selectionColor: MART.ink,
              accessibilityLabel: label,
              multiline,
              ...input,
              onFocus: (event) => {
                setFocused(true);
                onFocus?.(event);
              },
              onBlur: (event) => {
                setFocused(false);
                onBlur?.(event);
              },
              style: [styles10.input, multiline && styles10.inputMultiline, style]
            }
          ),
          trailing
        ]
      }
    ),
    error ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native15.Text, { style: styles10.error, accessibilityLiveRegion: "polite", accessibilityRole: "alert", children: error }) : hint ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_react_native15.Text, { style: styles10.hint, children: hint }) : null
  ] });
});
var styles10 = import_react_native15.StyleSheet.create({
  label: {
    ...TYPE.label,
    marginBottom: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.ink
  },
  field: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.border
  },
  multiline: {
    alignItems: "flex-start",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.md
  },
  focused: {
    borderColor: MART.ink
  },
  invalid: {
    borderColor: MART.danger
  },
  prefix: {
    ...TYPE.body,
    color: MART.inkMuted
  },
  input: {
    ...TYPE.body,
    lineHeight: void 0,
    flex: 1,
    minHeight: 50,
    paddingVertical: 0,
    color: MART.ink
  },
  inputMultiline: {
    minHeight: 84,
    lineHeight: TYPE.body.lineHeight,
    textAlignVertical: "top"
  },
  hint: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.inkQuiet
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    marginLeft: SPACE.xs,
    color: MART.danger
  }
});

// src/theme/Entrance.tsx
var import_react12 = require("react");
var import_react_native16 = require("react-native");
var import_jsx_runtime11 = require("react/jsx-runtime");
function Entrance({
  delay = 0,
  rise = SPACE.lg,
  style,
  children,
  ...rest
}) {
  const t = (0, import_react12.useRef)(new import_react_native16.Animated.Value(0)).current;
  (0, import_react12.useEffect)(() => {
    const anim = import_react_native16.Animated.timing(t, {
      toValue: 1,
      duration: 360,
      delay,
      easing: import_react_native16.Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    import_react_native16.Animated.View,
    {
      ...rest,
      style: [
        style,
        {
          opacity: t,
          transform: [
            {
              translateY: t.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] })
            }
          ]
        }
      ],
      children
    }
  );
}

// src/screens/TenantEntryScreen.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }) {
  const [input, setInput] = (0, import_react13.useState)("");
  const [email, setEmail] = (0, import_react13.useState)("");
  const [loading, setLoading] = (0, import_react13.useState)(false);
  const [showEmailFallback, setShowEmailFallback] = (0, import_react13.useState)(false);
  const brand = MART.fallbackPrimary;
  const greeting = (0, import_react13.useMemo)(() => {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);
  const on = onFill(brand);
  const initials = (0, import_react13.useMemo)(() => {
    const parts = appTitle.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [appTitle]);
  const open = async (value, keepUnsent = false) => {
    const result = await (0, import_core8.openStore)(value, baseURL, { audience: "staff", keepUnsent });
    if (result.kind === "opened") {
      onTenantResolved(result.store);
      return;
    }
    if (result.kind === "blocked") {
      if (await confirmLeavingUnsent(result.unsent)) {
        await open(value, true);
      }
      return;
    }
    import_react_native17.Alert.alert("Could not open store", (0, import_core8.describeStoreResult)(result, value));
  };
  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await open(input.trim());
    } catch (e) {
      import_react_native17.Alert.alert("Error", e instanceof Error ? e.message : "Could not resolve tenant");
    } finally {
      setLoading(false);
    }
  };
  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await (0, import_core8.resolveTenantByEmail)(baseURL, email.trim());
      await open(result.host);
    } catch (e) {
      import_react_native17.Alert.alert("Error", e instanceof Error ? e.message : "Could not find tenant for email");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Screen, { style: styles11.container, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.ScrollView, { contentContainerStyle: styles11.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.View, { style: [styles11.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_native17.View, { style: [styles11.orb, styles11.orbOne, { backgroundColor: on.primary, opacity: 0.1 }] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_native17.View, { style: [styles11.orb, styles11.orbTwo, { backgroundColor: on.primary, opacity: 0.08 }] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Entrance, { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.View, { style: styles11.passTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_native17.View, { style: [styles11.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "title", color: brand, style: styles11.plaqueMark, children: initials }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.View, { style: styles11.passNames, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "shelf", color: on.secondary, style: styles11.passEyebrow, children: "STAFF \xB7 KIOSK" }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "heading", color: on.primary, children: appTitle })
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(Entrance, { delay: 70, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(MartText, { variant: "display", color: on.primary, style: styles11.passTitle, children: [
          greeting,
          "."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "body", color: on.secondary, style: styles11.passHint, children: "Open your shop to sign in. Your basket, shift and shelf are waiting where you left them." })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(Entrance, { delay: 140, style: styles11.formBody, children: [
      showEmailFallback ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        Field,
        {
          on: "tile",
          label: "Find your shop by email",
          icon: "mail-outline",
          placeholder: "you@shop.co.ke",
          value: email,
          onChangeText: setEmail,
          autoCapitalize: "none",
          autoCorrect: false,
          keyboardType: "email-address",
          returnKeyType: "go",
          onSubmitEditing: resolveByEmail,
          editable: !loading,
          accessibilityLabel: "Staff email"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        Field,
        {
          on: "tile",
          label: "Find your shop",
          icon: "storefront-outline",
          placeholder: "e.g. tumaini-mini-mart",
          value: input,
          onChangeText: setInput,
          autoCapitalize: "none",
          autoCorrect: false,
          returnKeyType: "go",
          onSubmitEditing: resolve,
          editable: !loading,
          accessibilityLabel: "Business slug or host"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        MartButton,
        {
          label: loading ? "Opening\u2026" : showEmailFallback ? "Find my shop" : "Open shop",
          busy: loading,
          style: styles11.submit,
          onPress: showEmailFallback ? resolveByEmail : resolve
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
        MartButton,
        {
          label: showEmailFallback ? "Use a shop name instead" : "I only know my email",
          kind: "quiet",
          disabled: loading,
          onPress: () => setShowEmailFallback((v) => !v)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.View, { style: styles11.cardFoot, children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_native17.View, { style: [styles11.footDot, { backgroundColor: tint(brand, 0.5) }] }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles11.footText, children: showEmailFallback ? "Your email must be on the shop\u2019s staff list." : "The slug is in the shop\u2019s web address \u2014 ask the owner if unsure." })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Entrance, { delay: 220, style: styles11.footer, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_react_native17.View, { style: styles11.footerMark, children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_react_native17.View, { style: [styles11.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] }) })
  ] }) });
}
var EDGE = SPACE.xxl;
var styles11 = import_react_native17.StyleSheet.create({
  // No page padding: the header and the card span full width and set their own EDGE inset, so their
  // content shares one left line.
  container: {
    paddingHorizontal: 0,
    paddingBottom: SPACE.lg
  },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: import_react_native17.Platform.select({ ios: 72, android: 40, default: 72 }),
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: "hidden",
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  orb: {
    position: "absolute",
    borderRadius: 999
  },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -160,
    left: -80,
    opacity: 0.5
  },
  // The plaque: a cream card the monogram is struck into, like a shop's nameplate.
  plaque: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: MART.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  plaqueMark: { letterSpacing: -0.5 },
  passNames: { flex: 1, gap: 2 },
  passTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    marginBottom: SPACE.lg
  },
  passMark: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  passMonogram: {
    ...TYPE.label,
    fontFamily: FONT.black,
    fontWeight: WEIGHT.black
  },
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  passTitle: { letterSpacing: -1.2 },
  passHint: { marginTop: SPACE.xs, maxWidth: 300 },
  formBody: {
    // card inset 16 + inner padding 12 = 28, so card content aligns with the header's EDGE (28).
    gap: SPACE.lg,
    marginTop: -32,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  cardFoot: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm, marginTop: SPACE.xs },
  footDot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  footText: { flex: 1, lineHeight: 17 },
  submit: {
    marginTop: SPACE.sm,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  footer: {
    marginTop: "auto",
    paddingTop: SPACE.xxl,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
    gap: SPACE.lg
  },
  footerText: {
    textAlign: "center",
    maxWidth: 300
  },
  footerMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm
  },
  footerDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  }
});

// src/screens/PinLoginScreen.tsx
var import_react15 = require("react");
var import_react_native19 = require("react-native");
var import_ui4 = require("@kiosk/ui");
var import_core9 = require("@kiosk/core");

// src/components/AuthBackBar.tsx
var import_react14 = require("react");
var import_react_native18 = require("react-native");
var import_ui3 = require("@kiosk/ui");
var import_jsx_runtime13 = require("react/jsx-runtime");
function AuthBackBar({
  onBack,
  backLabel = "Back",
  onSecondary,
  secondaryLabel
}) {
  (0, import_react14.useEffect)(() => {
    if (!onBack) {
      return;
    }
    const sub = import_react_native18.BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  if (!onBack && !onSecondary) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_react_native18.View, { style: styles12.spacer });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_react_native18.View, { style: styles12.bar, children: [
    onBack ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      import_react_native18.Pressable,
      {
        onPress: onBack,
        accessibilityRole: "button",
        accessibilityLabel: backLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles12.hit, pressed && styles12.pressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_ui3.Text, { style: styles12.label, children: backLabel })
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_react_native18.View, {}),
    onSecondary && secondaryLabel ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      import_react_native18.Pressable,
      {
        onPress: onSecondary,
        accessibilityRole: "button",
        accessibilityLabel: secondaryLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles12.hit, pressed && styles12.pressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_ui3.Text, { style: styles12.secondary, children: secondaryLabel })
      }
    ) : null
  ] });
}
var styles12 = import_react_native18.StyleSheet.create({
  spacer: {
    height: import_react_native18.Platform.OS === "android" ? import_react_native18.StatusBar.currentHeight ?? 16 : 48
  },
  bar: {
    paddingTop: import_react_native18.Platform.OS === "android" ? (import_react_native18.StatusBar.currentHeight ?? 12) + 8 : 52,
    paddingBottom: import_ui3.theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48
  },
  hit: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: import_ui3.theme.spacing.sm,
    paddingRight: import_ui3.theme.spacing.md
  },
  pressed: {
    opacity: 0.6
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: import_ui3.theme.colors.primaryDark
  },
  secondary: {
    fontSize: 16,
    fontWeight: "600",
    color: import_ui3.theme.colors.primaryDark
  }
});

// src/screens/PinLoginScreen.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
function PinLoginScreen({
  baseURL,
  branchId,
  onSuccess,
  allowPassword = false,
  storeName,
  branchName,
  onBack,
  onChangeStore
}) {
  const [email, setEmail] = (0, import_react15.useState)("");
  const [pin, setPin] = (0, import_react15.useState)("");
  const [password, setPassword] = (0, import_react15.useState)("");
  const [usePassword, setUsePassword] = (0, import_react15.useState)(false);
  const [loading, setLoading] = (0, import_react15.useState)(false);
  const login = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      if (usePassword && allowPassword) {
        await (0, import_core9.loginWithPassword)(baseURL, email.trim(), password);
      } else {
        if (pin.length < 4) {
          import_react_native19.Alert.alert("Error", "Enter your PIN");
          return;
        }
        await (0, import_core9.loginWithPin)(baseURL, email.trim(), pin, branchId);
      }
      const branches = await (0, import_core9.fetchBranches)(baseURL);
      onSuccess(branches);
    } catch (e) {
      import_react_native19.Alert.alert("Login failed", e instanceof Error ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };
  const contextBits = [branchName, storeName].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_react_native19.View, { style: styles13.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      AuthBackBar,
      {
        onBack,
        backLabel: "Back",
        onSecondary: onChangeStore,
        secondaryLabel: "Change store"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_react_native19.View, { style: styles13.form, children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_ui4.Text, { variant: "h1", children: "Sign in" }),
      contextBits ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_ui4.Text, { variant: "muted", style: styles13.context, children: contextBits }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        import_react_native19.TextInput,
        {
          style: styles13.input,
          placeholder: "Email",
          value: email,
          onChangeText: setEmail,
          autoCapitalize: "none",
          keyboardType: "email-address",
          accessibilityLabel: "Email"
        }
      ),
      usePassword ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        import_react_native19.TextInput,
        {
          style: styles13.input,
          placeholder: "Password",
          value: password,
          onChangeText: setPassword,
          secureTextEntry: true,
          accessibilityLabel: "Password"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        import_react_native19.TextInput,
        {
          style: styles13.input,
          placeholder: "PIN",
          value: pin,
          onChangeText: setPin,
          secureTextEntry: true,
          keyboardType: "number-pad",
          maxLength: 6,
          accessibilityLabel: "PIN"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_ui4.Button, { title: loading ? "Signing in..." : "Sign in", onPress: login, disabled: loading }),
      allowPassword && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        import_ui4.Button,
        {
          title: usePassword ? "Use PIN instead" : "Use password instead",
          variant: "secondary",
          onPress: () => setUsePassword((v) => !v),
          style: styles13.secondary
        }
      )
    ] })
  ] });
}
var styles13 = import_react_native19.StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: import_ui4.theme.spacing.lg,
    paddingBottom: import_ui4.theme.spacing.lg,
    backgroundColor: import_ui4.theme.colors.background
  },
  form: {
    flex: 1,
    justifyContent: "center"
  },
  context: {
    marginBottom: import_ui4.theme.spacing.lg
  },
  input: {
    borderWidth: 1,
    borderColor: import_ui4.theme.colors.border,
    borderRadius: import_ui4.theme.borderRadius.md,
    padding: import_ui4.theme.spacing.md,
    marginBottom: import_ui4.theme.spacing.md,
    fontSize: 16,
    minHeight: 48
  },
  secondary: {
    marginTop: import_ui4.theme.spacing.md
  }
});

// src/screens/BranchSelectScreen.tsx
var import_react16 = require("react");
var import_react_native20 = require("react-native");
var import_vector_icons7 = require("@expo/vector-icons");
var import_jsx_runtime15 = require("react/jsx-runtime");
function BranchSelectScreen({
  branches,
  onSelect,
  storeName,
  onChangeStore,
  title = "Pick a branch",
  backLabel = "Change store"
}) {
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = (0, import_react16.useMemo)(() => {
    const parts = (storeName ?? "Kiosk").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [storeName]);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Screen, { style: styles14.container, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.ScrollView, { contentContainerStyle: styles14.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Entrance, { delay: 0, style: [styles14.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.orb, styles14.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.orb, styles14.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.passTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.passBrand, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "title", color: brand, style: styles14.plaqueMark, children: initials }) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.passNames, children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles14.passEyebrow, children: "STAFF \xB7 KIOSK" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "heading", color: on.primary, numberOfLines: 1, children: storeName ?? "Your shop" })
          ] })
        ] }),
        onChangeStore ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          import_react_native20.Pressable,
          {
            onPress: onChangeStore,
            accessibilityRole: "button",
            accessibilityLabel: backLabel,
            hitSlop: 8,
            style: ({ pressed }) => [
              styles14.storeChip,
              { borderColor: on.hairline, backgroundColor: on.wash },
              pressed && styles14.pressed
            ],
            children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "shelf", color: on.primary, style: styles14.storeChipText, children: backLabel })
          }
        ) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "display", color: on.primary, style: styles14.passTitle, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "body", color: on.secondary, style: styles14.passHint, children: branches.length === 1 ? "One branch is open to you." : `You can work at ${branches.length} branches \u2014 choose one to open.` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Entrance, { delay: 90, style: styles14.list, children: branches.map((item) => {
      const accent = zoneFor(item.id);
      const storeWords = new Set(
        (storeName ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
      );
      const words = item.name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
      const own = words.filter((word) => !storeWords.has(word.toLowerCase()));
      const mark = (own.length > 0 ? own : words).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
        import_react_native20.Pressable,
        {
          onPress: () => onSelect(item),
          accessibilityRole: "button",
          accessibilityLabel: `Open branch ${item.name}`,
          style: ({ pressed }) => [styles14.place, pressed && styles14.placePressed],
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.placeWell, { backgroundColor: tint(accent, 0.16) }], children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "display", color: tint(MART.ink, 0.62), style: styles14.placeMark, children: mark }) }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.placeBody, children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.placeText, children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "heading", numberOfLines: 2, children: item.name }),
                item.code ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: item.code }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: "Open this till" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.placeGo, { backgroundColor: tint(brand, 0.1) }], children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_vector_icons7.Ionicons, { name: "arrow-forward", size: 16, color: brand }) })
            ] })
          ]
        },
        item.id
      );
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Entrance, { delay: 180, style: styles14.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles14.footerText, children: "Each branch keeps its own tills, stock and takings." }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react_native20.View, { style: styles14.footerMark, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_react_native20.View, { style: [styles14.footerDot, { backgroundColor: brand }] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
      ] })
    ] })
  ] }) });
}
var EDGE2 = SPACE.xxl;
var styles14 = import_react_native20.StyleSheet.create({
  container: { paddingHorizontal: 0, paddingBottom: SPACE.lg },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE2,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: import_react_native20.Platform.select({ ios: 72, android: 40, default: 72 }),
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: "hidden",
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  glow: { position: "absolute", width: 320, height: 320, borderRadius: 999, top: -160, left: -80, opacity: 0.5 },
  orb: { position: "absolute", borderRadius: 999 },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  passTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
    marginBottom: SPACE.lg
  },
  passBrand: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.md },
  plaque: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: MART.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  plaqueMark: { letterSpacing: -0.5 },
  passNames: { flex: 1, gap: 2 },
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  place: {
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    overflow: "hidden",
    shadowColor: MART.ink,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  placePressed: { transform: [{ scale: 0.985 }], shadowOpacity: 0.16 },
  placeWell: { height: 72, alignItems: "center", justifyContent: "center" },
  placeMark: { letterSpacing: -1 },
  placeBody: { flexDirection: "row", alignItems: "center", gap: SPACE.md, padding: SPACE.md },
  placeText: { flex: 1, gap: 2 },
  placeGo: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  passRing: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  passMark: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  passMonogram: { ...TYPE.label, fontFamily: FONT.black },
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  storeChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill
  },
  storeChipText: { letterSpacing: 0.2 },
  pressed: { opacity: 0.6 },
  // The branches ride up into the header's curve as a column of place cards, each one its own object.
  list: {
    marginTop: SPACE.md,
    marginHorizontal: SPACE.lg,
    gap: SPACE.md
  },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.sm
  },
  rowPressed: { opacity: 0.55 },
  rowDot: { width: 10, height: 10, borderRadius: RADIUS.pill },
  rowBody: { flex: 1, gap: SPACE.xxs },
  // A hairline between rows, inset so it clears the dot and the chevron.
  rowRule: {
    position: "absolute",
    left: SPACE.sm + 10 + SPACE.md,
    right: SPACE.sm,
    bottom: 0,
    height: 1,
    backgroundColor: MART.border
  },
  footer: { marginTop: "auto", paddingTop: SPACE.xxl, paddingHorizontal: SPACE.lg, alignItems: "center", gap: SPACE.lg },
  footerText: { textAlign: "center", maxWidth: 300 },
  footerMark: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 }
});

// src/screens/WhiteLabelErrorScreen.tsx
var import_react_native21 = require("react-native");
var import_vector_icons8 = require("@expo/vector-icons");
var import_core10 = require("@kiosk/core");
var import_jsx_runtime16 = require("react/jsx-runtime");
function WhiteLabelErrorScreen({ message, onRetry }) {
  const displayName = (0, import_core10.getTenantDisplayName)();
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Screen, { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_react_native21.View, { style: styles15.content, children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(Entrance, { delay: 0, style: styles15.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_react_native21.View, { style: [styles15.badge, { backgroundColor: tint(MART.danger, 0.12) }], children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_vector_icons8.Ionicons, { name: "cloud-offline-outline", size: 30, color: MART.danger }) }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MartText, { variant: "title", accessibilityRole: "header", style: styles15.title, children: displayName ?? "Store unavailable" }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MartText, { variant: "body", color: MART.inkMuted, style: styles15.message, children: message }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MartButton, { label: "Try again", onPress: onRetry, style: styles15.retry })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_react_native21.View, { style: styles15.footerMark, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_react_native21.View, { style: [styles15.footerDot, { backgroundColor: MART.fallbackPrimary }] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] })
  ] }) });
}
var styles15 = import_react_native21.StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: SPACE.xl,
    gap: SPACE.xxl
  },
  card: {
    alignItems: "center",
    gap: SPACE.lg,
    padding: SPACE.xxl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { textAlign: "center" },
  message: { textAlign: "center" },
  retry: { alignSelf: "stretch", marginTop: SPACE.sm },
  footerMark: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 }
});

// src/screens/SetStockScreen.tsx
var import_react17 = require("react");
var import_react_native22 = require("react-native");
var import_vector_icons9 = require("@expo/vector-icons");
var import_core11 = require("@kiosk/core");
var import_jsx_runtime17 = require("react/jsx-runtime");
var PROBLEM_WORDS = {
  current_unknown: "The shelf count is not known for this item here, so it cannot be set.",
  pack_variant: "This is a pack. Change the stock of its main item instead."
};
function initialsOf2(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}
async function perform(api, branchId, item, plan) {
  if (plan.kind === "increase") {
    try {
      await postStockIncrease(api, (0, import_core11.stockIncreaseBody)(branchId, item.id, plan));
      return { ok: true };
    } catch (error) {
      const failure = (0, import_core11.classifyWrite)(error);
      return failure.kind === "refused" ? { ok: false, kind: "refused", words: failure.words, removed: 0, of: 1 } : { ok: false, kind: "doubt", words: "", removed: 0, of: 1 };
    }
  }
  let preview;
  try {
    preview = await fetchAllocation(api, item.id, branchId, plan.units);
  } catch {
    return { ok: false, kind: "refused", words: "Could not ask the server which batches to take from. Nothing was changed.", removed: 0, of: 0 };
  }
  const calls = (0, import_core11.planDecreaseCalls)(preview, plan.units);
  if (!calls.ok) {
    const words = calls.problem === "none" ? "The server has no batch to take this from. Nothing was changed." : `Only ${(0, import_core11.formatQty)(calls.coveredUnits)} can be taken from the item's batches. Nothing was changed.`;
    return { ok: false, kind: "refused", words, removed: 0, of: 0 };
  }
  let removed = 0;
  for (const call of calls.calls) {
    try {
      await postBatchDecrease(api, (0, import_core11.batchDecreaseBody)(call, plan.note));
      removed += 1;
    } catch (error) {
      const failure = (0, import_core11.classifyWrite)(error);
      return failure.kind === "refused" ? { ok: false, kind: "refused", words: failure.words, removed, of: calls.calls.length } : { ok: false, kind: "doubt", words: "", removed, of: calls.calls.length };
    }
  }
  return { ok: true };
}
function SetStockScreen({ api, branchId, renderScanner, itemId, inline = false }) {
  const [step, setStep] = (0, import_react17.useState)(itemId ? { name: "done", item: null, tone: "ok", words: "Loading\u2026" } : { name: "pick" });
  const [typed, setTyped] = (0, import_react17.useState)("");
  const [error, setError] = (0, import_react17.useState)(null);
  const [busy, setBusy] = (0, import_react17.useState)(false);
  const working = (0, import_react17.useRef)(false);
  const guard = (0, import_react17.useCallback)(async (job) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  const open = (0, import_react17.useCallback)(
    (id) => guard(async () => {
      setError(null);
      try {
        const item = await fetchFreshItem(api, branchId, id);
        if (!item) {
          setStep({ name: "pick" });
          setError("The server sent something the app could not read.");
          return;
        }
        setTyped("");
        setStep({ name: "edit", item });
      } catch {
        setStep({ name: "pick" });
        setError("Could not load the item. Check the signal and try again.");
      }
    }),
    [api, branchId, guard]
  );
  (0, import_react17.useEffect)(() => {
    if (itemId) void open(itemId);
  }, [itemId, open]);
  const review = (0, import_react17.useCallback)(
    (item) => guard(async () => {
      setError(null);
      const entry = (0, import_core11.parseQty)(typed, { allowZero: true });
      if (!entry.ok) {
        setError((0, import_core11.qtyProblemWords)(entry.problem));
        return;
      }
      if (!item.weighed && entry.units % import_core11.QTY_SCALE !== 0) {
        setError("This item is counted in whole numbers.");
        return;
      }
      let fresh;
      try {
        fresh = await fetchFreshItem(api, branchId, item.id);
      } catch {
        setError("Could not check the shelf. Check the signal and try again.");
        return;
      }
      if (!fresh) {
        setError("The server sent something the app could not read.");
        return;
      }
      const planned = (0, import_core11.planSetOnHand)({
        currentUnits: fresh.onHandUnits,
        targetUnits: entry.units,
        buyingCents: fresh.buyingCents,
        packageVariant: fresh.packageVariant
      });
      if (!planned.ok) {
        setError(PROBLEM_WORDS[planned.problem]);
        return;
      }
      if (planned.plan.kind === "same") {
        setStep({
          name: "done",
          item: fresh,
          tone: "ok",
          words: `The shelf already holds ${(0, import_core11.formatQty)(entry.units)}. Nothing to change.`
        });
        return;
      }
      setStep({ name: "confirm", item: fresh, targetUnits: entry.units, basisUnits: fresh.onHandUnits ?? 0, plan: planned.plan });
    }),
    [api, branchId, guard, typed]
  );
  const apply = (0, import_react17.useCallback)(
    (current) => guard(async () => {
      let fresh;
      try {
        fresh = await fetchFreshItem(api, branchId, current.item.id);
      } catch {
        setError("Could not check the shelf. Nothing was changed. Check the signal and try again.");
        return;
      }
      if (!fresh || fresh.onHandUnits !== current.basisUnits) {
        setStep({ name: "edit", item: fresh ?? current.item });
        setError(
          fresh?.onHandUnits != null ? `The shelf changed to ${(0, import_core11.formatQty)(fresh.onHandUnits)} while you were deciding. Nothing was changed. Look again.` : "Could not check the shelf. Nothing was changed."
        );
        return;
      }
      const outcome = await perform(api, branchId, current.item, current.plan);
      let after = null;
      try {
        after = await fetchFreshItem(api, branchId, current.item.id);
      } catch {
        after = null;
      }
      const now = after?.onHandUnits != null ? ` The shelf now shows ${(0, import_core11.formatQty)(after.onHandUnits)}.` : "";
      if (outcome.ok) {
        setStep({ name: "done", item: after ?? current.item, tone: "ok", words: `Done.${now}` });
        return;
      }
      if (outcome.kind === "refused") {
        const partly2 = outcome.removed > 0 ? ` ${outcome.removed} of ${outcome.of} removals went through before that.` : "";
        setStep({ name: "done", item: after ?? current.item, tone: "danger", words: `${outcome.words}${partly2}${now}` });
        return;
      }
      const partly = outcome.removed > 0 ? ` ${outcome.removed} of ${outcome.of} removals had gone through.` : "";
      setStep({
        name: "done",
        item: after ?? current.item,
        tone: "warn",
        words: `There was no clear answer from the server.${partly}${now || " Could not read the shelf."} Look at the number before changing it again: it may already have been changed.`
      });
    }),
    [api, branchId, guard]
  );
  if (step.name === "pick") {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: inline ? styles16.fillInline : styles16.fill, children: [
      !inline ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Gloss, {}) : null,
      error ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_react_native22.View, { style: styles16.banner, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(NoteLine, { tone: "danger", words: error }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
        ItemPicker,
        {
          api,
          branchId,
          onPick: (item) => void open(item.id),
          withFilters: true,
          ...renderScanner ? { renderScanner } : {}
        }
      )
    ] });
  }
  const shown = step.item;
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: inline ? styles16.fillInline : styles16.fill, children: [
    !inline ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Gloss, {}) : null,
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.ScrollView, { contentContainerStyle: styles16.body, keyboardShouldPersistTaps: "handled", children: [
      shown ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: [styles16.card, styles16.itemCard], children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_react_native22.View, { style: [styles16.mark, { backgroundColor: tint(zoneFor(shown.name), 0.18) }], children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "label", color: tint(MART.ink, 0.66), children: initialsOf2(shown.name) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: styles16.itemText, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "title", numberOfLines: 2, children: (0, import_core11.itemLabel)(shown) }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: shown.onHandUnits === null ? "Shelf count not known" : `${(0, import_core11.formatQty)(shown.onHandUnits)} on the shelf now` })
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: "Loading\u2026" }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(NoteLine, { tone: "danger", words: error }) : null,
      step.name === "edit" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles16.eyebrow, children: "HOW MANY DID YOU COUNT?" }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: styles16.countRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            import_react_native22.TextInput,
            {
              value: typed,
              onChangeText: setTyped,
              keyboardType: "decimal-pad",
              placeholder: "0",
              placeholderTextColor: MART.inkQuiet,
              returnKeyType: "done",
              autoFocus: true,
              selectTextOnFocus: true,
              onSubmitEditing: () => void review(step.item),
              accessibilityLabel: "How many did you count",
              style: styles16.field
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            PressableScale,
            {
              onPress: () => void review(step.item),
              disabled: busy || typed.trim() === "",
              scaleTo: 0.94,
              style: [styles16.tick, (busy || typed.trim() === "") && styles16.tickOff],
              accessibilityRole: "button",
              accessibilityLabel: "Save this count",
              children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_vector_icons9.Ionicons, { name: "checkmark", size: 26, color: MART.paper })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: step.item.weighed ? "Fractions are allowed for this item." : "Whole numbers only." }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          PressableScale,
          {
            onPress: () => {
              setError(null);
              setStep({ name: "pick" });
            },
            scaleTo: 0.98,
            style: styles16.quietBtn,
            accessibilityRole: "button",
            accessibilityLabel: "Pick another item",
            children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles16.quietLabel, children: "Pick another item" })
          }
        )
      ] }) : null,
      step.name === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: styles16.changeCard, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles16.eyebrow, children: step.plan.kind === "increase" ? "COUNTED MORE THAN THE SYSTEM HELD" : "COUNTED LESS THAN THE SYSTEM HELD" }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: styles16.changeRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "display", color: step.plan.kind === "increase" ? MART.success : MART.warning, children: `${step.plan.kind === "increase" ? "+" : "\u2212"}${(0, import_core11.formatQty)(step.plan.units)}` }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: styles16.changeFrom, children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: `${(0, import_core11.formatQty)(step.basisUnits)} now` }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: `${(0, import_core11.formatQty)(step.targetUnits)} after` })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles16.note, children: "This changes the shop's stock records. The change is checked against the shelf once more just before it is sent." }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartButton, { label: busy ? "Working\u2026" : "Confirm", onPress: () => void apply(step), disabled: busy, busy }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          PressableScale,
          {
            onPress: () => setStep({ name: "edit", item: step.item }),
            disabled: busy,
            scaleTo: 0.98,
            style: [styles16.quietBtn, busy && styles16.dim],
            accessibilityRole: "button",
            accessibilityLabel: "Back",
            children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles16.quietLabel, children: "Back" })
          }
        )
      ] }) : null,
      step.name === "done" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
        step.item ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(NoteLine, { tone: step.tone, words: step.words }) : null,
        step.item ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
          MartButton,
          {
            label: "Set another item",
            onPress: () => {
              setError(null);
              setStep({ name: "pick" });
            }
          }
        ) : null
      ] }) : null
    ] })
  ] });
}
function NoteLine({ tone, words }) {
  const colour = tone === "danger" ? MART.danger : tone === "warn" ? MART.warning : tone === "ok" ? MART.success : MART.inkMuted;
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_react_native22.View, { style: [styles16.noteLine, { backgroundColor: tint(colour, 0.08) }], children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
      import_vector_icons9.Ionicons,
      {
        name: tone === "danger" ? "alert-circle" : tone === "warn" ? "warning" : tone === "ok" ? "checkmark-circle" : "information-circle",
        size: 15,
        color: colour
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MartText, { variant: "meta", color: colour, style: { flex: 1 }, children: words })
  ] });
}
var styles16 = import_react_native22.StyleSheet.create({
  noteLine: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: RADIUS.md },
  changeCard: {
    gap: 6,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border
  },
  changeRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md },
  changeFrom: { flex: 1, gap: 1, paddingBottom: 6 },
  itemCard: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  itemText: { flex: 1, gap: 2 },
  amountRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  countRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  tick: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.fallbackPrimary
  },
  tickOff: { backgroundColor: tint(MART.fallbackPrimary, 0.35) },
  mark: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  fill: { flex: 1, backgroundColor: MART.paper },
  fillInline: { flex: 1 },
  body: { padding: GUTTER, gap: SPACE.md, paddingBottom: 116 },
  banner: { paddingHorizontal: GUTTER, paddingTop: SPACE.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    padding: SPACE.md,
    gap: SPACE.sm,
    ...SHADOW.card
  },
  eyebrow: { letterSpacing: 1.1 },
  field: {
    flex: 1,
    minHeight: 56,
    textAlign: "center",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    color: MART.ink,
    fontFamily: FONT.regular,
    fontSize: 17,
    fontWeight: WEIGHT.regular
  },
  note: { marginBottom: SPACE.xs },
  quietBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg
  },
  quietLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  dim: { opacity: 0.5 }
});

// src/screens/SpoilsScreen.tsx
var import_react18 = require("react");
var import_react_native23 = require("react-native");
var import_core12 = require("@kiosk/core");
var import_ui5 = require("@kiosk/ui");
var import_jsx_runtime18 = require("react/jsx-runtime");
var CODEC = {
  initial: null,
  parse: (text, now) => (0, import_core12.decodeSpoils)(text, now),
  serialize: (list) => (0, import_core12.encodeSpoils)(list)
};
var ADD_WORDS = {
  bad_quantity: "Enter how many, as a number above zero.",
  too_big: "That is more than one line of the list can hold.",
  too_many: "The list is full. Write these off first.",
  busy: "That item is being written off right now."
};
function SpoilsScreen({ api, tenantId, branchId, ownerId, renderScanner, addItem }) {
  const keeper = (0, import_react18.useMemo)(() => (0, import_core12.tenantKeeper)("spoils", tenantId, CODEC), [tenantId]);
  const kept = useKept(keeper);
  const owner = (0, import_react18.useMemo)(() => ({ ownerId, branchId }), [ownerId, branchId]);
  const [view, setView] = (0, import_react18.useState)("list");
  const [prompt, setPrompt] = (0, import_react18.useState)(null);
  const [typed, setTyped] = (0, import_react18.useState)("");
  const [note, setNote] = (0, import_react18.useState)(null);
  const [confirming, setConfirming] = (0, import_react18.useState)(false);
  const [choose, setChoose] = (0, import_react18.useState)(false);
  const [busy, setBusy] = (0, import_react18.useState)(false);
  const working = (0, import_react18.useRef)(false);
  const mounted = (0, import_react18.useRef)(true);
  (0, import_react18.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  (0, import_react18.useEffect)(() => {
    if (!kept.ready) return;
    keeper.update((list2) => list2 && (list2.ownerId !== ownerId || list2.branchId !== branchId) ? (0, import_core12.claimSpoils)(list2, owner, Date.now()) : list2);
  }, [kept.ready, keeper, ownerId, branchId, owner]);
  (0, import_react18.useEffect)(() => {
    if (kept.ready && addItem) {
      setPrompt({ kind: "add", item: addItem });
      setTyped("1");
      setView("add");
    }
  }, [kept.ready, addItem]);
  const list = kept.value && kept.value.ownerId === ownerId && kept.value.branchId === branchId ? kept.value : kept.value ? { ...(0, import_core12.emptySpoils)(owner, 0), inFlight: kept.value.inFlight } : null;
  const lines = list?.lines ?? [];
  const flight = list?.inFlight ?? null;
  const reason = list?.reason ?? "SPOILAGE";
  const guard = (0, import_react18.useCallback)(async (job) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);
  const edit = (0, import_react18.useCallback)(
    (change) => {
      keeper.update((current) => change((0, import_core12.claimSpoils)(current, owner, Date.now())));
    },
    [keeper, owner]
  );
  const submitPrompt = (0, import_react18.useCallback)(() => {
    if (!prompt) return;
    const entry = (0, import_core12.parseQty)(typed);
    if (!entry.ok) {
      setNote({ tone: "danger", text: (0, import_core12.qtyProblemWords)(entry.problem) });
      return;
    }
    const weighed = prompt.kind === "add" ? prompt.item.weighed : prompt.line.weighed;
    if (!weighed && entry.units % import_core12.QTY_SCALE !== 0) {
      setNote({ tone: "danger", text: "This item is counted in whole numbers." });
      return;
    }
    if (prompt.kind === "add") {
      const base = (0, import_core12.claimSpoils)(keeper.get(), owner, Date.now());
      const added = (0, import_core12.addSpoil)(base, { id: prompt.item.id, name: (0, import_core12.itemLabel)(prompt.item), weighed: prompt.item.weighed, buyingCents: prompt.item.buyingCents, sellingCents: prompt.item.sellingCents }, entry.units, Date.now());
      if (!added.ok) {
        setNote({ tone: "danger", text: ADD_WORDS[added.why] });
        return;
      }
      keeper.update(() => added.list);
    } else {
      edit((current) => (0, import_core12.setSpoilUnits)(current, prompt.line.itemId, entry.units, Date.now()));
    }
    setNote(null);
    setPrompt(null);
    setTyped("");
    setView("list");
  }, [prompt, typed, keeper, owner, edit]);
  const sendAll = (0, import_react18.useCallback)(
    () => guard(async () => {
      setConfirming(false);
      setNote(null);
      let sent = 0;
      for (let turn = 0; turn < 200; turn += 1) {
        if (!mounted.current) return;
        const current = keeper.get();
        const line = current ? (0, import_core12.nextSpoil)(current) : null;
        if (!current || !line) break;
        let baseline;
        try {
          const history = await fetchHistory(api, line.itemId);
          if (!history) {
            setNote({ tone: "danger", text: `${line.name}: the server sent a history the app could not read. Nothing was written off for this item.` });
            return;
          }
          baseline = [...(0, import_core12.spoilOperations)(history.entries, branchId).keys()];
        } catch {
          setNote({ tone: "danger", text: `${line.name}: could not check the item first. Check the signal. Nothing was written off for this item.` });
          return;
        }
        if (!mounted.current) return;
        if (!(0, import_core12.beginSending)(keeper, line, baseline, Date.now())) {
          setNote({ tone: "warn", text: "A write-off is already being sent. Wait for it to finish, then look at the list again." });
          return;
        }
        const started = keeper.get()?.inFlight ?? null;
        if (!started) return;
        const landed = await keeper.saved();
        if (!landed) {
          keeper.update((latest) => latest ? (0, import_core12.spoilNotDone)(latest, Date.now()) : latest);
          setNote({ tone: "danger", text: "Could not save on this phone, so nothing was sent. Free some space and try again." });
          return;
        }
        try {
          await postWastage(api, (0, import_core12.wastageBody)({ branchId: started.branchId, itemId: started.itemId, units: started.units, unitCostCents: started.unitCostCents, reason: started.reason }));
        } catch (error) {
          const failure = (0, import_core12.classifyWrite)(error);
          if (failure.kind === "refused") {
            keeper.update((latest) => latest ? (0, import_core12.spoilNotDone)(latest, Date.now()) : latest);
            setNote({ tone: "danger", text: `${started.name}: ${failure.words} Nothing was written off for this item.` });
          } else {
            setNote({ tone: "warn", text: `${started.name}: there was no clear answer. It may or may not have been written off. Check it below before doing anything else.` });
          }
          return;
        }
        keeper.update((latest) => latest ? (0, import_core12.spoilDone)(latest, Date.now()) : latest);
        sent += 1;
      }
      if (sent > 0) setNote({ tone: "ok", text: sent === 1 ? "Written off." : `${sent} items written off.` });
    }),
    [api, branchId, guard, keeper]
  );
  const checkNow = (0, import_react18.useCallback)(
    () => guard(async () => {
      const doubt = keeper.get()?.inFlight;
      if (!doubt) return;
      let history = null;
      try {
        history = await fetchHistory(api, doubt.itemId);
      } catch {
        history = null;
      }
      const verdict = (0, import_core12.spoilVerdict)(history, doubt, Date.now());
      setChoose(verdict === "not_seen" || verdict === "too_busy");
      if (verdict === "done") {
        keeper.update((latest) => latest ? (0, import_core12.spoilDone)(latest, Date.now()) : latest);
        setNote({ tone: "ok", text: `${doubt.name}: the write-off went through.` });
      } else if (verdict === "too_soon") {
        setNote({ tone: "warn", text: "It is not in the history yet. Give the server a minute, then check again." });
      } else if (verdict === "unknown") {
        setNote({ tone: "danger", text: "Could not read the item history. Check the signal and try again." });
      } else if (verdict === "too_busy") {
        setNote({ tone: "warn", text: "This item has had a lot of stock activity since, more than the phone can look back over, so it cannot tell whether the write-off went through. Look at the item's history in the back office, then choose below." });
      } else {
        setNote({ tone: "warn", text: "The write-off is not in the history. Choose what to do below." });
      }
    }),
    [api, guard, keeper]
  );
  if (kept.failed) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.fill, children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Gloss, {}),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.body, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_ui5.Banner, { tone: "danger", children: "Could not read what is saved on this phone. Nothing was changed." }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartButton, { label: "Try again", onPress: kept.retry })
      ] })
    ] });
  }
  if (!kept.ready) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.fill, children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Gloss, {}),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles17.body, children: "Reading what is saved on this phone\u2026" })
    ] });
  }
  if (view === "add") {
    if (prompt) {
      const name = prompt.kind === "add" ? (0, import_core12.itemLabel)(prompt.item) : prompt.line.name;
      const weighed = prompt.kind === "add" ? prompt.item.weighed : prompt.line.weighed;
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.fill, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Gloss, {}),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.ScrollView, { contentContainerStyle: styles17.body, keyboardShouldPersistTaps: "handled", children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_react_native23.View, { style: styles17.card, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "title", children: name }) }),
          note ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_ui5.Banner, { tone: note.tone, children: note.text }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.card, children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, children: "How many are being written off?" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              import_react_native23.TextInput,
              {
                value: typed,
                onChangeText: setTyped,
                keyboardType: "decimal-pad",
                placeholder: "0",
                placeholderTextColor: MART.inkQuiet,
                style: styles17.field
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: weighed ? "This item can be counted in fractions." : "Whole numbers only." })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartButton, { label: prompt.kind === "add" ? "Add to the list" : "Save", onPress: submitPrompt }),
          prompt.kind === "edit" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            PressableScale,
            {
              onPress: () => {
                edit((current) => (0, import_core12.removeSpoil)(current, prompt.line.itemId, Date.now()));
                setPrompt(null);
                setView("list");
              },
              scaleTo: 0.98,
              style: styles17.dangerBtn,
              accessibilityRole: "button",
              accessibilityLabel: "Take it off the list",
              children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.danger, style: styles17.actionLabel, children: "Take it off the list" })
            }
          ) : null,
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            PressableScale,
            {
              onPress: () => {
                setPrompt(null);
                setNote(null);
                setView("list");
              },
              scaleTo: 0.98,
              style: styles17.quietBtn,
              accessibilityRole: "button",
              accessibilityLabel: "Cancel",
              children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Cancel" })
            }
          )
        ] })
      ] });
    }
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.fill, children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Gloss, {}),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.pad, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(PressableScale, { onPress: () => setView("list"), scaleTo: 0.98, style: styles17.quietBtn, accessibilityRole: "button", accessibilityLabel: "Back to the list", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Back to the list" }) }),
        note ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_ui5.Banner, { tone: note.tone, style: styles17.gap, children: note.text }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        ItemPicker,
        {
          api,
          branchId,
          onPick: (item) => {
            if (item.packageVariant) {
              setNote({ tone: "danger", text: `${(0, import_core12.itemLabel)(item)} is a pack. Write off its main item instead.` });
              return;
            }
            setNote(null);
            setTyped("1");
            setPrompt({ kind: "add", item });
          },
          ...renderScanner ? { renderScanner } : {}
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.fill, children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Gloss, {}),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.ScrollView, { contentContainerStyle: styles17.body, keyboardShouldPersistTaps: "handled", children: [
      note ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_ui5.Banner, { tone: note.tone, children: note.text }) : null,
      flight ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "title", children: "Not sure this went through" }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "body", color: MART.inkMuted, children: `Writing off ${(0, import_core12.formatQty)(flight.units)} of ${flight.name} got no clear answer. It may already have been taken off the shelf. Check before doing anything else.` }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartButton, { label: busy ? "Checking\u2026" : "Check now", onPress: () => void checkNow(), disabled: busy, busy }),
        choose ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            PressableScale,
            {
              onPress: () => {
                keeper.update((latest) => latest ? (0, import_core12.spoilNotDone)(latest, Date.now()) : latest);
                setChoose(false);
                setNote(null);
              },
              scaleTo: 0.98,
              style: styles17.quietBtn,
              accessibilityRole: "button",
              accessibilityLabel: "It did not go through: put it back on the list",
              children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "It did not go through: put it back on the list" })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
            PressableScale,
            {
              onPress: () => {
                keeper.update((latest) => latest ? (0, import_core12.spoilDone)(latest, Date.now()) : latest);
                setChoose(false);
                setNote(null);
              },
              scaleTo: 0.98,
              style: styles17.quietBtn,
              accessibilityRole: "button",
              accessibilityLabel: "It did go through: take it off the list",
              children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "It did go through: take it off the list" })
            }
          )
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles17.eyebrow, children: "WHY WRITE OFF?" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_react_native23.View, { style: styles17.chips, children: import_core12.SPOIL_REASONS.map((option) => {
        const on = reason === option.key;
        const off = busy || !!flight;
        return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          import_react_native23.Pressable,
          {
            onPress: () => edit((current) => (0, import_core12.setReason)(current, option.key, Date.now())),
            disabled: off,
            accessibilityRole: "button",
            accessibilityState: { selected: on, disabled: off },
            style: [styles17.chip, on && styles17.chipOn, off && styles17.dim],
            children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              MartText,
              {
                variant: "label",
                color: on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted,
                style: [styles17.chipLabel, on && styles17.chipLabelOn],
                children: option.label
              }
            )
          },
          option.key
        );
      }) }),
      lines.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.empty, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "title", style: styles17.emptyTitle, children: "Nothing on the list yet" }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles17.emptyCopy, children: "Add spoiled, expired or broken stock, then write it off." })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_react_native23.View, { style: styles17.list, children: lines.map((line) => {
        const locked = busy || !!flight && flight.itemId === line.itemId;
        return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
          import_react_native23.Pressable,
          {
            disabled: locked,
            onPress: () => {
              setNote(null);
              setTyped((0, import_core12.formatQty)(line.units).replace(/,/g, ""));
              setPrompt({ kind: "edit", line });
              setView("add");
            },
            accessibilityRole: "button",
            accessibilityLabel: `${line.name}, ${(0, import_core12.formatQty)(line.units)}`,
            style: [styles17.row, locked && styles17.dim],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.rowLeft, children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "heading", numberOfLines: 2, children: line.name }),
                flight && flight.itemId === line.itemId ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "meta", color: MART.warning, children: "Being written off" }) : null
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "price", children: (0, import_core12.formatQty)(line.units) })
            ]
          },
          line.itemId
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        PressableScale,
        {
          onPress: () => {
            setNote(null);
            setPrompt(null);
            setView("add");
          },
          disabled: busy,
          scaleTo: 0.98,
          style: [styles17.quietBtn, styles17.quietFilled, busy && styles17.dim],
          accessibilityRole: "button",
          accessibilityLabel: "Add an item",
          children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.ink, style: styles17.actionLabel, children: "Add an item" })
        }
      ),
      confirming ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_react_native23.View, { style: styles17.card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "body", color: MART.inkMuted, children: `Write off ${lines.length} ${lines.length === 1 ? "item" : "items"} as \u201C${import_core12.SPOIL_REASONS.find((option) => option.key === reason)?.label ?? ""}\u201D? This lowers the shop's stock records and cannot be undone from the phone.` }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartButton, { label: busy ? "Working\u2026" : "Yes, write them off", onPress: () => void sendAll(), disabled: busy, busy }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          PressableScale,
          {
            onPress: () => setConfirming(false),
            disabled: busy,
            scaleTo: 0.98,
            style: [styles17.quietBtn, busy && styles17.dim],
            accessibilityRole: "button",
            accessibilityLabel: "Not yet",
            children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Not yet" })
          }
        )
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        MartButton,
        {
          label: `Write off ${lines.length || ""}`.trim(),
          onPress: () => setConfirming(true),
          disabled: busy || lines.length === 0 || !!flight
        }
      ),
      lines.length > 0 && !flight ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        PressableScale,
        {
          onPress: () => edit((current) => (0, import_core12.clearSpoils)(current, Date.now())),
          disabled: busy,
          scaleTo: 0.98,
          style: [styles17.quietBtn, busy && styles17.dim],
          accessibilityRole: "button",
          accessibilityLabel: "Clear the list",
          children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MartText, { variant: "label", color: MART.danger, style: styles17.actionLabel, children: "Clear the list" })
        }
      ) : null
    ] })
  ] });
}
var styles17 = import_react_native23.StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  body: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xxxl },
  pad: { padding: SPACE.md, gap: SPACE.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    padding: SPACE.md,
    gap: SPACE.sm,
    ...SHADOW.card
  },
  gap: { marginTop: SPACE.sm },
  eyebrow: { letterSpacing: 1.1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.paperSunken
  },
  chipOn: { backgroundColor: MART.fallbackPrimary },
  chipLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  chipLabelOn: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  list: { gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    minHeight: 56,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    ...SHADOW.card
  },
  rowLeft: { flex: 1, gap: 2 },
  empty: { alignItems: "center", paddingVertical: SPACE.xl, gap: SPACE.sm },
  emptyTitle: { textAlign: "center" },
  emptyCopy: { textAlign: "center", maxWidth: 280 },
  field: {
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    color: MART.ink,
    fontFamily: FONT.regular,
    fontSize: 17,
    fontWeight: WEIGHT.regular
  },
  quietBtn: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg
  },
  quietFilled: {
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken
  },
  dangerBtn: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.dangerSurface
  },
  actionLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  dim: { opacity: 0.5 }
});

// src/screens/StaffShell.tsx
var import_react21 = require("react");
var import_react_native28 = require("react-native");
var import_expo_font = require("expo-font");
var import_poppins = require("@expo-google-fonts/poppins");
var import_schibsted_grotesk = require("@expo-google-fonts/schibsted-grotesk");
var import_plus_jakarta_sans = require("@expo-google-fonts/plus-jakarta-sans");
var import_ui6 = require("@kiosk/ui");
var import_core19 = require("@kiosk/core");

// src/lib/entry.ts
var import_core13 = require("@kiosk/core");

// src/lib/with-timeout.ts
function withTimeout2(work, ms, fallback) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// src/lib/entry.ts
var ENTRY_TIMEOUT_MS = 2e4;
var SECONDARY_TIMEOUT_MS = 8e3;
function notifyOwnerAboutTill(questions, till, branchId) {
  if (!questions.askTillAccess) return;
  if (till !== "not_registered" && till !== "removed") return;
  void questions.askTillAccess(branchId).catch(() => void 0);
}
async function askTill(questions, branchId, limitMs) {
  if (!questions.checkTill) return "unknown";
  try {
    return await withTimeout2(questions.checkTill(branchId), limitMs, "unknown");
  } catch {
    return "unknown";
  }
}
async function shiftsAreOff(questions, limitMs) {
  if (!questions.loadShiftsDisabled) return false;
  try {
    return await withTimeout2(questions.loadShiftsDisabled(), limitMs, false) === true;
  } catch {
    return false;
  }
}
async function branchNameFor(questions, branchId, limitMs) {
  try {
    const branches = await withTimeout2(questions.loadBranches(), limitMs, []);
    return branches.find((branch) => branch.id === branchId)?.name?.trim() || null;
  } catch {
    return null;
  }
}
async function settle(questions, user, branchId, knownName, limitMs) {
  const [till, branchName, shiftsDisabled] = await Promise.all([
    askTill(questions, branchId, limitMs),
    knownName !== void 0 ? Promise.resolve(knownName) : branchNameFor(questions, branchId, limitMs),
    shiftsAreOff(questions, limitMs)
  ]);
  if (till === "removed") {
    notifyOwnerAboutTill(questions, till, branchId);
    return { name: "removed", user, branchId };
  }
  if (till === "shop_off") return { name: "shop_off" };
  notifyOwnerAboutTill(questions, till, branchId);
  return { name: "ready", user, branchId, branchName, shiftsDisabled };
}
async function begin(questions, limitMs) {
  let user;
  try {
    user = await questions.loadMe();
  } catch (error) {
    if ((0, import_core13.isApiError)(error)) {
      if (error.status === 401) return { name: "signed_out" };
      if (error.status === 423) return { name: "shop_off" };
    }
    return { name: "check_failed" };
  }
  if (!user.roleKey) {
    return { name: "no_role", user };
  }
  if (!(0, import_core13.fitsApp)(questions.app, user.permissions)) {
    return { name: "wrong_app", user, fits: (0, import_core13.appsThatFit)(user.permissions) };
  }
  if (user.branchId) {
    return settle(questions, user, user.branchId, void 0, limitMs);
  }
  if ((0, import_core13.isBranchLockedRole)(user.roleKey)) {
    return { name: "no_branch_assigned", user };
  }
  let branches;
  try {
    branches = await questions.loadBranches();
  } catch {
    return { name: "branches_failed", user };
  }
  const first = branches[0];
  if (!first) return { name: "no_branch", user };
  if (branches.length === 1) return settle(questions, user, first.id, first.name?.trim() || null, limitMs);
  return { name: "pick_branch", user, branches };
}
function enterApp(questions, limits = {}) {
  return withTimeout2(
    begin(questions, limits.secondaryTimeoutMs ?? SECONDARY_TIMEOUT_MS),
    limits.timeoutMs ?? ENTRY_TIMEOUT_MS,
    { name: "check_failed" }
  );
}
function enterBranch(questions, user, branch, limits = {}) {
  return withTimeout2(
    settle(questions, user, branch.id, branch.name?.trim() || null, limits.secondaryTimeoutMs ?? SECONDARY_TIMEOUT_MS),
    limits.timeoutMs ?? ENTRY_TIMEOUT_MS,
    { name: "check_failed" }
  );
}

// src/lib/notices.ts
var import_core14 = require("@kiosk/core");
function shopWebUrl(host, path = "/") {
  const clean = (0, import_core14.plainHost)(host);
  if (!clean) return void 0;
  const safePath = /^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/.test(path) ? path : "/";
  return `https://${clean}${safePath}`;
}
function joinNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
var TRY_AGAIN = { id: "retry", label: "Try again", primary: true };
var SIGN_OUT = { id: "sign_out", label: "Sign out" };
function describeEntryNotice(stage, context) {
  const shop = context.shopName?.trim() || "this shop";
  const host = (0, import_core14.plainHost)(context.host) ?? void 0;
  switch (stage.name) {
    case "check_failed":
      return {
        title: "Couldn't check your account",
        body: "Check your connection, then try again.",
        actions: [TRY_AGAIN, SIGN_OUT]
      };
    case "branches_failed":
      return {
        title: "Couldn't load your branches",
        body: "Check your connection, then try again.",
        actions: [TRY_AGAIN, SIGN_OUT]
      };
    case "shop_off":
      return {
        title: `${shop} is switched off right now`,
        body: "Ask the owner to contact support.",
        actions: [TRY_AGAIN, SIGN_OUT]
      };
    case "no_role":
      return {
        title: "Your account has no role yet",
        body: "Ask your manager to give your account a role, then sign in again.",
        actions: [{ ...SIGN_OUT, primary: true }]
      };
    case "no_branch_assigned": {
      const step = (0, import_core14.describeSetup)({ requirement: "branch", hint: "assign" }, { web: host });
      return { title: step.title, body: step.body, actions: [{ ...SIGN_OUT, primary: true }] };
    }
    case "no_branch": {
      const step = (0, import_core14.describeSetup)({ requirement: "branch", hint: "none" }, { web: host });
      const webUrl = shopWebUrl(host);
      return {
        title: step.title,
        body: step.body,
        actions: [
          ...webUrl ? [{ id: "open_web", label: `Open ${host}` }] : [],
          { id: "retry", label: "Check again", primary: true },
          SIGN_OUT
        ],
        ...webUrl ? { webUrl } : {}
      };
    }
    case "wrong_app": {
      const home = (0, import_core14.webHomeForRole)(stage.user.roleKey);
      const others = stage.fits.filter((app) => app !== context.app).map((app) => import_core14.APP_NAMES[app]);
      const lines = [
        `The ${import_core14.APP_NAMES[context.app]} app is for ${import_core14.APP_JOBS[context.app]}.`,
        `Your role, ${stage.user.roleName}, works in ${home.where} on the web.`
      ];
      if (others.length > 0) {
        lines.push(`You can use the ${joinNames(others)} app${others.length === 1 ? "" : "s"} instead.`);
      }
      const webUrl = shopWebUrl(host, home.path);
      return {
        title: "This app isn't for your account",
        body: lines.join(" "),
        actions: [...webUrl ? [{ id: "open_web", label: `Open ${host}`, primary: true }] : [], SIGN_OUT],
        ...webUrl ? { webUrl } : {}
      };
    }
    case "removed": {
      const unsent = context.unsentCount ?? 0;
      return {
        title: `This phone was removed from ${shop}`,
        body: [
          "It is no longer a till here.",
          unsent > 0 ? `${unsent === 1 ? "1 sale was" : `${unsent} sales were`} not sent and ${unsent === 1 ? "is" : "are"} still on this phone. Save ${unsent === 1 ? "it" : "them"} before you go.` : "",
          context.pairingEnabled ? "To use it as a till again, pair it with a new code from your manager." : "Ask your manager if it should work as a till again."
        ].filter(Boolean).join(" "),
        actions: [
          ...unsent > 0 ? [{ id: "save_unsent", label: unsent === 1 ? "Save the unsent sale" : "Save the unsent sales", primary: true }] : [],
          ...context.pairingEnabled ? [{ id: "pair", label: "Pair this phone again", primary: unsent === 0 }] : [],
          SIGN_OUT
        ]
      };
    }
  }
}

// src/lib/shell-guards.ts
function sessionLossMatters(stage) {
  return stage !== "signin" && stage !== "pairing" && stage !== "signing_out";
}
function holdsWork(stage) {
  return stage === "ready" || stage === "checking" || stage === "pick_branch";
}
function mayFollowShopLink(stage, link, here) {
  if (!holdsWork(stage) || !here || !link) return true;
  const slug = link.slug?.trim().toLowerCase();
  const host = link.host?.trim().toLowerCase();
  const sameSlug = !!slug && slug === here.slug.trim().toLowerCase();
  const sameHost = !!host && host === here.host.trim().toLowerCase();
  return sameSlug || sameHost;
}
function judgeSignIn(answerShop, now) {
  if (!answerShop || answerShop !== now.shop) return "drop";
  return now.stage === "signin" ? "use" : "end";
}
function wantsEntryAnswer(started, now) {
  return started.attempt === now.attempt && started.shop === now.shop;
}
function endsSessionOn(stage) {
  return stage === "wrong_app" || stage === "removed" || stage === "no_role" || stage === "no_branch_assigned";
}

// src/screens/NoticeScreen.tsx
var import_react_native24 = require("react-native");
var import_vector_icons10 = require("@expo/vector-icons");
var import_jsx_runtime19 = require("react/jsx-runtime");
function NoticeScreen({ notice, onAction, busy = false }) {
  const brand = MART.fallbackPrimary;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Screen, { children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_react_native24.ScrollView, { contentContainerStyle: styles18.content, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(Entrance, { delay: 0, style: styles18.card, children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_react_native24.View, { style: [styles18.badge, { backgroundColor: tint(brand, 0.12) }], children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_vector_icons10.Ionicons, { name: "information-circle-outline", size: 30, color: brand }) }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MartText, { variant: "title", accessibilityRole: "header", style: styles18.title, children: notice.title }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MartText, { variant: "body", color: MART.inkMuted, style: styles18.body, children: notice.body }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_react_native24.View, { style: styles18.actions, children: notice.actions.map((action) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
        MartButton,
        {
          label: action.label,
          kind: action.primary ? "primary" : "quiet",
          onPress: () => onAction(action.id),
          disabled: busy,
          style: styles18.action
        },
        action.id
      )) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(Entrance, { delay: 120, style: styles18.footerMark, children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_react_native24.View, { style: [styles18.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] })
  ] }) });
}
var styles18 = import_react_native24.StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xxxl,
    gap: SPACE.xxl
  },
  card: {
    alignItems: "center",
    gap: SPACE.lg,
    padding: SPACE.xxl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { textAlign: "center" },
  body: { textAlign: "center" },
  actions: { alignSelf: "stretch", gap: SPACE.sm, marginTop: SPACE.sm },
  action: {},
  footerMark: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 }
});

// src/screens/PairScreen.tsx
var import_react19 = require("react");
var import_react_native25 = require("react-native");
var import_vector_icons11 = require("@expo/vector-icons");
var import_core16 = require("@kiosk/core");

// src/lib/pair-copy.ts
var import_core15 = require("@kiosk/core");
function describeCodeProblem(parse) {
  switch (parse.kind) {
    case "incomplete":
      return "Enter the whole code from your manager.";
    case "too_long":
      return "That code is too long. Check it and try again.";
    case "invalid_characters":
      return "Codes use letters and numbers, never I, L, O, 0 or 1.";
  }
}
function describePairingFailure(result) {
  switch (result.kind) {
    case "not_found":
      return "We couldn't find that code. Check it, or ask your manager for a new one.";
    case "expired":
      return "That code has expired. Ask your manager for a new one.";
    case "used":
      return "That code was already used. If you just paired this phone, go back and sign in. If not, ask your manager for a new one.";
    case "refused":
      return "That code didn't work. Check it, or ask your manager for a new one.";
    case "rate_limited":
      return result.retryAfterSec ? `Too many tries. Try again in ${result.retryAfterSec} ${result.retryAfterSec === 1 ? "second" : "seconds"}.` : "Too many tries. Try again in a minute.";
    case "offline":
      return "Couldn't reach the server. Check your internet and try again.";
  }
}
function describeWrongShop(codeShopName, openShopName) {
  return `This code is for ${codeShopName}, not ${openShopName}. Ask your manager for a code for ${openShopName}.`;
}
function isSameShop(codeShop, open, codeShopId) {
  const theirs = codeShopId?.trim();
  const ours = open.businessId?.trim();
  if (theirs && ours && !(0, import_core15.isProvisionalId)(ours)) return theirs === ours;
  const named = codeShop.trim().toLowerCase();
  return named.length > 0 && (named === open.host.trim().toLowerCase() || named === open.slug.trim().toLowerCase());
}

// src/screens/PairScreen.tsx
var import_jsx_runtime20 = require("react/jsx-runtime");
function PairScreen({ baseURL, tenant, renderScanner, onPaired, onCancel }) {
  const [step, setStep] = (0, import_react19.useState)("enter");
  const [text, setText] = (0, import_react19.useState)("");
  const [code, setCode] = (0, import_react19.useState)("");
  const [preview, setPreview] = (0, import_react19.useState)(null);
  const [message, setMessage] = (0, import_react19.useState)(null);
  const [busy, setBusy] = (0, import_react19.useState)(false);
  const mounted = (0, import_react19.useRef)(true);
  const sending = (0, import_react19.useRef)(false);
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = (0, import_react19.useMemo)(() => {
    const parts = tenant.displayName.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [tenant.displayName]);
  (0, import_react19.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const look = async (candidate) => {
    if (busy || sending.current) return;
    const parsed = (0, import_core16.parsePairingCode)(candidate);
    if (parsed.kind !== "ok") {
      setMessage(describeCodeProblem(parsed));
      setStep("enter");
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage(null);
    const found = await (0, import_core16.previewPairing)(parsed.code, baseURL);
    sending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (found.kind !== "found") {
      setMessage(describePairingFailure(found));
      setStep("enter");
      return;
    }
    if (!isSameShop(found.preview.shop, tenant, found.preview.shopId)) {
      setMessage(describeWrongShop(found.preview.shopName, tenant.displayName));
      setStep("enter");
      return;
    }
    setCode(parsed.code);
    setPreview(found.preview);
    setStep("confirm");
  };
  const scanned = (scan) => {
    setStep("enter");
    const fromQr = (0, import_core16.parsePairingScan)(scan);
    if (!fromQr) {
      setMessage("That QR code isn't a pairing code. Scan the one your manager made for this phone.");
      return;
    }
    setText(fromQr);
    void look(fromQr);
  };
  const pairNow = async () => {
    if (!preview || busy || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const deviceKey = await (0, import_core16.getOrCreateTillDeviceId)(tenant.businessId);
      if (!deviceKey.trim()) {
        sending.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setMessage("Couldn't set this phone up as a till. Close the app, open it again and try again.");
        return;
      }
      const result = await (0, import_core16.redeemPairing)(code, deviceKey, baseURL);
      sending.current = false;
      if (!mounted.current) return;
      if (result.kind !== "paired") {
        setBusy(false);
        setMessage(describePairingFailure(result));
        setStep(result.kind === "offline" || result.kind === "rate_limited" ? "confirm" : "enter");
        return;
      }
      await (0, import_core16.rememberTillRegistered)(tenant.businessId, preview.branchId).catch(() => void 0);
      onPaired(preview.branchName);
    } catch {
      sending.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setMessage("Couldn't pair this phone. Try again.");
    }
  };
  if (step === "scan" && renderScanner) {
    return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: styles19.fill, children: renderScanner({ onScanned: scanned, onCancel: () => setStep("enter") }) });
  }
  const back = step === "confirm" ? () => setStep("enter") : onCancel;
  const backLabel = step === "confirm" ? "Back" : "Cancel";
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Screen, { style: styles19.container, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.ScrollView, { contentContainerStyle: styles19.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Entrance, { delay: 0, style: [styles19.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.orb, styles19.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.orb, styles19.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.passTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.passBrand, children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.passRing, { borderColor: on.hairline }], children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.passMark, { backgroundColor: on.primary }], children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { style: [styles19.passMonogram, { color: brand }], children: initials }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles19.passStore, children: tenant.displayName.toUpperCase() })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
          import_react_native25.Pressable,
          {
            onPress: back,
            accessibilityRole: "button",
            accessibilityLabel: backLabel,
            hitSlop: 8,
            style: ({ pressed }) => [
              styles19.storeChip,
              { borderColor: on.hairline, backgroundColor: on.wash },
              pressed && styles19.pressed
            ],
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_vector_icons11.Ionicons, { name: "chevron-back", size: 14, color: on.primary }),
              /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "shelf", color: on.primary, style: styles19.storeChipText, children: backLabel })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "display", color: on.primary, style: styles19.passTitle, children: "Pair this phone" }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "body", color: on.secondary, style: styles19.passHint, children: step === "confirm" ? "Check the details, then confirm." : "Turn this phone into a till for the shop." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(Entrance, { delay: 90, style: styles19.formBody, children: [
      step === "confirm" && preview ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.summary, accessibilityLabel: "Pairing details", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.summaryBadge, { backgroundColor: tint(brand, 0.12) }], children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_vector_icons11.Ionicons, { name: "phone-portrait-outline", size: 22, color: brand }) }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, children: "This phone will be a till at" }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "title", children: preview.shopName }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.summaryRows, children: [
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SummaryRow, { icon: "git-branch-outline", label: "Branch", value: preview.branchName }),
          /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SummaryRow, { icon: "person-outline", label: "You sign in as", value: preview.roleName }),
          preview.tillName ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SummaryRow, { icon: "pricetag-outline", label: "Till name", value: preview.tillName }) : null
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        Field,
        {
          on: "tile",
          label: "Pairing code",
          icon: "key-outline",
          placeholder: "Enter the code",
          value: text,
          onChangeText: (value) => {
            setText(value);
            if (message) setMessage(null);
          },
          hint: `Your manager made this code${renderScanner ? ", or scan their QR code below" : " for this phone"}.`,
          autoCapitalize: "characters",
          autoCorrect: false,
          autoComplete: "off",
          maxLength: 24,
          returnKeyType: "go",
          onSubmitEditing: () => void look(text),
          editable: !busy,
          style: styles19.codeInput,
          accessibilityLabel: "Pairing code"
        }
      ),
      message ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.problemBox, accessibilityLiveRegion: "polite", children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_vector_icons11.Ionicons, { name: "alert-circle-outline", size: 18, color: MART.danger }),
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "body", color: MART.danger, style: styles19.problemText, children: message })
      ] }) : null,
      step === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        MartButton,
        {
          label: busy ? "Pairing\u2026" : "Pair this phone",
          busy,
          onPress: () => void pairNow(),
          disabled: busy,
          style: styles19.submit
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_jsx_runtime20.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
          MartButton,
          {
            label: busy ? "Checking\u2026" : "Continue",
            busy,
            onPress: () => void look(text),
            disabled: busy || text.trim().length === 0,
            style: styles19.submit
          }
        ),
        renderScanner ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartButton, { label: "Scan QR code", kind: "quiet", onPress: () => setStep("scan"), disabled: busy }) : null
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Entrance, { delay: 180, style: styles19.footer, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.footerMark, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_react_native25.View, { style: [styles19.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] }) })
  ] }) });
}
function SummaryRow({
  icon,
  label,
  value
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_react_native25.View, { style: styles19.summaryRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_vector_icons11.Ionicons, { name: icon, size: 18, color: MART.inkQuiet }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles19.summaryRowLabel, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MartText, { variant: "label", numberOfLines: 1, style: styles19.summaryRowValue, children: value })
  ] });
}
var EDGE3 = SPACE.xxl;
var styles19 = import_react_native25.StyleSheet.create({
  fill: { flex: 1 },
  container: { paddingHorizontal: 0, paddingBottom: SPACE.lg },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE3,
    paddingTop: 72,
    // clears the status bar / Dynamic Island without a SafeAreaProvider dependency
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: "hidden",
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  glow: { position: "absolute", width: 320, height: 320, borderRadius: 999, top: -160, left: -80, opacity: 0.5 },
  orb: { position: "absolute", borderRadius: 999 },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  passTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
    marginBottom: SPACE.lg
  },
  passBrand: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACE.md },
  passRing: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  passMark: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  passMonogram: { ...TYPE.label, fontFamily: FONT.black },
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  storeChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xxs,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill
  },
  storeChipText: { letterSpacing: 0.2 },
  pressed: { opacity: 0.6 },
  formBody: {
    gap: SPACE.lg,
    marginTop: -32,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  codeInput: { letterSpacing: 2 },
  summary: {
    gap: SPACE.sm,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paper
  },
  summaryBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.xs
  },
  summaryRows: { gap: SPACE.sm, marginTop: SPACE.sm },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  summaryRowLabel: { width: 112 },
  summaryRowValue: { flex: 1, textAlign: "right" },
  problemBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface
  },
  problemText: { flex: 1 },
  submit: {
    marginTop: SPACE.xs,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  footer: { marginTop: "auto", paddingTop: SPACE.xxl, alignItems: "center" },
  footerMark: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 }
});

// src/screens/SignInScreen.tsx
var import_react20 = require("react");
var import_react_native27 = require("react-native");

// src/lib/till-request.ts
var import_react_native26 = require("react-native");
function tillRequestMessage(ask) {
  const where = [ask.shopName, ask.branchName].filter(Boolean).join(" \xB7 ");
  return [
    `Hello \u2014 this phone is not registered as a till${where ? ` at ${where}` : ""}.`,
    `${ask.reason}`,
    "Please register it in Kiosk \u2192 Business \u2192 Tills, or send me a pairing code so I can add it here."
  ].join("\n\n");
}
function whatsappLink(ask) {
  const text = encodeURIComponent(tillRequestMessage(ask));
  const digits = (ask.ownerPhone ?? "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
function emailLink(ask) {
  const subject = encodeURIComponent(`Register this till${ask.shopName ? ` \u2014 ${ask.shopName}` : ""}`);
  const body = encodeURIComponent(tillRequestMessage(ask));
  return `mailto:?subject=${subject}&body=${body}`;
}
async function askOwner(channel, ask) {
  const url = channel === "whatsapp" ? whatsappLink(ask) : emailLink(ask);
  try {
    await import_react_native26.Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// src/screens/SignInScreen.tsx
var import_vector_icons12 = require("@expo/vector-icons");
var import_core18 = require("@kiosk/core");

// src/lib/sign-in-form.ts
var PIN_MIN_LENGTH = 4;
var PIN_MAX_LENGTH = 6;
var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function cleanPin(text) {
  return text.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH);
}
function cleanEmail(text) {
  return text.trim().toLowerCase();
}
function isEmailComplete(text) {
  const email = cleanEmail(text);
  return email.length <= 191 && EMAIL_SHAPE.test(email);
}
function canSubmitSignIn(input) {
  if (!isEmailComplete(input.email)) return false;
  if (input.method === "pin") {
    return input.pin.length >= PIN_MIN_LENGTH && input.pin.length <= PIN_MAX_LENGTH && /^\d+$/.test(input.pin);
  }
  return input.password.length > 0;
}

// src/lib/sign-in-problems.ts
var import_core17 = require("@kiosk/core");
var LOCK_HINT_AFTER = 3;
var NO_WRONG_TRIES = { email: "", count: 0 };
function countWrongTries(before, email, kind) {
  if (kind !== "wrong_credentials") return before;
  return { email, count: (before.email === email ? before.count : 0) + 1 };
}
function isNetworkFailure(error) {
  if (error instanceof TypeError) return true;
  return error instanceof Error && error.name === "AbortError";
}
function describeSignInProblem(error, context) {
  const shop = (0, import_core17.cleanDisplayText)(context.shopName, 60) || "this shop";
  if (!(0, import_core17.isApiError)(error)) {
    if (isNetworkFailure(error)) {
      return { kind: "no_connection", message: "No connection. Check your internet and try again.", clearSecret: false };
    }
    return { kind: "unknown", message: "Couldn't sign in. Try again.", clearSecret: false };
  }
  const { status, code } = error;
  if (code === "till_not_registered") {
    return {
      kind: "not_approved_till",
      message: `This phone isn't approved as a till at ${shop} yet. Your manager has been asked to approve it. Try again after they do.`,
      clearSecret: false,
      ...context.pairingEnabled ? { action: "pair" } : {}
    };
  }
  if (code === void 0 && status === 403 && context.method === "pin") {
    return {
      kind: "not_approved_till",
      message: `Your sign-in was refused. This phone may not be approved as a till at ${shop} yet (if so, your manager has been asked to approve it), or your account may not be active yet. Ask your manager if it keeps happening.`,
      clearSecret: false,
      ...context.pairingEnabled ? { action: "pair" } : {}
    };
  }
  if (code === "email_not_verified" || code === void 0 && status === 403 && context.method === "password") {
    return {
      kind: "email_not_verified",
      message: "Your email isn't verified yet. Open the link we sent you, then try again.",
      clearSecret: false,
      action: "resend_verification"
    };
  }
  if (status === 401) {
    const locked = (context.failedTries ?? 0) >= LOCK_HINT_AFTER;
    const said = context.method === "pin" ? "That email and PIN don't match." : "That email and password don't match.";
    return {
      kind: "wrong_credentials",
      message: locked ? `${said} If it keeps happening, your account may be locked: ask your manager.` : `${said} Try again.`,
      clearSecret: true
    };
  }
  if (status === 423) {
    return {
      kind: "shop_off",
      message: `${shop} is switched off right now. Ask the owner to contact support.`,
      clearSecret: false
    };
  }
  if (status === 429) {
    return { kind: "too_many", message: "Too many tries. Wait a minute, then try again.", clearSecret: false };
  }
  if (status >= 500 || status === 408) {
    return { kind: "server_down", message: "The server isn't answering right now. Try again in a moment.", clearSecret: false };
  }
  if (status === 400) {
    const said = (0, import_core17.cleanDisplayText)(error.message, 160);
    if (said) {
      return { kind: "rejected", message: said, clearSecret: false };
    }
  }
  return { kind: "unknown", message: "Couldn't sign in. Try again.", clearSecret: false };
}

// src/screens/SignInScreen.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
function SignInScreen({
  baseURL,
  shop,
  shopName,
  allowPassword = false,
  pairingEnabled = false,
  knownStaff,
  notice,
  onSignedIn,
  onForgetStaff,
  onPair,
  onChangeStore
}) {
  const [email, setEmail] = (0, import_react20.useState)("");
  const [pin, setPin] = (0, import_react20.useState)("");
  const [password, setPassword] = (0, import_react20.useState)("");
  const [method, setMethod] = (0, import_react20.useState)("password");
  const [busy, setBusy] = (0, import_react20.useState)(false);
  const [problem, setProblem] = (0, import_react20.useState)(null);
  const [resent, setResent] = (0, import_react20.useState)(null);
  const secretInput = (0, import_react20.useRef)(null);
  const mounted = (0, import_react20.useRef)(true);
  const sending = (0, import_react20.useRef)(false);
  const wrongTries = (0, import_react20.useRef)(NO_WRONG_TRIES);
  (0, import_react20.useEffect)(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const typed = cleanEmail(email);
  const known = knownStaff.find((person) => person.email === typed);
  const greeting = (0, import_react20.useMemo)(() => {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, []);
  const firstName = known?.name?.trim().split(/\s+/)[0] ?? null;
  const ask = {
    shopName: shopName ?? shop,
    branchName: null,
    reason: problem?.kind === "not_approved_till" ? problem.message : "This phone cannot sell until it is registered as a till."
  };
  const ready = canSubmitSignIn({ method, email, pin, password });
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = (0, import_react20.useMemo)(() => {
    const parts = (shopName ?? "").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [shopName]);
  const submit = async () => {
    if (!ready || busy || sending.current) return;
    sending.current = true;
    const startedFor = shop;
    setBusy(true);
    setProblem(null);
    setResent(null);
    try {
      const result = method === "pin" ? await (0, import_core18.loginWithPin)(baseURL, typed, pin) : await (0, import_core18.loginWithPassword)(baseURL, typed, password);
      onSignedIn({ user: result.user, email: typed, shop: startedFor });
    } catch (error) {
      if (!mounted.current) return;
      const context = { method, shopName: shopName ?? void 0, pairingEnabled };
      wrongTries.current = countWrongTries(wrongTries.current, typed, describeSignInProblem(error, context).kind);
      const found = describeSignInProblem(error, {
        ...context,
        failedTries: wrongTries.current.email === typed ? wrongTries.current.count : 0
      });
      setProblem(found);
      if (found.clearSecret) {
        setPin("");
        setPassword("");
        secretInput.current?.focus();
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const resend = async () => {
    if (!isEmailComplete(typed) || busy) return;
    setBusy(true);
    try {
      await (0, import_core18.resendVerificationEmail)(baseURL, typed);
      if (mounted.current) setResent("Sent. Check your email for the link.");
    } catch {
      if (mounted.current) setResent("Couldn't send it. Try again in a minute.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const pick = (person) => {
    setEmail(person.email);
    setProblem(null);
    setResent(null);
    setTimeout(() => secretInput.current?.focus(), 0);
  };
  const notYou = () => {
    if (!known) return;
    onForgetStaff?.(known.email);
    setEmail("");
    setPin("");
    setPassword("");
    setProblem(null);
  };
  const switchMethod = () => {
    setMethod((current) => current === "pin" ? "password" : "pin");
    setPin("");
    setPassword("");
    setProblem(null);
    setResent(null);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Screen, { style: styles20.container, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.ScrollView, { contentContainerStyle: styles20.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Entrance, { delay: 0, style: [styles20.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.orb, styles20.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.orb, styles20.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: styles20.lacquer, pointerEvents: "none" }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.passTop, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.passBrand, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "title", color: brand, style: styles20.plaqueMark, children: initials }) }),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.passNames, children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles20.passEyebrow, children: (shopName ?? "YOUR SHOP").toUpperCase() }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "heading", color: on.primary, children: "Staff sign-in" })
          ] })
        ] }),
        onChangeStore ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
          import_react_native27.Pressable,
          {
            onPress: onChangeStore,
            accessibilityRole: "button",
            accessibilityLabel: "Change store",
            hitSlop: 8,
            style: ({ pressed }) => [
              styles20.storeChip,
              { borderColor: on.hairline, backgroundColor: on.wash },
              pressed && styles20.pressed
            ],
            children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "shelf", color: on.primary, style: styles20.storeChipText, children: "Change store" })
          }
        ) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "display", color: on.primary, style: styles20.passTitle, children: firstName ? `${greeting}, ${firstName}.` : `${greeting}.` }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "body", color: on.secondary, style: styles20.passHint, children: known ? "Your PIN and the shelf are ready. Your shift picks up where it left off." : "Sign in with your email and PIN or password." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.formBody, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(CardGloss, { radius: RADIUS.xl }),
      notice ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: styles20.noticeBox, accessibilityLiveRegion: "polite", children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "body", color: MART.inkMuted, children: notice }) }) : null,
      knownStaff.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.people, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "label", color: MART.inkMuted, style: styles20.peopleLabel, children: "Who's signing in?" }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles20.peopleRow, children: knownStaff.map((person) => {
          const on2 = typed === person.email;
          const parts = (person.name || person.email).trim().split(/\s+/).filter(Boolean);
          const mark = (parts[0]?.[0] ?? "?").toUpperCase();
          return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
            import_react_native27.Pressable,
            {
              onPress: () => pick(person),
              accessibilityRole: "button",
              accessibilityLabel: `Sign in as ${person.name || person.email}`,
              accessibilityState: { selected: on2 },
              style: ({ pressed }) => [styles20.person, on2 && styles20.personOn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.personMark, on2 && { backgroundColor: brand }], children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "label", color: on2 ? onFill(brand).primary : MART.ink, children: mark }) }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.personText, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "label", numberOfLines: 1, children: person.name || person.email }),
                  person.name ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: person.email }) : null
                ] })
              ]
            },
            person.email
          );
        }) })
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Entrance, { delay: 90, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Field,
        {
          on: "tile",
          label: "Email",
          icon: "mail-outline",
          placeholder: "you@shop.co.ke",
          value: email,
          onChangeText: (text) => {
            setEmail(text);
            if (problem) setProblem(null);
          },
          autoCapitalize: "none",
          autoCorrect: false,
          autoComplete: "email",
          keyboardType: "email-address",
          textContentType: "username",
          returnKeyType: "next",
          onSubmitEditing: () => secretInput.current?.focus(),
          editable: !busy,
          accessibilityLabel: "Email"
        }
      ) }),
      known ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.Pressable, { onPress: notYou, accessibilityRole: "button", accessibilityLabel: "Not you? Remove from this phone", hitSlop: 8, style: styles20.notYou, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "meta", style: styles20.link, children: "Not you? Remove from this phone" }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Entrance, { delay: 150, children: method === "pin" ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Field,
        {
          ref: secretInput,
          on: "tile",
          label: "PIN",
          icon: "keypad-outline",
          placeholder: "\u2022\u2022\u2022\u2022",
          value: pin,
          onChangeText: (text) => {
            setPin(cleanPin(text));
            if (problem) setProblem(null);
          },
          secureTextEntry: true,
          keyboardType: "number-pad",
          maxLength: 6,
          autoComplete: "off",
          importantForAutofill: "no",
          returnKeyType: "go",
          onSubmitEditing: submit,
          editable: !busy,
          accessibilityLabel: "PIN"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        Field,
        {
          ref: secretInput,
          on: "tile",
          label: "Password",
          icon: "lock-closed-outline",
          placeholder: "Your password",
          value: password,
          onChangeText: (text) => {
            setPassword(text);
            if (problem) setProblem(null);
          },
          secureTextEntry: true,
          autoCapitalize: "none",
          autoCorrect: false,
          autoComplete: "off",
          textContentType: "none",
          importantForAutofill: "no",
          returnKeyType: "go",
          onSubmitEditing: submit,
          editable: !busy,
          accessibilityLabel: "Password"
        }
      ) }),
      problem ? /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { accessibilityLiveRegion: "polite", style: styles20.problemBox, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "body", color: MART.danger, children: problem.message }),
        problem.kind === "not_approved_till" ? /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.askRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
            import_react_native27.Pressable,
            {
              onPress: () => void askOwner("whatsapp", ask),
              accessibilityRole: "button",
              accessibilityLabel: "Ask the owner on WhatsApp",
              style: ({ pressed }) => [styles20.askBtn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_vector_icons12.Ionicons, { name: "logo-whatsapp", size: 16, color: MART.fallbackPrimary }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "label", color: MART.fallbackPrimary, children: "WhatsApp the owner" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
            import_react_native27.Pressable,
            {
              onPress: () => void askOwner("email", ask),
              accessibilityRole: "button",
              accessibilityLabel: "Ask the owner by email",
              style: ({ pressed }) => [styles20.askBtn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_vector_icons12.Ionicons, { name: "mail-outline", size: 16, color: MART.fallbackPrimary }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "label", color: MART.fallbackPrimary, children: "Email" })
              ]
            }
          )
        ] }) : null,
        problem.action === "resend_verification" ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartButton, { label: "Send the link again", kind: "quiet", onPress: resend, disabled: busy, style: styles20.problemAction }) : null,
        problem.action === "pair" && onPair ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartButton, { label: "Pair this phone", kind: "quiet", onPress: onPair, disabled: busy, style: styles20.problemAction }) : null,
        resent ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles20.resent, children: resent }) : null
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(Entrance, { delay: 210, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartButton, { label: busy ? "Signing in\u2026" : "Sign in", busy, onPress: submit, disabled: !ready || busy, style: styles20.submit }) }),
      allowPassword ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
        MartButton,
        {
          label: method === "pin" ? "Use password instead" : "Use PIN instead",
          kind: "quiet",
          onPress: switchMethod,
          disabled: busy,
          style: styles20.secondary
        }
      ) : null,
      pairingEnabled && onPair && problem?.action !== "pair" ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.Pressable, { onPress: onPair, accessibilityRole: "button", accessibilityLabel: "Pair this phone with a code", hitSlop: 8, style: styles20.pairLink, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "meta", style: styles20.link, children: "New phone? Pair it with a code" }) }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(Entrance, { delay: 270, style: styles20.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "meta", color: MART.inkQuiet, style: styles20.footerText, children: "Trouble signing in? Ask the shop owner to reset your PIN." }),
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_react_native27.View, { style: styles20.footerMark, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react_native27.View, { style: [styles20.footerDot, { backgroundColor: brand }] }),
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
      ] })
    ] })
  ] }) });
}
var EDGE4 = SPACE.xxl;
var styles20 = import_react_native27.StyleSheet.create({
  // No page padding: the header and card span full width, each setting its own EDGE inset so their
  // content shares one left line.
  container: {
    paddingHorizontal: 0,
    paddingBottom: SPACE.lg
  },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE4,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: import_react_native27.Platform.select({ ios: 72, android: 40, default: 72 }),
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: "hidden",
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -160,
    left: -80,
    opacity: 0.5
  },
  orb: {
    position: "absolute",
    borderRadius: 999
  },
  orbOne: {
    width: 180,
    height: 180,
    top: -70,
    right: -50
  },
  orbTwo: {
    width: 110,
    height: 110,
    top: 40,
    right: 60
  },
  plaque: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: MART.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  plaqueMark: { letterSpacing: -0.5 },
  passNames: { flex: 1, gap: 2 },
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  people: { gap: SPACE.sm },
  peopleLabel: { paddingHorizontal: 2 },
  peopleRow: { gap: SPACE.sm, paddingRight: SPACE.lg },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated
  },
  personOn: { borderColor: MART.fallbackPrimary, backgroundColor: tint(MART.fallbackPrimary, 0.06) },
  personMark: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MART.paperSunken
  },
  personText: { maxWidth: 150 },
  passRing: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  passTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACE.md,
    marginBottom: SPACE.lg
  },
  // The monogram + shop name as one group, so the chip can sit opposite them.
  passBrand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md
  },
  // A quiet outlined capsule on the green: present, but it never competes with "Welcome back".
  storeChip: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill
  },
  storeChipText: { letterSpacing: 0.2 },
  passMark: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  passMonogram: {
    ...TYPE.label,
    fontFamily: FONT.black,
    fontWeight: WEIGHT.black
  },
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  // A white card that rides up into the header's curve, so the screen reads as one piece.
  lacquer: {
    position: "absolute",
    top: "-40%",
    left: "-30%",
    right: "-30%",
    height: "85%",
    backgroundColor: "rgba(255,255,255,0.07)",
    transform: [{ rotate: "-9deg" }]
  },
  formBody: {
    // card inset 16 + inner padding 12 = 28, aligning card content with the header's EDGE (28).
    gap: SPACE.lg,
    marginTop: -32,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3
  },
  noticeBox: { gap: SPACE.sm },
  askRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  askBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.08)
  },
  notice: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
  chip: {
    minHeight: 48,
    maxWidth: "100%",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated
  },
  chipSelected: { borderColor: MART.fallbackPrimary, borderWidth: 1.5 },
  pressed: { opacity: 0.6 },
  notYou: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginTop: -SPACE.xs },
  link: { color: MART.info, fontFamily: TYPE.label.fontFamily },
  problemBox: { gap: SPACE.sm },
  problemAction: { marginTop: SPACE.xs },
  resent: {},
  submit: {
    marginTop: SPACE.sm,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  secondary: {},
  pairLink: { alignSelf: "center", minHeight: 48, justifyContent: "center", marginTop: SPACE.sm },
  footer: {
    marginTop: "auto",
    paddingTop: SPACE.xxl,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
    gap: SPACE.lg
  },
  footerText: {
    textAlign: "center",
    maxWidth: 300
  },
  footerMark: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm
  },
  footerDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  }
});

// src/screens/StaffShell.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
var SESSION_ENDED = "You were signed out. Sign in again.";
function openShop() {
  return useAuthStore.getState().tenant?.slug;
}
function StaffShell({ app, baseURL, allowPassword = false, isTill = false, exportUnsent, onRemoved, renderScanner, children }) {
  const [fontsLoaded, fontsError] = (0, import_expo_font.useFonts)({
    SandeMore_400Regular: require_SandeMore_Regular(),
    SandeMore_500Medium: require_SandeMore_Medium(),
    SandeMore_700Bold: require_SandeMore_Bold(),
    SandeMore_800ExtraBold: require_SandeMore_ExtraBold(),
    DMSans_400Regular: require_DMSans_Regular(),
    DMSans_500Medium: require_DMSans_Medium(),
    DMSans_600SemiBold: require_DMSans_SemiBold(),
    DMSans_700Bold: require_DMSans_Bold(),
    PlusJakartaSans_400Regular: import_plus_jakarta_sans.PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium: import_plus_jakarta_sans.PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold: import_plus_jakarta_sans.PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold: import_plus_jakarta_sans.PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold: import_plus_jakarta_sans.PlusJakartaSans_800ExtraBold,
    SchibstedGrotesk_600SemiBold: import_schibsted_grotesk.SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold: import_schibsted_grotesk.SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold: import_schibsted_grotesk.SchibstedGrotesk_800ExtraBold,
    Poppins_400Regular: import_poppins.Poppins_400Regular,
    Poppins_500Medium: import_poppins.Poppins_500Medium,
    Poppins_600SemiBold: import_poppins.Poppins_600SemiBold,
    Poppins_700Bold: import_poppins.Poppins_700Bold,
    Poppins_800ExtraBold: import_poppins.Poppins_800ExtraBold
  });
  const { tenant, setTenant, setBranch, setEmail, setAuthenticated, reset } = useAuthStore();
  const stageRef = (0, import_react21.useRef)({ name: "signin" });
  const { phase, setPhase, bootError, retry } = useStaffBoot(
    baseURL,
    setTenant,
    (url) => mayFollowShopLink(stageRef.current.name, (0, import_core19.parseTenantDeepLink)(url), useAuthStore.getState().tenant)
  );
  const [stage, setStage] = (0, import_react21.useState)({ name: "signin" });
  const [banner, setBanner] = (0, import_react21.useState)(null);
  const [known, setKnown] = (0, import_react21.useState)([]);
  const [platform, setPlatform] = (0, import_react21.useState)(null);
  const [unsent, setUnsent] = (0, import_react21.useState)(0);
  const [busy, setBusy] = (0, import_react21.useState)(false);
  const attempt = (0, import_react21.useRef)(0);
  const typedEmail = (0, import_react21.useRef)("");
  const go = (0, import_react21.useCallback)((next) => {
    stageRef.current = next;
    setStage(next);
  }, []);
  const canChangeStore = !(0, import_core19.getEmbeddedTenantSlug)();
  const pairingEnabled = platform?.pairingEnabled === true;
  const tenantId = tenant?.businessId ?? null;
  const tenantSlug = tenant?.slug ?? null;
  const shopName = tenant?.displayName ?? (0, import_core19.getTenantDisplayName)() ?? void 0;
  const appTitle = `${shopName ?? "Kiosk"} ${import_core19.APP_NAMES[app]}`;
  const api = (0, import_react21.useMemo)(
    () => (0, import_core19.createApiClient)({
      baseURL,
      onAuthFailed: () => {
        if (!sessionLossMatters(stageRef.current.name)) return;
        attempt.current += 1;
        setAuthenticated(false);
        setBanner(SESSION_ENDED);
        go({ name: "signin" });
      }
    }),
    [baseURL, go, setAuthenticated]
  );
  const coldStart = (0, import_react21.useRef)(true);
  (0, import_react21.useEffect)(() => {
    if (!tenantSlug || !coldStart.current) return;
    coldStart.current = false;
    void (0, import_core19.endSession)(baseURL).catch(() => void 0);
  }, [tenantSlug, baseURL]);
  (0, import_react21.useEffect)(() => {
    let alive = true;
    void (0, import_core19.fetchPlatformConfig)(baseURL).then((config) => {
      if (alive) setPlatform(config);
    });
    return () => {
      alive = false;
    };
  }, [baseURL]);
  (0, import_react21.useEffect)(() => {
    attempt.current += 1;
    go({ name: "signin" });
    setBanner(null);
    setAuthenticated(false);
    setKnown([]);
    setUnsent(0);
  }, [tenantSlug, go, setAuthenticated]);
  (0, import_react21.useEffect)(() => {
    if (!tenantId || stage.name !== "signin") return;
    let alive = true;
    void (0, import_core19.loadKnownStaff)(tenantId).then((people) => {
      if (alive) setKnown(people);
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);
  (0, import_react21.useEffect)(() => {
    if (!tenantId || stage.name !== "removed") return;
    let alive = true;
    void (0, import_core19.getUnsentSummary)(tenantId).then((summary) => {
      if (alive) setUnsent(summary.total);
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);
  const questions = (0, import_react21.useCallback)(
    (id) => ({
      app,
      loadMe: () => (0, import_core19.fetchMe)(api),
      loadBranches: () => (0, import_core19.fetchBranches)(baseURL),
      ...isTill ? {
        checkTill: (branchId) => (0, import_core19.checkTillRegistration)(api, id, branchId),
        askTillAccess: async (branchId) => {
          const deviceKey = await (0, import_core19.getOrCreateTillDeviceId)(id);
          if (!deviceKey) return;
          await (0, import_core19.requestTillAccess)(api, { branchId, deviceKey });
        },
        // A shop that runs without shifts says so in its public settings, which need no sign-in.
        loadShiftsDisabled: () => (0, import_core19.fetchShiftsDisabled)(baseURL, useAuthStore.getState().tenant?.host)
      } : {}
    }),
    [api, app, baseURL, isTill]
  );
  const arrive = (0, import_react21.useCallback)(
    (next) => {
      if (next.name === "signed_out") {
        setAuthenticated(false);
        setBanner(SESSION_ENDED);
        go({ name: "signin" });
        return;
      }
      const id = useAuthStore.getState().tenant?.businessId;
      if (next.name === "ready") {
        const email = next.user.email || typedEmail.current;
        setBranch({ id: next.branchId, name: next.branchName ?? "" });
        setEmail(email);
        setAuthenticated(true);
        if (id && email) void (0, import_core19.rememberStaff)({ email, name: next.user.name }, id).catch(() => void 0);
      } else {
        setAuthenticated(false);
        if (next.name === "removed" && id) {
          void (0, import_core19.clearKnownStaff)(id).catch(() => void 0);
          if (onRemoved) void Promise.resolve(onRemoved(id)).catch(() => void 0);
        }
        if (endsSessionOn(next.name)) void (0, import_core19.endSession)(baseURL).catch(() => void 0);
      }
      go(next);
    },
    [baseURL, go, onRemoved, setAuthenticated, setBranch, setEmail]
  );
  const enter = (0, import_react21.useCallback)(async () => {
    const shop = useAuthStore.getState().tenant;
    if (!shop) return;
    const mine = ++attempt.current;
    go({ name: "checking" });
    const next = await enterApp(questions(shop.businessId));
    if (wantsEntryAnswer({ attempt: mine, shop: shop.slug }, { attempt: attempt.current, shop: openShop() })) arrive(next);
  }, [arrive, go, questions]);
  const choose = (0, import_react21.useCallback)(
    async (user, branch) => {
      const shop = useAuthStore.getState().tenant;
      if (!shop) return;
      const mine = ++attempt.current;
      go({ name: "checking" });
      const next = await enterBranch(questions(shop.businessId), user, branch);
      if (wantsEntryAnswer({ attempt: mine, shop: shop.slug }, { attempt: attempt.current, shop: openShop() })) arrive(next);
    },
    [arrive, go, questions]
  );
  const leaving = (0, import_react21.useRef)(false);
  const signOut = (0, import_react21.useCallback)(async () => {
    if (leaving.current) return false;
    leaving.current = true;
    try {
      if (!await confirmSignOut(useAuthStore.getState().tenant?.displayName)) return false;
      attempt.current += 1;
      const id = useAuthStore.getState().tenant?.businessId;
      const wasRemoved = stageRef.current.name === "removed";
      go({ name: "signing_out" });
      try {
        await (0, import_core19.endSession)(baseURL);
      } catch {
      }
      if (wasRemoved && id) await (0, import_core19.forgetTillRegistered)(id).catch(() => void 0);
      setAuthenticated(false);
      setBanner(null);
      go({ name: "signin" });
      return true;
    } finally {
      leaving.current = false;
    }
  }, [baseURL, go, setAuthenticated]);
  const changeStore = (0, import_react21.useCallback)(async () => {
    if (!canChangeStore) return;
    if (!await leaveStore(useAuthStore.getState().tenant?.displayName)) return;
    attempt.current += 1;
    reset();
    go({ name: "signin" });
    setPhase("tenant");
  }, [canChangeStore, go, reset, setPhase]);
  const signedIn = (0, import_react21.useCallback)(
    (details) => {
      const verdict = judgeSignIn(details.shop, { shop: openShop(), stage: stageRef.current.name });
      if (verdict === "drop") return;
      if (verdict === "end") {
        void (0, import_core19.endSession)(baseURL).catch(() => void 0);
        return;
      }
      typedEmail.current = details.email;
      setBanner(null);
      void enter();
    },
    [baseURL, enter]
  );
  const forget = (0, import_react21.useCallback)(
    (email) => {
      setKnown((people) => (0, import_core19.removeKnownStaff)(people, email));
      if (tenantId) void (0, import_core19.forgetKnownStaff)(email, tenantId).catch(() => void 0);
    },
    [tenantId]
  );
  if (!fontsLoaded && !fontsError || phase === "loading") return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_react_native28.View, { style: styles21.blank });
  if (phase === "error" && bootError) return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(WhiteLabelErrorScreen, { message: bootError, onRetry: retry });
  if (phase === "tenant" || !tenant) {
    return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      TenantEntryScreen,
      {
        baseURL,
        appTitle,
        onTenantResolved: (resolved) => {
          setTenant(resolved);
          setPhase("branch");
        }
      }
    );
  }
  switch (stage.name) {
    case "checking":
    case "signing_out":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_react_native28.View, { style: styles21.center, accessibilityLiveRegion: "polite", children: [
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_react_native28.ActivityIndicator, { color: import_ui6.theme.colors.primary }),
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_ui6.Text, { variant: "muted", style: styles21.checking, children: stage.name === "checking" ? "Checking your account..." : "Signing out..." })
      ] });
    case "signin":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
        SignInScreen,
        {
          baseURL,
          shop: tenantSlug ?? "",
          shopName,
          allowPassword,
          pairingEnabled,
          knownStaff: known,
          notice: banner,
          onSignedIn: signedIn,
          onForgetStaff: forget,
          onPair: pairingEnabled ? () => go({ name: "pairing" }) : void 0,
          onChangeStore: canChangeStore ? () => void changeStore() : void 0
        },
        tenantSlug ?? "none"
      );
    case "pairing":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
        PairScreen,
        {
          baseURL,
          tenant,
          renderScanner,
          onCancel: () => go({ name: "signin" }),
          onPaired: (branchName) => {
            setBanner(`This phone is now a till at ${branchName}. Sign in with your PIN.`);
            go({ name: "signin" });
          }
        }
      );
    case "pick_branch": {
      const { user, branches } = stage;
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
        BranchSelectScreen,
        {
          branches,
          onSelect: (branch) => void choose(user, branch),
          storeName: shopName,
          title: "Which branch are you at?",
          backLabel: "Sign out",
          onChangeStore: () => void signOut()
        }
      );
    }
    case "ready":
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_jsx_runtime22.Fragment, { children: children({
        api,
        tenant,
        user: stage.user,
        branchId: stage.branchId,
        branchName: stage.branchName,
        shiftsDisabled: (0, import_core19.shiftsAreDisabled)(tenant) || stage.shiftsDisabled,
        signOut
      }) });
    default: {
      const noticeStage = stage;
      const notice = describeEntryNotice(noticeStage, {
        app,
        shopName,
        host: tenant.host,
        pairingEnabled,
        unsentCount: unsent
      });
      const actions = notice.actions.filter((action) => action.id !== "save_unsent" || exportUnsent !== void 0);
      const act = async (id) => {
        switch (id) {
          case "retry":
            await enter();
            return;
          case "sign_out":
            await signOut();
            return;
          case "open_web":
            if (notice.webUrl) await import_react_native28.Linking.openURL(notice.webUrl).catch(() => void 0);
            return;
          case "save_unsent":
            setBusy(true);
            try {
              await exportUnsent?.();
            } catch {
              import_react_native28.Alert.alert("Could not save the sales", "They are still on this phone. Try again.");
            } finally {
              setBusy(false);
            }
            return;
          case "pair":
            go({ name: "pairing" });
            return;
        }
      };
      return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(NoticeScreen, { notice: { ...notice, actions }, onAction: (id) => void act(id), busy });
    }
  }
}
var styles21 = import_react_native28.StyleSheet.create({
  blank: { flex: 1, backgroundColor: MART.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: import_ui6.theme.colors.background },
  checking: { marginTop: import_ui6.theme.spacing.md }
});

// src/index.ts
var DM_SANS = {
  DMSans_400Regular: require_DMSans_Regular(),
  DMSans_500Medium: require_DMSans_Medium(),
  DMSans_600SemiBold: require_DMSans_SemiBold(),
  DMSans_700Bold: require_DMSans_Bold()
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BRAND,
  BranchSelectScreen,
  CardGloss,
  DM_SANS,
  ELEVATION,
  FONT,
  FlyToCart,
  GUTTER,
  Gloss,
  HAIRLINE,
  HISTORY_LIMIT,
  HeroMetric,
  ItemPicker,
  JAKARTA,
  MART,
  MOTION,
  MartButton,
  MartText,
  MiniTile,
  ON_BRAND,
  PinLoginScreen,
  PressableScale,
  RADIUS,
  SETTLE,
  SHADOW,
  SPACE,
  SPRING,
  Screen,
  SectionHead,
  SetStockScreen,
  Sheet,
  ShelfTile,
  Sparkline,
  SpoilsScreen,
  StaffShell,
  StatTile,
  TILE,
  TYPE,
  TenantEntryScreen,
  Tile,
  VerifiedBadge,
  WEIGHT,
  WeightSheet,
  WhiteLabelErrorScreen,
  ZONE,
  confirmLeavingUnsent,
  confirmSignOut,
  confirmSigningOutWithUnsent,
  describeUnsent,
  fetchAllocation,
  fetchFreshItem,
  fetchHistory,
  leaveStore,
  martFromTenant,
  onFill,
  postBatchDecrease,
  postStockIncrease,
  postWastage,
  setUiFace,
  setUiTypeface,
  tint,
  useAuthStore,
  useFlushLoop,
  useItemSearch,
  useKept,
  useStaffAuthNavigation,
  useStaffBoot,
  zoneFor
});
