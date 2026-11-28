var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// assets/gloss.png
var require_gloss = __commonJS({
  "assets/gloss.png"(exports, module) {
    module.exports = "./gloss-XHPBAMBP.png";
  }
});

// assets/fonts/SandeMore-Regular.otf
var require_SandeMore_Regular = __commonJS({
  "assets/fonts/SandeMore-Regular.otf"(exports, module) {
    module.exports = "./SandeMore-Regular-ZCP725IO.otf";
  }
});

// assets/fonts/SandeMore-Medium.otf
var require_SandeMore_Medium = __commonJS({
  "assets/fonts/SandeMore-Medium.otf"(exports, module) {
    module.exports = "./SandeMore-Medium-RZXOC7OI.otf";
  }
});

// assets/fonts/SandeMore-Bold.otf
var require_SandeMore_Bold = __commonJS({
  "assets/fonts/SandeMore-Bold.otf"(exports, module) {
    module.exports = "./SandeMore-Bold-IJVUI6MK.otf";
  }
});

// assets/fonts/SandeMore-ExtraBold.otf
var require_SandeMore_ExtraBold = __commonJS({
  "assets/fonts/SandeMore-ExtraBold.otf"(exports, module) {
    module.exports = "./SandeMore-ExtraBold-QK2GDK3B.otf";
  }
});

// assets/fonts/DMSans-Regular.ttf
var require_DMSans_Regular = __commonJS({
  "assets/fonts/DMSans-Regular.ttf"(exports, module) {
    module.exports = "./DMSans-Regular-Y2PJ5BOZ.ttf";
  }
});

// assets/fonts/DMSans-Medium.ttf
var require_DMSans_Medium = __commonJS({
  "assets/fonts/DMSans-Medium.ttf"(exports, module) {
    module.exports = "./DMSans-Medium-WJMKLIXC.ttf";
  }
});

// assets/fonts/DMSans-SemiBold.ttf
var require_DMSans_SemiBold = __commonJS({
  "assets/fonts/DMSans-SemiBold.ttf"(exports, module) {
    module.exports = "./DMSans-SemiBold-AFJ5CDW4.ttf";
  }
});

// assets/fonts/DMSans-Bold.ttf
var require_DMSans_Bold = __commonJS({
  "assets/fonts/DMSans-Bold.ttf"(exports, module) {
    module.exports = "./DMSans-Bold-75G63SEB.ttf";
  }
});

// src/theme/mart.ts
import Constants from "expo-constants";
import { Easing, Platform, StyleSheet } from "react-native";

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
import { setUiFont } from "@kiosk/ui";
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
var SYSTEM_FACE = Platform.select({ ios: "System", android: "sans-serif", default: "System" });
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
  setUiFont(family);
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
  borderWidth: StyleSheet.hairlineWidth,
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
  easeOut: Easing.bezier(0.16, 1, 0.3, 1),
  easeIn: Easing.bezier(0.7, 0, 0.84, 0)
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
  const extra = Constants.expoConfig?.extra;
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
import { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet as StyleSheet2,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { jsx, jsxs } from "react/jsx-runtime";
function PressableScale({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.97,
  ...rest
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value, duration) => Animated.timing(scale, { toValue: value, duration, easing: MOTION.easeOut, useNativeDriver: true }).start();
  return /* @__PURE__ */ jsx(
    Pressable,
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
      children: (state) => /* @__PURE__ */ jsx(Animated.View, { style: [{ transform: [{ scale }] }, typeof style === "function" ? style(state) : style], children: typeof children === "function" ? children(state) : children })
    }
  );
}
function MartText({
  variant = "body",
  color = MART.ink,
  style,
  ...rest
}) {
  return /* @__PURE__ */ jsx(Text, { ...rest, style: [TYPE[variant], { color }, style] });
}
function Screen({ style, ...rest }) {
  return /* @__PURE__ */ jsx(View, { ...rest, style: [styles.screen, style] });
}
function Tile({ style, ...rest }) {
  return /* @__PURE__ */ jsx(View, { ...rest, style: [styles.tile, style] });
}
function StatTile({
  label,
  value,
  zoneKey
}) {
  const accent = zoneFor(zoneKey ?? label);
  return /* @__PURE__ */ jsxs(View, { style: styles.stat, children: [
    /* @__PURE__ */ jsxs(View, { style: styles.statHead, children: [
      /* @__PURE__ */ jsx(View, { style: [styles.statDot, { backgroundColor: accent }] }),
      /* @__PURE__ */ jsx(Text, { style: [TYPE.meta, { color: MART.inkQuiet }], numberOfLines: 1, children: label })
    ] }),
    /* @__PURE__ */ jsx(Text, { style: [TYPE.title, { color: MART.ink }], numberOfLines: 1, adjustsFontSizeToFit: true, children: value })
  ] });
}
function Sparkline({
  data,
  color = MART.fallbackPrimary,
  height = 34
}) {
  const max = Math.max(1, ...data);
  return /* @__PURE__ */ jsx(View, { style: [styles.spark, { height }], children: data.map((v, i) => {
    const h = Math.max(3, Math.round(v / max * height));
    const last = i === data.length - 1;
    return /* @__PURE__ */ jsx(
      View,
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
  return /* @__PURE__ */ jsxs(View, { style: styles.hero, children: [
    /* @__PURE__ */ jsx(Text, { style: [TYPE.meta, { color: MART.inkQuiet }], children: label }),
    /* @__PURE__ */ jsxs(View, { style: styles.heroRow, children: [
      /* @__PURE__ */ jsx(Text, { style: [TYPE.display, styles.heroValue], numberOfLines: 1, adjustsFontSizeToFit: true, children: value }),
      delta ? /* @__PURE__ */ jsxs(View, { style: styles.heroDelta, children: [
        /* @__PURE__ */ jsx(
          Ionicons,
          {
            name: trendUp ? "trending-up" : "trending-down",
            size: 15,
            color: trendUp ? MART.success : MART.danger
          }
        ),
        /* @__PURE__ */ jsx(Text, { style: [TYPE.label, { color: trendUp ? MART.success : MART.danger }], children: delta })
      ] }) : null
    ] }),
    spark ? /* @__PURE__ */ jsx(Sparkline, { data: spark, color: accent, height: 26 }) : null
  ] });
}
function MiniTile({
  icon,
  label,
  value,
  accent = MART.inkQuiet
}) {
  return /* @__PURE__ */ jsxs(View, { style: styles.mini, children: [
    /* @__PURE__ */ jsx(View, { style: [styles.miniIcon, { backgroundColor: tint(accent, 0.16) }], children: /* @__PURE__ */ jsx(Ionicons, { name: icon, size: 16, color: accent }) }),
    /* @__PURE__ */ jsx(Text, { style: [TYPE.meta, { color: MART.inkQuiet }], numberOfLines: 1, children: label }),
    /* @__PURE__ */ jsx(Text, { style: [TYPE.heading, { color: MART.ink }], numberOfLines: 1, adjustsFontSizeToFit: true, children: value })
  ] });
}
function SectionHead({ children }) {
  return /* @__PURE__ */ jsx(Text, { accessibilityRole: "header", style: [TYPE.title, styles.sectionHead], children });
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
  return /* @__PURE__ */ jsx(
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
      children: busy ? /* @__PURE__ */ jsx(ActivityIndicator, { color: inkWhenOff }) : /* @__PURE__ */ jsx(Text, { style: [TYPE.label, styles.buttonLabel, { color: inkWhenOff }], children: label })
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
var styles = StyleSheet2.create({
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
import { StyleSheet as StyleSheet3, View as View2 } from "react-native";
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function CardGloss({ radius = RADIUS.lg, strength = "high" }) {
  return /* @__PURE__ */ jsxs2(View2, { style: [styles2.clip, { borderRadius: radius }], pointerEvents: "none", children: [
    /* @__PURE__ */ jsx2(View2, { style: styles2.body }),
    strength === "high" ? /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsx2(View2, { style: styles2.streak }),
      /* @__PURE__ */ jsx2(View2, { style: styles2.streakThin })
    ] }) : /* @__PURE__ */ jsxs2(Fragment, { children: [
      /* @__PURE__ */ jsx2(View2, { style: styles2.sheen }),
      /* @__PURE__ */ jsx2(View2, { style: styles2.sheenSoft })
    ] }),
    /* @__PURE__ */ jsx2(View2, { style: [styles2.rim, styles2.rimTop] }),
    /* @__PURE__ */ jsx2(View2, { style: [styles2.rim, styles2.rimLeft] }),
    /* @__PURE__ */ jsx2(View2, { style: [styles2.shade, styles2.shadeBottom] }),
    /* @__PURE__ */ jsx2(View2, { style: [styles2.shade, styles2.shadeRight] })
  ] });
}
var styles2 = StyleSheet3.create({
  clip: { ...StyleSheet3.absoluteFillObject, overflow: "hidden" },
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
  body: { ...StyleSheet3.absoluteFillObject, backgroundColor: "#f8f4e3" },
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
import { Image, StyleSheet as StyleSheet4, View as View3 } from "react-native";
import { jsx as jsx3 } from "react/jsx-runtime";
function Gloss() {
  return /* @__PURE__ */ jsx3(View3, { style: StyleSheet4.absoluteFill, pointerEvents: "none", children: /* @__PURE__ */ jsx3(Image, { source: require_gloss(), style: StyleSheet4.absoluteFill, resizeMode: "cover" }) });
}

// src/components/Sheet.tsx
import { KeyboardAvoidingView, Modal, Platform as Platform2, Pressable as Pressable2, StyleSheet as StyleSheet6, View as View4 } from "react-native";

// ../../node_modules/react-native-safe-area-context/lib/module/SafeAreaContext.js
import * as React2 from "react";
import { Dimensions, StyleSheet as StyleSheet5 } from "react-native";
var isDev = process.env.NODE_ENV !== "production";
var SafeAreaInsetsContext = /* @__PURE__ */ React2.createContext(null);
if (isDev) {
  SafeAreaInsetsContext.displayName = "SafeAreaInsetsContext";
}
var SafeAreaFrameContext = /* @__PURE__ */ React2.createContext(null);
if (isDev) {
  SafeAreaFrameContext.displayName = "SafeAreaFrameContext";
}
var styles3 = StyleSheet5.create({
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
import { Ionicons as Ionicons2 } from "@expo/vector-icons";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function Sheet({
  visible,
  onClose,
  children,
  title,
  maxHeight = "88%"
}) {
  const insets = useSafeAreaInsets();
  return /* @__PURE__ */ jsx4(Modal, { visible, transparent: true, animationType: "slide", onRequestClose: onClose, statusBarTranslucent: true, children: /* @__PURE__ */ jsxs3(
    KeyboardAvoidingView,
    {
      style: styles4.backdrop,
      behavior: Platform2.OS === "ios" ? "padding" : void 0,
      keyboardVerticalOffset: 0,
      children: [
        /* @__PURE__ */ jsx4(Pressable2, { style: StyleSheet6.absoluteFill, onPress: onClose, accessibilityRole: "button", accessibilityLabel: "Close" }),
        /* @__PURE__ */ jsxs3(View4, { style: [styles4.sheet, { maxHeight, paddingBottom: Math.max(SPACE.lg, insets.bottom + SPACE.sm) }], children: [
          /* @__PURE__ */ jsx4(View4, { style: styles4.grabber }),
          title ? /* @__PURE__ */ jsxs3(View4, { style: styles4.head, children: [
            /* @__PURE__ */ jsx4(MartText, { variant: "title", style: styles4.title, numberOfLines: 2, children: title }),
            /* @__PURE__ */ jsx4(Pressable2, { onPress: onClose, hitSlop: 10, accessibilityRole: "button", accessibilityLabel: "Close", style: styles4.close, children: /* @__PURE__ */ jsx4(Ionicons2, { name: "close", size: 20, color: MART.inkMuted }) })
          ] }) : null,
          children
        ] })
      ]
    }
  ) });
}
var styles4 = StyleSheet6.create({
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
import { StyleSheet as StyleSheet7, View as View5 } from "react-native";
import { Ionicons as Ionicons3 } from "@expo/vector-icons";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function VerifiedBadge({ verified, compact = false }) {
  if (!verified) return null;
  return /* @__PURE__ */ jsxs4(View5, { style: [styles5.badge, compact && styles5.compact], accessibilityLabel: "Verified customer", children: [
    /* @__PURE__ */ jsx5(Ionicons3, { name: "checkmark-circle", size: compact ? 11 : 13, color: MART.success }),
    compact ? null : /* @__PURE__ */ jsx5(MartText, { variant: "shelf", color: MART.success, children: "VERIFIED" })
  ] });
}
var styles5 = StyleSheet7.create({
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
import { useEffect, useRef as useRef2 } from "react";
import { Animated as Animated2, Easing as Easing2, StyleSheet as StyleSheet8, View as View6 } from "react-native";
import { jsx as jsx6 } from "react/jsx-runtime";
var TRAVEL = Easing2.bezier(0.77, 0, 0.175, 1);
var FLIGHT_MS = 400;
var GHOST = 44;
function FlyToCart({ flights, onDone }) {
  return /* @__PURE__ */ jsx6(View6, { style: StyleSheet8.absoluteFill, pointerEvents: "none", children: flights.map((flight) => /* @__PURE__ */ jsx6(Ghost, { flight, onDone }, flight.id)) });
}
function Ghost({ flight, onDone }) {
  const progress = useRef2(new Animated2.Value(0)).current;
  useEffect(() => {
    const run = Animated2.timing(progress, {
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
  return /* @__PURE__ */ jsx6(
    Animated2.View,
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
      children: /* @__PURE__ */ jsx6(Animated2.Text, { style: styles6.initials, children: flight.initials })
    }
  );
}
var styles6 = StyleSheet8.create({
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
import { useMemo, useState as useState2 } from "react";
import { Pressable as Pressable3, StyleSheet as StyleSheet9, TextInput, View as View7 } from "react-native";
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
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
  const [by, setBy] = useState2("weight");
  const [weightText, setWeightText] = useState2("");
  const [moneyText, setMoneyText] = useState2("");
  const [refused, setRefused] = useState2(null);
  const thousandths = useMemo(() => {
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
  return /* @__PURE__ */ jsx7(Sheet, { visible, onClose: onCancel, title: name, children: /* @__PURE__ */ jsxs5(View7, { style: styles7.body, children: [
    /* @__PURE__ */ jsx7(View7, { style: styles7.modes, children: ["weight", "money"].map((mode) => {
      const on = by === mode;
      return /* @__PURE__ */ jsx7(
        Pressable3,
        {
          onPress: () => {
            setBy(mode);
            setRefused(null);
          },
          accessibilityRole: "button",
          accessibilityState: { selected: on },
          style: [styles7.mode, on && styles7.modeOn],
          children: /* @__PURE__ */ jsx7(MartText, { variant: "label", color: on ? MART.paper : MART.inkMuted, children: mode === "weight" ? `By ${unit}` : "By money" })
        },
        mode
      );
    }) }),
    /* @__PURE__ */ jsxs5(View7, { style: styles7.amount, children: [
      /* @__PURE__ */ jsx7(MartText, { variant: "shelf", color: MART.inkQuiet, children: by === "weight" ? unit.toUpperCase() : "WHAT THEY ARE SPENDING" }),
      /* @__PURE__ */ jsx7(
        TextInput,
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
    by === "weight" ? /* @__PURE__ */ jsx7(View7, { style: styles7.quick, children: QUICK.map((choice) => /* @__PURE__ */ jsx7(
      Pressable3,
      {
        onPress: () => {
          setWeightText(String(choice.thousandths / 1e3));
          setRefused(null);
        },
        accessibilityRole: "button",
        accessibilityLabel: `${choice.thousandths / 1e3} ${unit}`,
        style: ({ pressed }) => [styles7.quickKey, pressed && styles7.pressed],
        children: /* @__PURE__ */ jsx7(MartText, { variant: "label", children: choice.label })
      },
      choice.label
    )) }) : null,
    /* @__PURE__ */ jsx7(View7, { style: styles7.live, children: kg !== null && totalCents !== null ? /* @__PURE__ */ jsxs5(MartText, { variant: "title", numberOfLines: 1, children: [
      kg.toLocaleString("en-KE", { maximumFractionDigits: 3 }),
      " ",
      unit,
      " \xB7 KES",
      " ",
      (totalCents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    ] }) : /* @__PURE__ */ jsx7(MartText, { variant: "meta", color: MART.inkQuiet, children: by === "weight" ? `Type how many ${unit}, or tap a fraction.` : "Type what the customer is spending." }) }),
    problem ? /* @__PURE__ */ jsx7(MartText, { variant: "meta", color: MART.danger, children: problem }) : null,
    onNotWeighed ? /* @__PURE__ */ jsx7(
      Pressable3,
      {
        onPress: () => {
          setRefused(null);
          void onNotWeighed().then((problem2) => setRefused(problem2));
        },
        accessibilityRole: "button",
        style: styles7.notWeighed,
        children: /* @__PURE__ */ jsx7(MartText, { variant: "meta", color: MART.inkMuted, style: styles7.notWeighedText, children: "This item isn't sold by weight \u2014 stop weighing it" })
      }
    ) : null,
    /* @__PURE__ */ jsxs5(View7, { style: styles7.actions, children: [
      /* @__PURE__ */ jsx7(Pressable3, { onPress: onCancel, accessibilityRole: "button", style: ({ pressed }) => [styles7.cancel, pressed && styles7.pressed], children: /* @__PURE__ */ jsx7(MartText, { variant: "label", color: MART.inkMuted, children: "Cancel" }) }),
      /* @__PURE__ */ jsx7(Pressable3, { onPress: submit, accessibilityRole: "button", style: ({ pressed }) => [styles7.add, pressed && styles7.pressed], children: /* @__PURE__ */ jsx7(MartText, { variant: "label", color: MART.paper, children: "Add to basket" }) })
    ] })
  ] }) });
}
var styles7 = StyleSheet9.create({
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
import { useRef as useRef3 } from "react";
import { Animated as Animated3, Image as Image2, Pressable as Pressable4, StyleSheet as StyleSheet10, View as View8 } from "react-native";
import { Ionicons as Ionicons4 } from "@expo/vector-icons";
import { formatQty } from "@kiosk/core";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
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
  const press = useRef3(new Animated3.Value(0)).current;
  const size = useRef3({ w: 0, h: 0 });
  const report = (pageX, pageY) => {
    if (!onPressRect || pageX === void 0 || pageY === void 0) return;
    const { w, h } = size.current;
    if (w === 0 || h === 0) return;
    onPressRect({ x: pageX - w / 2, y: pageY - h / 2, w, h });
  };
  const lift = (to) => {
    Animated3.timing(press, {
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
  return /* @__PURE__ */ jsxs6(
    Animated3.View,
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
        /* @__PURE__ */ jsxs6(
          Pressable4,
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
              out ? "out of stock" : item.onHandUnits === null ? null : `${formatQty(item.onHandUnits)} on hand`,
              selected ? `${count} in basket` : null
            ].filter(Boolean).join(", "),
            children: [
              /* @__PURE__ */ jsx8(View8, { style: styles8.wellPad, children: /* @__PURE__ */ jsxs6(View8, { style: [styles8.well, columns === 2 && styles8.wellWide, { backgroundColor: tint(accent, out ? 0.08 : 0.12) }], children: [
                item.imageUrl ? /* @__PURE__ */ jsx8(Image2, { source: { uri: item.imageUrl }, style: [styles8.image, out && styles8.imageOut], resizeMode: "cover" }) : /* @__PURE__ */ jsx8(MartText, { variant: "label", color: tint(MART.ink, out ? 0.28 : 0.5), style: styles8.mark, children: initialsOf(item.name) }),
                selected ? /* @__PURE__ */ jsx8(View8, { style: styles8.check, accessibilityElementsHidden: true, children: /* @__PURE__ */ jsx8(Ionicons4, { name: "checkmark", size: 12, color: onFill(MART.fallbackPrimary).primary }) }) : null
              ] }) }),
              /* @__PURE__ */ jsxs6(View8, { style: styles8.info, children: [
                /* @__PURE__ */ jsx8(MartText, { variant: "heading", numberOfLines: nameLines, style: styles8.name, children: item.name }),
                item.priceCents === null ? /* @__PURE__ */ jsx8(MartText, { variant: "price", color: MART.inkQuiet, style: styles8.price, children: "No price" }) : /* @__PURE__ */ jsx8(MartText, { variant: "price", color: MART.ink, style: styles8.price, children: money(item.priceCents) }),
                out ? /* @__PURE__ */ jsx8(MartText, { variant: "meta", color: MART.danger, style: styles8.stockOut, children: "Out of stock" }) : item.onHandUnits !== null ? /* @__PURE__ */ jsx8(MartText, { variant: "meta", color: MART.inkQuiet, style: styles8.stock, children: `${formatQty(item.onHandUnits)} on hand` }) : item.weighed ? /* @__PURE__ */ jsx8(MartText, { variant: "meta", color: MART.inkQuiet, style: styles8.stock, children: "by weight" }) : /* @__PURE__ */ jsx8(View8, { style: styles8.stockSpacer })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs6(View8, { style: [styles8.stepper, selected && styles8.stepperOn], children: [
          /* @__PURE__ */ jsx8(
            Pressable4,
            {
              onPress: onRemove,
              disabled: disabled || !selected || !onRemove,
              hitSlop: 4,
              accessibilityRole: "button",
              accessibilityLabel: selected ? `One fewer ${item.name}` : void 0,
              style: ({ pressed }) => [styles8.stepHit, (!selected || !onRemove) && styles8.stepDim, pressed && styles8.stepPressed],
              children: /* @__PURE__ */ jsx8(Ionicons4, { name: "remove", size: 16, color: selected ? MART.ink : MART.inkQuiet })
            }
          ),
          /* @__PURE__ */ jsx8(MartText, { variant: "heading", color: MART.ink, style: styles8.stepCount, children: count }),
          /* @__PURE__ */ jsx8(
            Pressable4,
            {
              onPress: add,
              disabled,
              hitSlop: 4,
              accessibilityRole: "button",
              accessibilityLabel: `Add ${item.name}`,
              style: ({ pressed }) => [styles8.stepPlus, pressed && styles8.stepPressed],
              children: /* @__PURE__ */ jsx8(Ionicons4, { name: "add", size: 16, color: onFill(MART.fallbackPrimary).primary })
            }
          )
        ] })
      ]
    }
  );
}
var styles8 = StyleSheet10.create({
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
import { create } from "zustand";
var useAuthStore = create((set) => ({
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
import { useCallback as useCallback2, useEffect as useEffect2, useState as useState3 } from "react";
import { Linking } from "react-native";
import {
  bootstrapTenant,
  getEmbeddedTenantSlug,
  isStaffDeepLinkIntent,
  resolveTenantFromDeepLink,
  StoreSwitchBlockedError,
  useTenantDeepLink
} from "@kiosk/core";

// src/lib/store-switch.ts
import { Alert } from "react-native";
import { getUnsentSummary, switchStore } from "@kiosk/core";
function describeUnsent(unsent) {
  const sales = `${unsent.total} unsent ${unsent.total === 1 ? "sale" : "sales"}`;
  const stuck = unsent.needsAttention;
  return stuck > 0 ? `${sales} (${stuck} ${stuck === 1 ? "needs" : "need"} attention)` : sales;
}
function confirmLeavingUnsent(unsent, storeName) {
  const name = storeName?.trim() || void 0;
  return new Promise((resolve) => {
    Alert.alert(
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
    Alert.alert(
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
  const unsent = await getUnsentSummary();
  if (unsent.total === 0) {
    return true;
  }
  return confirmSigningOutWithUnsent(unsent, storeName);
}
async function leaveStore(storeName) {
  const first = await switchStore(null);
  if (first.kind === "switched") {
    return true;
  }
  if (!await confirmLeavingUnsent(first.unsent, storeName)) {
    return false;
  }
  return (await switchStore(null, { keepUnsent: true })).kind === "switched";
}

// src/hooks/useStaffBoot.ts
async function tryResolveStaffDeepLink(url, baseURL, keepUnsent = false) {
  if (!url?.trim()) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, baseURL, { audience: "staff", keepUnsent });
  if (!result || !isStaffDeepLinkIntent(result.intent)) {
    return null;
  }
  return result.tenant;
}
function useStaffBoot(baseURL, setTenant, mayFollowLink) {
  const [phase, setPhase] = useState3("loading");
  const [bootError, setBootError] = useState3(null);
  const applyDeepLinkTenant = useCallback2(
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
  const runBootstrap = useCallback2(async () => {
    setPhase("loading");
    setBootError(null);
    try {
      const initialUrl = await Linking.getInitialURL();
      let fromDeepLink = null;
      try {
        fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
      } catch (error) {
        if (!(error instanceof StoreSwitchBlockedError)) {
          throw error;
        }
      }
      if (fromDeepLink) {
        applyDeepLinkTenant(fromDeepLink);
        return;
      }
      const tenant = await bootstrapTenant(baseURL);
      if (tenant) {
        setTenant(tenant);
        setPhase("branch");
        return;
      }
      if (getEmbeddedTenantSlug()) {
        setBootError("Could not connect to your store. Check your network and try again.");
        setPhase("error");
        return;
      }
      setPhase("tenant");
    } catch (error) {
      if (getEmbeddedTenantSlug()) {
        setBootError(error instanceof Error ? error.message : "Could not load your store");
        setPhase("error");
      } else {
        setPhase("tenant");
      }
    }
  }, [applyDeepLinkTenant, baseURL, setTenant]);
  useEffect2(() => {
    void runBootstrap();
  }, [runBootstrap]);
  useTenantDeepLink(async (url) => {
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
      if (error instanceof StoreSwitchBlockedError && await confirmLeavingUnsent(error.unsent)) {
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
import { useCallback as useCallback3 } from "react";
import { getEmbeddedTenantSlug as getEmbeddedTenantSlug2 } from "@kiosk/core";
function useStaffAuthNavigation(setPhase, onLeaveStore) {
  const { reset, setBranch, tenant } = useAuthStore();
  const canChangeStore = !getEmbeddedTenantSlug2();
  const goToTenant = useCallback3(async () => {
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
  const goToBranch = useCallback3(() => {
    setBranch(null);
    setPhase("branch");
  }, [setBranch, setPhase]);
  return { canChangeStore, goToTenant, goToBranch };
}

// src/hooks/useKept.ts
import { useCallback as useCallback4, useEffect as useEffect3, useState as useState4, useSyncExternalStore } from "react";
function useKept(keeper) {
  const value = useSyncExternalStore(keeper.subscribe, keeper.get, keeper.get);
  const [state, setState] = useState4(keeper.isLoaded() ? "ready" : "loading");
  const [attempt, setAttempt] = useState4(0);
  useEffect3(() => {
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
  const retry = useCallback4(() => setAttempt((n) => n + 1), []);
  return { value, ready: state === "ready", failed: state === "failed", retry };
}

// src/hooks/useFlushLoop.ts
import { useEffect as useEffect4, useRef as useRef4 } from "react";
import { AppState } from "react-native";
function useFlushLoop(flush, options = {}) {
  const { everyMs = 3e4, enabled = true } = options;
  const latest = useRef4(flush);
  latest.current = flush;
  useEffect4(() => {
    if (!enabled) return void 0;
    const run = () => {
      latest.current().catch(() => void 0);
    };
    run();
    const timer = setInterval(run, everyMs);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [everyMs, enabled]);
}

// src/hooks/useItemSearch.ts
import { useCallback as useCallback5, useEffect as useEffect5, useRef as useRef5, useState as useState5 } from "react";
import { ITEM_PAGE_SIZE, itemsPath, readItemsPage, searchTerms } from "@kiosk/core";
var TYPING_PAUSE_MS = 350;
function oneOfEach(items) {
  const seen = /* @__PURE__ */ new Set();
  return items.filter((item) => seen.has(item.id) ? false : (seen.add(item.id), true));
}
function useItemSearch(api, branchId, options = {}) {
  const { lowStock, zeroStock, categoryId, itemTypeId, idle } = options;
  const [query, setQuery] = useState5("");
  const [items, setItems] = useState5([]);
  const [loading, setLoading] = useState5(false);
  const [failed, setFailed] = useState5(null);
  const [total, setTotal] = useState5(null);
  const [more, setMore] = useState5(false);
  const [version, setVersion] = useState5(0);
  const sequence = useRef5(0);
  const page = useRef5(0);
  const run = useCallback5(
    async (wanted, append) => {
      const mine = ++sequence.current;
      setLoading(true);
      try {
        const terms = searchTerms(query);
        const path = itemsPath({
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
        const result = readItemsPage(raw, { page: wanted, size: ITEM_PAGE_SIZE });
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
  useEffect5(() => {
    if (idle && searchTerms(query) === null) {
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
  const loadMore = useCallback5(() => {
    if (more && !loading && failed === null) void run(page.current + 1, true);
  }, [more, loading, failed, run]);
  const reload = useCallback5(() => setVersion((n) => n + 1), []);
  const lookup = useCallback5(
    async (barcode) => {
      const terms = searchTerms(barcode);
      if (!terms) return null;
      try {
        const raw = await api.get(itemsPath({ branchId, ...terms, size: 5 }));
        return readItemsPage(raw, { page: 0, size: 5 })?.items ?? null;
      } catch {
        return null;
      }
    },
    [api, branchId]
  );
  return { query, setQuery, items, loading, failed, total, more, loadMore, reload, lookup };
}

// src/components/ItemPicker.tsx
import { useCallback as useCallback6, useEffect as useEffect6, useMemo as useMemo2, useRef as useRef6, useState as useState6 } from "react";
import { ActivityIndicator as ActivityIndicator2, FlatList, Image as Image3, Modal as Modal2, Pressable as Pressable5, ScrollView, StyleSheet as StyleSheet11, TextInput as TextInput2, View as View9 } from "react-native";
import { Ionicons as Ionicons5 } from "@expo/vector-icons";
import { formatQty as formatQty2, itemLabel } from "@kiosk/core";
import { Banner, Button, Chip, Text as Text2 } from "@kiosk/ui";
import { jsx as jsx9, jsxs as jsxs7 } from "react/jsx-runtime";
var SAME_CODE_MS = 2500;
function ItemPicker({ api, branchId, onPick, onRemove, renderScanner, withFilters = false, initialFilter = "all", idle = false, continuous = false, scanNote = null, scanTone = "ok", placeholder = "Name, code or barcode", cards = false, columns = 3, nameLines = 2, featured, categoryId, itemTypeId, onPickRect, inBasket, focusSignal = 0, showFilter = false, showAdd = false, accent }) {
  const [filter, setFilter] = useState6(initialFilter);
  const [scanning, setScanning] = useState6(false);
  const [message, setMessage] = useState6(null);
  const last = useRef6(null);
  const search = useItemSearch(api, branchId, {
    ...filter === "low" ? { lowStock: true } : {},
    ...filter === "out" ? { zeroStock: true } : {},
    ...categoryId ? { categoryId } : {},
    ...itemTypeId ? { itemTypeId } : {},
    idle
  });
  const { lookup, setQuery } = search;
  const input = useRef6(null);
  const featuredIds = useMemo2(() => new Set((featured ?? []).map((item) => item.id)), [featured]);
  const showFeatured = cards && !search.query && (featured?.length ?? 0) > 0;
  const rows = showFeatured ? search.items.filter((item) => !featuredIds.has(item.id)) : search.items;
  useEffect6(() => {
    if (focusSignal > 0) input.current?.focus();
  }, [focusSignal]);
  const onBarcode = useCallback6(
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
  return /* @__PURE__ */ jsxs7(View9, { style: styles9.fill, children: [
    /* @__PURE__ */ jsxs7(View9, { style: styles9.searchRow, children: [
      /* @__PURE__ */ jsxs7(View9, { style: styles9.searchField, children: [
        /* @__PURE__ */ jsx9(Ionicons5, { name: "search", size: 17, color: MART.inkQuiet }),
        /* @__PURE__ */ jsx9(
          TextInput2,
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
        showFilter ? /* @__PURE__ */ jsx9(
          Pressable5,
          {
            onPress: () => setFilter(filter === "all" ? "low" : filter === "low" ? "out" : "all"),
            hitSlop: 8,
            accessibilityRole: "button",
            accessibilityLabel: filter === "all" ? "Filter: all items" : filter === "low" ? "Filter: low stock" : "Filter: out of stock",
            style: [styles9.filterDot, filter !== "all" && { backgroundColor: accent ?? MART.fallbackPrimary }],
            children: /* @__PURE__ */ jsx9(Ionicons5, { name: "options-outline", size: 15, color: filter === "all" ? MART.inkMuted : MART.paper })
          }
        ) : null,
        search.query ? /* @__PURE__ */ jsx9(Pressable5, { onPress: () => search.setQuery(""), hitSlop: 8, accessibilityLabel: "Clear search", children: /* @__PURE__ */ jsx9(Ionicons5, { name: "close-circle", size: 17, color: MART.inkQuiet }) }) : null
      ] }),
      renderScanner ? /* @__PURE__ */ jsx9(
        Pressable5,
        {
          onPress: () => setScanning(true),
          accessibilityRole: "button",
          accessibilityLabel: "Scan a barcode",
          style: ({ pressed }) => [styles9.scanBtn, pressed && styles9.scanPressed],
          children: /* @__PURE__ */ jsx9(Ionicons5, { name: "barcode-outline", size: 20, color: MART.paper })
        }
      ) : null
    ] }),
    showAdd ? /* @__PURE__ */ jsx9(
      Pressable5,
      {
        onPress: () => renderScanner ? setScanning(true) : input.current?.focus(),
        accessibilityRole: "button",
        accessibilityLabel: "Add an item",
        style: ({ pressed }) => [styles9.fab, accent ? { backgroundColor: accent } : null, pressed && styles9.fabPressed],
        children: /* @__PURE__ */ jsx9(Ionicons5, { name: "add", size: 26, color: MART.paper })
      }
    ) : null,
    /* @__PURE__ */ jsx9(View9, { style: styles9.controls, children: withFilters ? /* @__PURE__ */ jsxs7(View9, { style: styles9.chips, children: [
      /* @__PURE__ */ jsx9(Chip, { label: "All", selected: filter === "all", onPress: () => setFilter("all") }),
      /* @__PURE__ */ jsx9(Chip, { label: "Low", selected: filter === "low", onPress: () => setFilter("low") }),
      /* @__PURE__ */ jsx9(Chip, { label: "Out", selected: filter === "out", onPress: () => setFilter("out") })
    ] }) : null }),
    message ? /* @__PURE__ */ jsx9(Banner, { tone: "warn", children: message }) : null,
    search.failed ? /* @__PURE__ */ jsxs7(Banner, { tone: "danger", children: [
      /* @__PURE__ */ jsx9(Text2, { variant: "caption", children: search.failed === "network" ? "Could not load items. Check the signal." : "The server sent something the app could not read." }),
      /* @__PURE__ */ jsx9(Button, { title: "Try again", variant: "secondary", onPress: search.reload, style: styles9.retry })
    ] }) : null,
    /* @__PURE__ */ jsx9(
      FlatList,
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
        ListHeaderComponent: showFeatured && featured ? /* @__PURE__ */ jsx9(
          BestSellers,
          {
            items: featured,
            nameLines,
            inBasket,
            onPick,
            ...onRemove ? { onRemove } : {}
          }
        ) : null,
        renderItem: ({ item }) => cards ? /* @__PURE__ */ jsx9(
          ShelfTile,
          {
            item: {
              name: itemLabel(item),
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
            ...onPickRect ? { onPressRect: (rect) => onPickRect({ ...rect, name: itemLabel(item) }) } : {},
            disabled: !item.active || !item.sellable
          }
        ) : /* @__PURE__ */ jsx9(
          PickerRow,
          {
            item,
            disabled: !item.active || !item.sellable,
            onPress: () => onPick(item)
          }
        ),
        ListEmptyComponent: search.loading || search.failed || showFeatured ? null : /* @__PURE__ */ jsx9(Text2, { variant: "muted", style: styles9.empty, children: idle && !search.query ? "Type a name or scan a barcode." : "No items found." }),
        ListFooterComponent: search.loading ? /* @__PURE__ */ jsx9(ActivityIndicator2, { style: styles9.spinner, color: MART.fallbackPrimary }) : null
      }
    ),
    renderScanner ? /* @__PURE__ */ jsx9(Modal2, { visible: scanning, animationType: "slide", onRequestClose: () => setScanning(false), children: /* @__PURE__ */ jsxs7(View9, { style: styles9.fill, children: [
      renderScanner({ onBarcode: (value) => void onBarcode(value), onClose: () => setScanning(false) }),
      continuous && (scanNote || message) ? /* @__PURE__ */ jsx9(View9, { style: styles9.scanNote, pointerEvents: "none", children: /* @__PURE__ */ jsx9(Banner, { tone: message ? "warn" : scanTone, children: message ?? scanNote ?? "" }) }) : null
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
  return /* @__PURE__ */ jsxs7(View9, { style: styles9.feature, children: [
    /* @__PURE__ */ jsx9(MartText, { variant: "heading", style: styles9.featureTitle, children: "Best sellers" }),
    /* @__PURE__ */ jsx9(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles9.featureRow, children: items.map((item) => /* @__PURE__ */ jsx9(View9, { style: styles9.featureCard, children: /* @__PURE__ */ jsx9(
      ShelfTile,
      {
        frame: "rail",
        columns: 2,
        nameLines: Math.min(nameLines, 3),
        item: {
          name: itemLabel(item),
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
  return /* @__PURE__ */ jsxs7(
    Pressable5,
    {
      onPress,
      disabled,
      accessibilityRole: "button",
      accessibilityLabel: `${itemLabel(item)}${item.onHandUnits === null ? "" : `, ${formatQty2(item.onHandUnits)} on hand`}`,
      style: ({ pressed }) => [styles9.pickerRow, disabled && styles9.pickerRowOff, pressed && styles9.pickerRowPressed],
      children: [
        /* @__PURE__ */ jsx9(View9, { style: [styles9.pickerMark, { backgroundColor: tint(zone, 0.16) }], children: item.imageUrl ? /* @__PURE__ */ jsx9(Image3, { source: { uri: item.imageUrl }, style: styles9.pickerPhoto, resizeMode: "cover" }) : /* @__PURE__ */ jsx9(MartText, { variant: "shelf", color: tint(MART.ink, 0.6), children: (itemLabel(item).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("") || "?").toUpperCase() }) }),
        /* @__PURE__ */ jsxs7(View9, { style: styles9.pickerBody, children: [
          /* @__PURE__ */ jsx9(MartText, { variant: "label", numberOfLines: 2, children: itemLabel(item) }),
          /* @__PURE__ */ jsx9(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: words || "No code" })
        ] }),
        /* @__PURE__ */ jsx9(View9, { style: styles9.pickerFigure, children: /* @__PURE__ */ jsx9(MartText, { variant: "shelf", color: MART.inkMuted, children: item.onHandUnits === null ? "NOT COUNTED" : `${formatQty2(item.onHandUnits)} ON HAND` }) })
      ]
    }
  );
}
var styles9 = StyleSheet11.create({
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
    borderWidth: StyleSheet11.hairlineWidth,
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
import {
  allocationPreviewPath,
  READ_TIMEOUT_MS,
  readItemHistory,
  readStockItem,
  WRITE_TIMEOUT_MS,
  withTimeout
} from "@kiosk/core";
async function fetchFreshItem(api, branchId, itemId) {
  const raw = await withTimeout(api.get(`/api/v1/items/${encodeURIComponent(itemId)}?branchId=${encodeURIComponent(branchId)}`), READ_TIMEOUT_MS);
  return readStockItem(raw);
}
var HISTORY_LIMIT = 100;
async function fetchHistory(api, itemId, limit = HISTORY_LIMIT) {
  const raw = await withTimeout(api.get(`/api/v1/items/${encodeURIComponent(itemId)}/timeline?limit=${limit}`), READ_TIMEOUT_MS);
  return readItemHistory(raw, limit);
}
function postStockIncrease(api, body) {
  return withTimeout(api.post("/api/v1/inventory/stock-increase", body), WRITE_TIMEOUT_MS);
}
function fetchAllocation(api, itemId, branchId, units) {
  return withTimeout(api.get(allocationPreviewPath(itemId, branchId, units)), READ_TIMEOUT_MS);
}
function postBatchDecrease(api, body) {
  return withTimeout(api.post("/api/v1/inventory/batch-decrease", body), WRITE_TIMEOUT_MS);
}
function postWastage(api, body) {
  return withTimeout(api.post("/api/v1/inventory/wastage", body), WRITE_TIMEOUT_MS);
}

// src/screens/TenantEntryScreen.tsx
import { useMemo as useMemo3, useState as useState8 } from "react";
import { Platform as Platform3, ScrollView as ScrollView2, StyleSheet as StyleSheet13, View as View11, Alert as Alert2 } from "react-native";
import { describeStoreResult, openStore, resolveTenantByEmail } from "@kiosk/core";

// src/theme/Field.tsx
import { Ionicons as Ionicons6 } from "@expo/vector-icons";
import { forwardRef as forwardRef2, useState as useState7 } from "react";
import { StyleSheet as StyleSheet12, Text as Text3, TextInput as TextInput3, View as View10 } from "react-native";
import { jsx as jsx10, jsxs as jsxs8 } from "react/jsx-runtime";
var Field = forwardRef2(function Field2({ label, hint, error, icon, prefix, trailing, on = "water", containerStyle, style, multiline, onFocus, onBlur, ...input }, ref) {
  const [focused, setFocused] = useState7(false);
  return /* @__PURE__ */ jsxs8(View10, { style: containerStyle, children: [
    label ? /* @__PURE__ */ jsx10(Text3, { style: styles10.label, children: label }) : null,
    /* @__PURE__ */ jsxs8(
      View10,
      {
        style: [
          styles10.field,
          multiline && styles10.multiline,
          { backgroundColor: on === "tile" ? MART.paper : MART.paperElevated },
          focused && styles10.focused,
          error ? styles10.invalid : null
        ],
        children: [
          icon ? /* @__PURE__ */ jsx10(Ionicons6, { name: icon, size: 20, color: MART.inkMuted }) : null,
          prefix ? /* @__PURE__ */ jsx10(Text3, { style: styles10.prefix, children: prefix }) : null,
          /* @__PURE__ */ jsx10(
            TextInput3,
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
    error ? /* @__PURE__ */ jsx10(Text3, { style: styles10.error, accessibilityLiveRegion: "polite", accessibilityRole: "alert", children: error }) : hint ? /* @__PURE__ */ jsx10(Text3, { style: styles10.hint, children: hint }) : null
  ] });
});
var styles10 = StyleSheet12.create({
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
import { useEffect as useEffect7, useRef as useRef7 } from "react";
import { Animated as Animated4, Easing as Easing3 } from "react-native";
import { jsx as jsx11 } from "react/jsx-runtime";
function Entrance({
  delay = 0,
  rise = SPACE.lg,
  style,
  children,
  ...rest
}) {
  const t = useRef7(new Animated4.Value(0)).current;
  useEffect7(() => {
    const anim = Animated4.timing(t, {
      toValue: 1,
      duration: 360,
      delay,
      easing: Easing3.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  return /* @__PURE__ */ jsx11(
    Animated4.View,
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
import { jsx as jsx12, jsxs as jsxs9 } from "react/jsx-runtime";
function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }) {
  const [input, setInput] = useState8("");
  const [email, setEmail] = useState8("");
  const [loading, setLoading] = useState8(false);
  const [showEmailFallback, setShowEmailFallback] = useState8(false);
  const brand = MART.fallbackPrimary;
  const greeting = useMemo3(() => {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);
  const on = onFill(brand);
  const initials = useMemo3(() => {
    const parts = appTitle.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [appTitle]);
  const open = async (value, keepUnsent = false) => {
    const result = await openStore(value, baseURL, { audience: "staff", keepUnsent });
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
    Alert2.alert("Could not open store", describeStoreResult(result, value));
  };
  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await open(input.trim());
    } catch (e) {
      Alert2.alert("Error", e instanceof Error ? e.message : "Could not resolve tenant");
    } finally {
      setLoading(false);
    }
  };
  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await resolveTenantByEmail(baseURL, email.trim());
      await open(result.host);
    } catch (e) {
      Alert2.alert("Error", e instanceof Error ? e.message : "Could not find tenant for email");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsx12(Screen, { style: styles11.container, children: /* @__PURE__ */ jsxs9(ScrollView2, { contentContainerStyle: styles11.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ jsxs9(View11, { style: [styles11.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ jsx12(View11, { style: [styles11.orb, styles11.orbOne, { backgroundColor: on.primary, opacity: 0.1 }] }),
      /* @__PURE__ */ jsx12(View11, { style: [styles11.orb, styles11.orbTwo, { backgroundColor: on.primary, opacity: 0.08 }] }),
      /* @__PURE__ */ jsx12(Entrance, { children: /* @__PURE__ */ jsxs9(View11, { style: styles11.passTop, children: [
        /* @__PURE__ */ jsx12(View11, { style: [styles11.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ jsx12(MartText, { variant: "title", color: brand, style: styles11.plaqueMark, children: initials }) }),
        /* @__PURE__ */ jsxs9(View11, { style: styles11.passNames, children: [
          /* @__PURE__ */ jsx12(MartText, { variant: "shelf", color: on.secondary, style: styles11.passEyebrow, children: "STAFF \xB7 KIOSK" }),
          /* @__PURE__ */ jsx12(MartText, { variant: "heading", color: on.primary, children: appTitle })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs9(Entrance, { delay: 70, children: [
        /* @__PURE__ */ jsxs9(MartText, { variant: "display", color: on.primary, style: styles11.passTitle, children: [
          greeting,
          "."
        ] }),
        /* @__PURE__ */ jsx12(MartText, { variant: "body", color: on.secondary, style: styles11.passHint, children: "Open your shop to sign in. Your basket, shift and shelf are waiting where you left them." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs9(Entrance, { delay: 140, style: styles11.formBody, children: [
      showEmailFallback ? /* @__PURE__ */ jsx12(
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
      ) : /* @__PURE__ */ jsx12(
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
      /* @__PURE__ */ jsx12(
        MartButton,
        {
          label: loading ? "Opening\u2026" : showEmailFallback ? "Find my shop" : "Open shop",
          busy: loading,
          style: styles11.submit,
          onPress: showEmailFallback ? resolveByEmail : resolve
        }
      ),
      /* @__PURE__ */ jsx12(
        MartButton,
        {
          label: showEmailFallback ? "Use a shop name instead" : "I only know my email",
          kind: "quiet",
          disabled: loading,
          onPress: () => setShowEmailFallback((v) => !v)
        }
      ),
      /* @__PURE__ */ jsxs9(View11, { style: styles11.cardFoot, children: [
        /* @__PURE__ */ jsx12(View11, { style: [styles11.footDot, { backgroundColor: tint(brand, 0.5) }] }),
        /* @__PURE__ */ jsx12(MartText, { variant: "meta", color: MART.inkQuiet, style: styles11.footText, children: showEmailFallback ? "Your email must be on the shop\u2019s staff list." : "The slug is in the shop\u2019s web address \u2014 ask the owner if unsure." })
      ] })
    ] }),
    /* @__PURE__ */ jsx12(Entrance, { delay: 220, style: styles11.footer, children: /* @__PURE__ */ jsxs9(View11, { style: styles11.footerMark, children: [
      /* @__PURE__ */ jsx12(View11, { style: [styles11.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ jsx12(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] }) })
  ] }) });
}
var EDGE = SPACE.xxl;
var styles11 = StyleSheet13.create({
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
    paddingTop: Platform3.select({ ios: 72, android: 40, default: 72 }),
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
import { useState as useState9 } from "react";
import { StyleSheet as StyleSheet15, View as View13, TextInput as TextInput4, Alert as Alert3 } from "react-native";
import { Button as Button2, Text as Text5, theme as theme2 } from "@kiosk/ui";
import { loginWithPin, loginWithPassword, fetchBranches } from "@kiosk/core";

// src/components/AuthBackBar.tsx
import { useEffect as useEffect8 } from "react";
import {
  BackHandler,
  Platform as Platform4,
  Pressable as Pressable6,
  StatusBar,
  StyleSheet as StyleSheet14,
  View as View12
} from "react-native";
import { Text as Text4, theme } from "@kiosk/ui";
import { jsx as jsx13, jsxs as jsxs10 } from "react/jsx-runtime";
function AuthBackBar({
  onBack,
  backLabel = "Back",
  onSecondary,
  secondaryLabel
}) {
  useEffect8(() => {
    if (!onBack) {
      return;
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  if (!onBack && !onSecondary) {
    return /* @__PURE__ */ jsx13(View12, { style: styles12.spacer });
  }
  return /* @__PURE__ */ jsxs10(View12, { style: styles12.bar, children: [
    onBack ? /* @__PURE__ */ jsx13(
      Pressable6,
      {
        onPress: onBack,
        accessibilityRole: "button",
        accessibilityLabel: backLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles12.hit, pressed && styles12.pressed],
        children: /* @__PURE__ */ jsx13(Text4, { style: styles12.label, children: backLabel })
      }
    ) : /* @__PURE__ */ jsx13(View12, {}),
    onSecondary && secondaryLabel ? /* @__PURE__ */ jsx13(
      Pressable6,
      {
        onPress: onSecondary,
        accessibilityRole: "button",
        accessibilityLabel: secondaryLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles12.hit, pressed && styles12.pressed],
        children: /* @__PURE__ */ jsx13(Text4, { style: styles12.secondary, children: secondaryLabel })
      }
    ) : null
  ] });
}
var styles12 = StyleSheet14.create({
  spacer: {
    height: Platform4.OS === "android" ? StatusBar.currentHeight ?? 16 : 48
  },
  bar: {
    paddingTop: Platform4.OS === "android" ? (StatusBar.currentHeight ?? 12) + 8 : 52,
    paddingBottom: theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48
  },
  hit: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingRight: theme.spacing.md
  },
  pressed: {
    opacity: 0.6
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primaryDark
  },
  secondary: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.primaryDark
  }
});

// src/screens/PinLoginScreen.tsx
import { jsx as jsx14, jsxs as jsxs11 } from "react/jsx-runtime";
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
  const [email, setEmail] = useState9("");
  const [pin, setPin] = useState9("");
  const [password, setPassword] = useState9("");
  const [usePassword, setUsePassword] = useState9(false);
  const [loading, setLoading] = useState9(false);
  const login = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      if (usePassword && allowPassword) {
        await loginWithPassword(baseURL, email.trim(), password);
      } else {
        if (pin.length < 4) {
          Alert3.alert("Error", "Enter your PIN");
          return;
        }
        await loginWithPin(baseURL, email.trim(), pin, branchId);
      }
      const branches = await fetchBranches(baseURL);
      onSuccess(branches);
    } catch (e) {
      Alert3.alert("Login failed", e instanceof Error ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };
  const contextBits = [branchName, storeName].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ jsxs11(View13, { style: styles13.container, children: [
    /* @__PURE__ */ jsx14(
      AuthBackBar,
      {
        onBack,
        backLabel: "Back",
        onSecondary: onChangeStore,
        secondaryLabel: "Change store"
      }
    ),
    /* @__PURE__ */ jsxs11(View13, { style: styles13.form, children: [
      /* @__PURE__ */ jsx14(Text5, { variant: "h1", children: "Sign in" }),
      contextBits ? /* @__PURE__ */ jsx14(Text5, { variant: "muted", style: styles13.context, children: contextBits }) : null,
      /* @__PURE__ */ jsx14(
        TextInput4,
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
      usePassword ? /* @__PURE__ */ jsx14(
        TextInput4,
        {
          style: styles13.input,
          placeholder: "Password",
          value: password,
          onChangeText: setPassword,
          secureTextEntry: true,
          accessibilityLabel: "Password"
        }
      ) : /* @__PURE__ */ jsx14(
        TextInput4,
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
      /* @__PURE__ */ jsx14(Button2, { title: loading ? "Signing in..." : "Sign in", onPress: login, disabled: loading }),
      allowPassword && /* @__PURE__ */ jsx14(
        Button2,
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
var styles13 = StyleSheet15.create({
  container: {
    flex: 1,
    paddingHorizontal: theme2.spacing.lg,
    paddingBottom: theme2.spacing.lg,
    backgroundColor: theme2.colors.background
  },
  form: {
    flex: 1,
    justifyContent: "center"
  },
  context: {
    marginBottom: theme2.spacing.lg
  },
  input: {
    borderWidth: 1,
    borderColor: theme2.colors.border,
    borderRadius: theme2.borderRadius.md,
    padding: theme2.spacing.md,
    marginBottom: theme2.spacing.md,
    fontSize: 16,
    minHeight: 48
  },
  secondary: {
    marginTop: theme2.spacing.md
  }
});

// src/screens/BranchSelectScreen.tsx
import { useMemo as useMemo4 } from "react";
import { Platform as Platform5, Pressable as Pressable7, ScrollView as ScrollView3, StyleSheet as StyleSheet16, View as View14 } from "react-native";
import { Ionicons as Ionicons7 } from "@expo/vector-icons";
import { jsx as jsx15, jsxs as jsxs12 } from "react/jsx-runtime";
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
  const initials = useMemo4(() => {
    const parts = (storeName ?? "Kiosk").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [storeName]);
  return /* @__PURE__ */ jsx15(Screen, { style: styles14.container, children: /* @__PURE__ */ jsxs12(ScrollView3, { contentContainerStyle: styles14.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ jsxs12(Entrance, { delay: 0, style: [styles14.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ jsx15(View14, { style: [styles14.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx15(View14, { style: [styles14.orb, styles14.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx15(View14, { style: [styles14.orb, styles14.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ jsxs12(View14, { style: styles14.passTop, children: [
        /* @__PURE__ */ jsxs12(View14, { style: styles14.passBrand, children: [
          /* @__PURE__ */ jsx15(View14, { style: [styles14.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ jsx15(MartText, { variant: "title", color: brand, style: styles14.plaqueMark, children: initials }) }),
          /* @__PURE__ */ jsxs12(View14, { style: styles14.passNames, children: [
            /* @__PURE__ */ jsx15(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles14.passEyebrow, children: "STAFF \xB7 KIOSK" }),
            /* @__PURE__ */ jsx15(MartText, { variant: "heading", color: on.primary, numberOfLines: 1, children: storeName ?? "Your shop" })
          ] })
        ] }),
        onChangeStore ? /* @__PURE__ */ jsx15(
          Pressable7,
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
            children: /* @__PURE__ */ jsx15(MartText, { variant: "shelf", color: on.primary, style: styles14.storeChipText, children: backLabel })
          }
        ) : null
      ] }),
      /* @__PURE__ */ jsx15(MartText, { variant: "display", color: on.primary, style: styles14.passTitle, children: title }),
      /* @__PURE__ */ jsx15(MartText, { variant: "body", color: on.secondary, style: styles14.passHint, children: branches.length === 1 ? "One branch is open to you." : `You can work at ${branches.length} branches \u2014 choose one to open.` })
    ] }),
    /* @__PURE__ */ jsx15(Entrance, { delay: 90, style: styles14.list, children: branches.map((item) => {
      const accent = zoneFor(item.id);
      const storeWords = new Set(
        (storeName ?? "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean)
      );
      const words = item.name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
      const own = words.filter((word) => !storeWords.has(word.toLowerCase()));
      const mark = (own.length > 0 ? own : words).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
      return /* @__PURE__ */ jsxs12(
        Pressable7,
        {
          onPress: () => onSelect(item),
          accessibilityRole: "button",
          accessibilityLabel: `Open branch ${item.name}`,
          style: ({ pressed }) => [styles14.place, pressed && styles14.placePressed],
          children: [
            /* @__PURE__ */ jsx15(View14, { style: [styles14.placeWell, { backgroundColor: tint(accent, 0.16) }], children: /* @__PURE__ */ jsx15(MartText, { variant: "display", color: tint(MART.ink, 0.62), style: styles14.placeMark, children: mark }) }),
            /* @__PURE__ */ jsxs12(View14, { style: styles14.placeBody, children: [
              /* @__PURE__ */ jsxs12(View14, { style: styles14.placeText, children: [
                /* @__PURE__ */ jsx15(MartText, { variant: "heading", numberOfLines: 2, children: item.name }),
                item.code ? /* @__PURE__ */ jsx15(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: item.code }) : /* @__PURE__ */ jsx15(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: "Open this till" })
              ] }),
              /* @__PURE__ */ jsx15(View14, { style: [styles14.placeGo, { backgroundColor: tint(brand, 0.1) }], children: /* @__PURE__ */ jsx15(Ionicons7, { name: "arrow-forward", size: 16, color: brand }) })
            ] })
          ]
        },
        item.id
      );
    }) }),
    /* @__PURE__ */ jsxs12(Entrance, { delay: 180, style: styles14.footer, children: [
      /* @__PURE__ */ jsx15(MartText, { variant: "meta", color: MART.inkQuiet, style: styles14.footerText, children: "Each branch keeps its own tills, stock and takings." }),
      /* @__PURE__ */ jsxs12(View14, { style: styles14.footerMark, children: [
        /* @__PURE__ */ jsx15(View14, { style: [styles14.footerDot, { backgroundColor: brand }] }),
        /* @__PURE__ */ jsx15(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
      ] })
    ] })
  ] }) });
}
var EDGE2 = SPACE.xxl;
var styles14 = StyleSheet16.create({
  container: { paddingHorizontal: 0, paddingBottom: SPACE.lg },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE2,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: Platform5.select({ ios: 72, android: 40, default: 72 }),
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
import { StyleSheet as StyleSheet17, View as View15 } from "react-native";
import { Ionicons as Ionicons8 } from "@expo/vector-icons";
import { getTenantDisplayName } from "@kiosk/core";
import { jsx as jsx16, jsxs as jsxs13 } from "react/jsx-runtime";
function WhiteLabelErrorScreen({ message, onRetry }) {
  const displayName = getTenantDisplayName();
  return /* @__PURE__ */ jsx16(Screen, { children: /* @__PURE__ */ jsxs13(View15, { style: styles15.content, children: [
    /* @__PURE__ */ jsxs13(Entrance, { delay: 0, style: styles15.card, children: [
      /* @__PURE__ */ jsx16(View15, { style: [styles15.badge, { backgroundColor: tint(MART.danger, 0.12) }], children: /* @__PURE__ */ jsx16(Ionicons8, { name: "cloud-offline-outline", size: 30, color: MART.danger }) }),
      /* @__PURE__ */ jsx16(MartText, { variant: "title", accessibilityRole: "header", style: styles15.title, children: displayName ?? "Store unavailable" }),
      /* @__PURE__ */ jsx16(MartText, { variant: "body", color: MART.inkMuted, style: styles15.message, children: message }),
      /* @__PURE__ */ jsx16(MartButton, { label: "Try again", onPress: onRetry, style: styles15.retry })
    ] }),
    /* @__PURE__ */ jsxs13(View15, { style: styles15.footerMark, children: [
      /* @__PURE__ */ jsx16(View15, { style: [styles15.footerDot, { backgroundColor: MART.fallbackPrimary }] }),
      /* @__PURE__ */ jsx16(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] })
  ] }) });
}
var styles15 = StyleSheet17.create({
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
import { useCallback as useCallback7, useEffect as useEffect9, useRef as useRef8, useState as useState10 } from "react";
import { ScrollView as ScrollView4, StyleSheet as StyleSheet18, TextInput as TextInput5, View as View16 } from "react-native";
import { Ionicons as Ionicons9 } from "@expo/vector-icons";
import {
  batchDecreaseBody,
  classifyWrite,
  formatQty as formatQty3,
  itemLabel as itemLabel2,
  parseQty,
  planDecreaseCalls,
  planSetOnHand,
  QTY_SCALE,
  qtyProblemWords,
  stockIncreaseBody
} from "@kiosk/core";
import { Fragment as Fragment2, jsx as jsx17, jsxs as jsxs14 } from "react/jsx-runtime";
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
      await postStockIncrease(api, stockIncreaseBody(branchId, item.id, plan));
      return { ok: true };
    } catch (error) {
      const failure = classifyWrite(error);
      return failure.kind === "refused" ? { ok: false, kind: "refused", words: failure.words, removed: 0, of: 1 } : { ok: false, kind: "doubt", words: "", removed: 0, of: 1 };
    }
  }
  let preview;
  try {
    preview = await fetchAllocation(api, item.id, branchId, plan.units);
  } catch {
    return { ok: false, kind: "refused", words: "Could not ask the server which batches to take from. Nothing was changed.", removed: 0, of: 0 };
  }
  const calls = planDecreaseCalls(preview, plan.units);
  if (!calls.ok) {
    const words = calls.problem === "none" ? "The server has no batch to take this from. Nothing was changed." : `Only ${formatQty3(calls.coveredUnits)} can be taken from the item's batches. Nothing was changed.`;
    return { ok: false, kind: "refused", words, removed: 0, of: 0 };
  }
  let removed = 0;
  for (const call of calls.calls) {
    try {
      await postBatchDecrease(api, batchDecreaseBody(call, plan.note));
      removed += 1;
    } catch (error) {
      const failure = classifyWrite(error);
      return failure.kind === "refused" ? { ok: false, kind: "refused", words: failure.words, removed, of: calls.calls.length } : { ok: false, kind: "doubt", words: "", removed, of: calls.calls.length };
    }
  }
  return { ok: true };
}
function SetStockScreen({ api, branchId, renderScanner, itemId, inline = false }) {
  const [step, setStep] = useState10(itemId ? { name: "done", item: null, tone: "ok", words: "Loading\u2026" } : { name: "pick" });
  const [typed, setTyped] = useState10("");
  const [error, setError] = useState10(null);
  const [busy, setBusy] = useState10(false);
  const working = useRef8(false);
  const guard = useCallback7(async (job) => {
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
  const open = useCallback7(
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
  useEffect9(() => {
    if (itemId) void open(itemId);
  }, [itemId, open]);
  const review = useCallback7(
    (item) => guard(async () => {
      setError(null);
      const entry = parseQty(typed, { allowZero: true });
      if (!entry.ok) {
        setError(qtyProblemWords(entry.problem));
        return;
      }
      if (!item.weighed && entry.units % QTY_SCALE !== 0) {
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
      const planned = planSetOnHand({
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
          words: `The shelf already holds ${formatQty3(entry.units)}. Nothing to change.`
        });
        return;
      }
      setStep({ name: "confirm", item: fresh, targetUnits: entry.units, basisUnits: fresh.onHandUnits ?? 0, plan: planned.plan });
    }),
    [api, branchId, guard, typed]
  );
  const apply = useCallback7(
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
          fresh?.onHandUnits != null ? `The shelf changed to ${formatQty3(fresh.onHandUnits)} while you were deciding. Nothing was changed. Look again.` : "Could not check the shelf. Nothing was changed."
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
      const now = after?.onHandUnits != null ? ` The shelf now shows ${formatQty3(after.onHandUnits)}.` : "";
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
    return /* @__PURE__ */ jsxs14(View16, { style: inline ? styles16.fillInline : styles16.fill, children: [
      !inline ? /* @__PURE__ */ jsx17(Gloss, {}) : null,
      error ? /* @__PURE__ */ jsx17(View16, { style: styles16.banner, children: /* @__PURE__ */ jsx17(NoteLine, { tone: "danger", words: error }) }) : null,
      /* @__PURE__ */ jsx17(
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
  return /* @__PURE__ */ jsxs14(View16, { style: inline ? styles16.fillInline : styles16.fill, children: [
    !inline ? /* @__PURE__ */ jsx17(Gloss, {}) : null,
    /* @__PURE__ */ jsxs14(ScrollView4, { contentContainerStyle: styles16.body, keyboardShouldPersistTaps: "handled", children: [
      shown ? /* @__PURE__ */ jsxs14(View16, { style: [styles16.card, styles16.itemCard], children: [
        /* @__PURE__ */ jsx17(View16, { style: [styles16.mark, { backgroundColor: tint(zoneFor(shown.name), 0.18) }], children: /* @__PURE__ */ jsx17(MartText, { variant: "label", color: tint(MART.ink, 0.66), children: initialsOf2(shown.name) }) }),
        /* @__PURE__ */ jsxs14(View16, { style: styles16.itemText, children: [
          /* @__PURE__ */ jsx17(MartText, { variant: "title", numberOfLines: 2, children: itemLabel2(shown) }),
          /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, children: shown.onHandUnits === null ? "Shelf count not known" : `${formatQty3(shown.onHandUnits)} on the shelf now` })
        ] })
      ] }) : /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, children: "Loading\u2026" }),
      error ? /* @__PURE__ */ jsx17(NoteLine, { tone: "danger", words: error }) : null,
      step.name === "edit" ? /* @__PURE__ */ jsxs14(Fragment2, { children: [
        /* @__PURE__ */ jsx17(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles16.eyebrow, children: "HOW MANY DID YOU COUNT?" }),
        /* @__PURE__ */ jsxs14(View16, { style: styles16.countRow, children: [
          /* @__PURE__ */ jsx17(
            TextInput5,
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
          /* @__PURE__ */ jsx17(
            PressableScale,
            {
              onPress: () => void review(step.item),
              disabled: busy || typed.trim() === "",
              scaleTo: 0.94,
              style: [styles16.tick, (busy || typed.trim() === "") && styles16.tickOff],
              accessibilityRole: "button",
              accessibilityLabel: "Save this count",
              children: /* @__PURE__ */ jsx17(Ionicons9, { name: "checkmark", size: 26, color: MART.paper })
            }
          )
        ] }),
        /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, children: step.item.weighed ? "Fractions are allowed for this item." : "Whole numbers only." }),
        /* @__PURE__ */ jsx17(
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
            children: /* @__PURE__ */ jsx17(MartText, { variant: "label", color: MART.inkMuted, style: styles16.quietLabel, children: "Pick another item" })
          }
        )
      ] }) : null,
      step.name === "confirm" ? /* @__PURE__ */ jsxs14(Fragment2, { children: [
        /* @__PURE__ */ jsxs14(View16, { style: styles16.changeCard, children: [
          /* @__PURE__ */ jsx17(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles16.eyebrow, children: step.plan.kind === "increase" ? "COUNTED MORE THAN THE SYSTEM HELD" : "COUNTED LESS THAN THE SYSTEM HELD" }),
          /* @__PURE__ */ jsxs14(View16, { style: styles16.changeRow, children: [
            /* @__PURE__ */ jsx17(MartText, { variant: "display", color: step.plan.kind === "increase" ? MART.success : MART.warning, children: `${step.plan.kind === "increase" ? "+" : "\u2212"}${formatQty3(step.plan.units)}` }),
            /* @__PURE__ */ jsxs14(View16, { style: styles16.changeFrom, children: [
              /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, children: `${formatQty3(step.basisUnits)} now` }),
              /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, children: `${formatQty3(step.targetUnits)} after` })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: MART.inkQuiet, style: styles16.note, children: "This changes the shop's stock records. The change is checked against the shelf once more just before it is sent." }),
        /* @__PURE__ */ jsx17(MartButton, { label: busy ? "Working\u2026" : "Confirm", onPress: () => void apply(step), disabled: busy, busy }),
        /* @__PURE__ */ jsx17(
          PressableScale,
          {
            onPress: () => setStep({ name: "edit", item: step.item }),
            disabled: busy,
            scaleTo: 0.98,
            style: [styles16.quietBtn, busy && styles16.dim],
            accessibilityRole: "button",
            accessibilityLabel: "Back",
            children: /* @__PURE__ */ jsx17(MartText, { variant: "label", color: MART.inkMuted, style: styles16.quietLabel, children: "Back" })
          }
        )
      ] }) : null,
      step.name === "done" ? /* @__PURE__ */ jsxs14(Fragment2, { children: [
        step.item ? /* @__PURE__ */ jsx17(NoteLine, { tone: step.tone, words: step.words }) : null,
        step.item ? /* @__PURE__ */ jsx17(
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
  return /* @__PURE__ */ jsxs14(View16, { style: [styles16.noteLine, { backgroundColor: tint(colour, 0.08) }], children: [
    /* @__PURE__ */ jsx17(
      Ionicons9,
      {
        name: tone === "danger" ? "alert-circle" : tone === "warn" ? "warning" : tone === "ok" ? "checkmark-circle" : "information-circle",
        size: 15,
        color: colour
      }
    ),
    /* @__PURE__ */ jsx17(MartText, { variant: "meta", color: colour, style: { flex: 1 }, children: words })
  ] });
}
var styles16 = StyleSheet18.create({
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
import { useCallback as useCallback8, useEffect as useEffect10, useMemo as useMemo5, useRef as useRef9, useState as useState11 } from "react";
import { Pressable as Pressable8, ScrollView as ScrollView5, StyleSheet as StyleSheet19, TextInput as TextInput6, View as View17 } from "react-native";
import {
  addSpoil,
  beginSending,
  claimSpoils,
  classifyWrite as classifyWrite2,
  clearSpoils,
  decodeSpoils,
  emptySpoils,
  encodeSpoils,
  formatQty as formatQty4,
  itemLabel as itemLabel3,
  nextSpoil,
  parseQty as parseQty2,
  QTY_SCALE as QTY_SCALE2,
  qtyProblemWords as qtyProblemWords2,
  removeSpoil,
  setReason,
  setSpoilUnits,
  SPOIL_REASONS,
  spoilDone,
  spoilNotDone,
  spoilOperations,
  spoilVerdict,
  tenantKeeper,
  wastageBody
} from "@kiosk/core";
import { Banner as Banner2 } from "@kiosk/ui";
import { Fragment as Fragment3, jsx as jsx18, jsxs as jsxs15 } from "react/jsx-runtime";
var CODEC = {
  initial: null,
  parse: (text, now) => decodeSpoils(text, now),
  serialize: (list) => encodeSpoils(list)
};
var ADD_WORDS = {
  bad_quantity: "Enter how many, as a number above zero.",
  too_big: "That is more than one line of the list can hold.",
  too_many: "The list is full. Write these off first.",
  busy: "That item is being written off right now."
};
function SpoilsScreen({ api, tenantId, branchId, ownerId, renderScanner, addItem }) {
  const keeper = useMemo5(() => tenantKeeper("spoils", tenantId, CODEC), [tenantId]);
  const kept = useKept(keeper);
  const owner = useMemo5(() => ({ ownerId, branchId }), [ownerId, branchId]);
  const [view, setView] = useState11("list");
  const [prompt, setPrompt] = useState11(null);
  const [typed, setTyped] = useState11("");
  const [note, setNote] = useState11(null);
  const [confirming, setConfirming] = useState11(false);
  const [choose, setChoose] = useState11(false);
  const [busy, setBusy] = useState11(false);
  const working = useRef9(false);
  const mounted = useRef9(true);
  useEffect10(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect10(() => {
    if (!kept.ready) return;
    keeper.update((list2) => list2 && (list2.ownerId !== ownerId || list2.branchId !== branchId) ? claimSpoils(list2, owner, Date.now()) : list2);
  }, [kept.ready, keeper, ownerId, branchId, owner]);
  useEffect10(() => {
    if (kept.ready && addItem) {
      setPrompt({ kind: "add", item: addItem });
      setTyped("1");
      setView("add");
    }
  }, [kept.ready, addItem]);
  const list = kept.value && kept.value.ownerId === ownerId && kept.value.branchId === branchId ? kept.value : kept.value ? { ...emptySpoils(owner, 0), inFlight: kept.value.inFlight } : null;
  const lines = list?.lines ?? [];
  const flight = list?.inFlight ?? null;
  const reason = list?.reason ?? "SPOILAGE";
  const guard = useCallback8(async (job) => {
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
  const edit = useCallback8(
    (change) => {
      keeper.update((current) => change(claimSpoils(current, owner, Date.now())));
    },
    [keeper, owner]
  );
  const submitPrompt = useCallback8(() => {
    if (!prompt) return;
    const entry = parseQty2(typed);
    if (!entry.ok) {
      setNote({ tone: "danger", text: qtyProblemWords2(entry.problem) });
      return;
    }
    const weighed = prompt.kind === "add" ? prompt.item.weighed : prompt.line.weighed;
    if (!weighed && entry.units % QTY_SCALE2 !== 0) {
      setNote({ tone: "danger", text: "This item is counted in whole numbers." });
      return;
    }
    if (prompt.kind === "add") {
      const base = claimSpoils(keeper.get(), owner, Date.now());
      const added = addSpoil(base, { id: prompt.item.id, name: itemLabel3(prompt.item), weighed: prompt.item.weighed, buyingCents: prompt.item.buyingCents, sellingCents: prompt.item.sellingCents }, entry.units, Date.now());
      if (!added.ok) {
        setNote({ tone: "danger", text: ADD_WORDS[added.why] });
        return;
      }
      keeper.update(() => added.list);
    } else {
      edit((current) => setSpoilUnits(current, prompt.line.itemId, entry.units, Date.now()));
    }
    setNote(null);
    setPrompt(null);
    setTyped("");
    setView("list");
  }, [prompt, typed, keeper, owner, edit]);
  const sendAll = useCallback8(
    () => guard(async () => {
      setConfirming(false);
      setNote(null);
      let sent = 0;
      for (let turn = 0; turn < 200; turn += 1) {
        if (!mounted.current) return;
        const current = keeper.get();
        const line = current ? nextSpoil(current) : null;
        if (!current || !line) break;
        let baseline;
        try {
          const history = await fetchHistory(api, line.itemId);
          if (!history) {
            setNote({ tone: "danger", text: `${line.name}: the server sent a history the app could not read. Nothing was written off for this item.` });
            return;
          }
          baseline = [...spoilOperations(history.entries, branchId).keys()];
        } catch {
          setNote({ tone: "danger", text: `${line.name}: could not check the item first. Check the signal. Nothing was written off for this item.` });
          return;
        }
        if (!mounted.current) return;
        if (!beginSending(keeper, line, baseline, Date.now())) {
          setNote({ tone: "warn", text: "A write-off is already being sent. Wait for it to finish, then look at the list again." });
          return;
        }
        const started = keeper.get()?.inFlight ?? null;
        if (!started) return;
        const landed = await keeper.saved();
        if (!landed) {
          keeper.update((latest) => latest ? spoilNotDone(latest, Date.now()) : latest);
          setNote({ tone: "danger", text: "Could not save on this phone, so nothing was sent. Free some space and try again." });
          return;
        }
        try {
          await postWastage(api, wastageBody({ branchId: started.branchId, itemId: started.itemId, units: started.units, unitCostCents: started.unitCostCents, reason: started.reason }));
        } catch (error) {
          const failure = classifyWrite2(error);
          if (failure.kind === "refused") {
            keeper.update((latest) => latest ? spoilNotDone(latest, Date.now()) : latest);
            setNote({ tone: "danger", text: `${started.name}: ${failure.words} Nothing was written off for this item.` });
          } else {
            setNote({ tone: "warn", text: `${started.name}: there was no clear answer. It may or may not have been written off. Check it below before doing anything else.` });
          }
          return;
        }
        keeper.update((latest) => latest ? spoilDone(latest, Date.now()) : latest);
        sent += 1;
      }
      if (sent > 0) setNote({ tone: "ok", text: sent === 1 ? "Written off." : `${sent} items written off.` });
    }),
    [api, branchId, guard, keeper]
  );
  const checkNow = useCallback8(
    () => guard(async () => {
      const doubt = keeper.get()?.inFlight;
      if (!doubt) return;
      let history = null;
      try {
        history = await fetchHistory(api, doubt.itemId);
      } catch {
        history = null;
      }
      const verdict = spoilVerdict(history, doubt, Date.now());
      setChoose(verdict === "not_seen" || verdict === "too_busy");
      if (verdict === "done") {
        keeper.update((latest) => latest ? spoilDone(latest, Date.now()) : latest);
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
    return /* @__PURE__ */ jsxs15(View17, { style: styles17.fill, children: [
      /* @__PURE__ */ jsx18(Gloss, {}),
      /* @__PURE__ */ jsxs15(View17, { style: styles17.body, children: [
        /* @__PURE__ */ jsx18(Banner2, { tone: "danger", children: "Could not read what is saved on this phone. Nothing was changed." }),
        /* @__PURE__ */ jsx18(MartButton, { label: "Try again", onPress: kept.retry })
      ] })
    ] });
  }
  if (!kept.ready) {
    return /* @__PURE__ */ jsxs15(View17, { style: styles17.fill, children: [
      /* @__PURE__ */ jsx18(Gloss, {}),
      /* @__PURE__ */ jsx18(MartText, { variant: "meta", color: MART.inkQuiet, style: styles17.body, children: "Reading what is saved on this phone\u2026" })
    ] });
  }
  if (view === "add") {
    if (prompt) {
      const name = prompt.kind === "add" ? itemLabel3(prompt.item) : prompt.line.name;
      const weighed = prompt.kind === "add" ? prompt.item.weighed : prompt.line.weighed;
      return /* @__PURE__ */ jsxs15(View17, { style: styles17.fill, children: [
        /* @__PURE__ */ jsx18(Gloss, {}),
        /* @__PURE__ */ jsxs15(ScrollView5, { contentContainerStyle: styles17.body, keyboardShouldPersistTaps: "handled", children: [
          /* @__PURE__ */ jsx18(View17, { style: styles17.card, children: /* @__PURE__ */ jsx18(MartText, { variant: "title", children: name }) }),
          note ? /* @__PURE__ */ jsx18(Banner2, { tone: note.tone, children: note.text }) : null,
          /* @__PURE__ */ jsxs15(View17, { style: styles17.card, children: [
            /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, children: "How many are being written off?" }),
            /* @__PURE__ */ jsx18(
              TextInput6,
              {
                value: typed,
                onChangeText: setTyped,
                keyboardType: "decimal-pad",
                placeholder: "0",
                placeholderTextColor: MART.inkQuiet,
                style: styles17.field
              }
            ),
            /* @__PURE__ */ jsx18(MartText, { variant: "meta", color: MART.inkQuiet, children: weighed ? "This item can be counted in fractions." : "Whole numbers only." })
          ] }),
          /* @__PURE__ */ jsx18(MartButton, { label: prompt.kind === "add" ? "Add to the list" : "Save", onPress: submitPrompt }),
          prompt.kind === "edit" ? /* @__PURE__ */ jsx18(
            PressableScale,
            {
              onPress: () => {
                edit((current) => removeSpoil(current, prompt.line.itemId, Date.now()));
                setPrompt(null);
                setView("list");
              },
              scaleTo: 0.98,
              style: styles17.dangerBtn,
              accessibilityRole: "button",
              accessibilityLabel: "Take it off the list",
              children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.danger, style: styles17.actionLabel, children: "Take it off the list" })
            }
          ) : null,
          /* @__PURE__ */ jsx18(
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
              children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Cancel" })
            }
          )
        ] })
      ] });
    }
    return /* @__PURE__ */ jsxs15(View17, { style: styles17.fill, children: [
      /* @__PURE__ */ jsx18(Gloss, {}),
      /* @__PURE__ */ jsxs15(View17, { style: styles17.pad, children: [
        /* @__PURE__ */ jsx18(PressableScale, { onPress: () => setView("list"), scaleTo: 0.98, style: styles17.quietBtn, accessibilityRole: "button", accessibilityLabel: "Back to the list", children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Back to the list" }) }),
        note ? /* @__PURE__ */ jsx18(Banner2, { tone: note.tone, style: styles17.gap, children: note.text }) : null
      ] }),
      /* @__PURE__ */ jsx18(
        ItemPicker,
        {
          api,
          branchId,
          onPick: (item) => {
            if (item.packageVariant) {
              setNote({ tone: "danger", text: `${itemLabel3(item)} is a pack. Write off its main item instead.` });
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
  return /* @__PURE__ */ jsxs15(View17, { style: styles17.fill, children: [
    /* @__PURE__ */ jsx18(Gloss, {}),
    /* @__PURE__ */ jsxs15(ScrollView5, { contentContainerStyle: styles17.body, keyboardShouldPersistTaps: "handled", children: [
      note ? /* @__PURE__ */ jsx18(Banner2, { tone: note.tone, children: note.text }) : null,
      flight ? /* @__PURE__ */ jsxs15(View17, { style: styles17.card, children: [
        /* @__PURE__ */ jsx18(MartText, { variant: "title", children: "Not sure this went through" }),
        /* @__PURE__ */ jsx18(MartText, { variant: "body", color: MART.inkMuted, children: `Writing off ${formatQty4(flight.units)} of ${flight.name} got no clear answer. It may already have been taken off the shelf. Check before doing anything else.` }),
        /* @__PURE__ */ jsx18(MartButton, { label: busy ? "Checking\u2026" : "Check now", onPress: () => void checkNow(), disabled: busy, busy }),
        choose ? /* @__PURE__ */ jsxs15(Fragment3, { children: [
          /* @__PURE__ */ jsx18(
            PressableScale,
            {
              onPress: () => {
                keeper.update((latest) => latest ? spoilNotDone(latest, Date.now()) : latest);
                setChoose(false);
                setNote(null);
              },
              scaleTo: 0.98,
              style: styles17.quietBtn,
              accessibilityRole: "button",
              accessibilityLabel: "It did not go through: put it back on the list",
              children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "It did not go through: put it back on the list" })
            }
          ),
          /* @__PURE__ */ jsx18(
            PressableScale,
            {
              onPress: () => {
                keeper.update((latest) => latest ? spoilDone(latest, Date.now()) : latest);
                setChoose(false);
                setNote(null);
              },
              scaleTo: 0.98,
              style: styles17.quietBtn,
              accessibilityRole: "button",
              accessibilityLabel: "It did go through: take it off the list",
              children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "It did go through: take it off the list" })
            }
          )
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ jsx18(MartText, { variant: "shelf", color: MART.inkQuiet, style: styles17.eyebrow, children: "WHY WRITE OFF?" }),
      /* @__PURE__ */ jsx18(View17, { style: styles17.chips, children: SPOIL_REASONS.map((option) => {
        const on = reason === option.key;
        const off = busy || !!flight;
        return /* @__PURE__ */ jsx18(
          Pressable8,
          {
            onPress: () => edit((current) => setReason(current, option.key, Date.now())),
            disabled: off,
            accessibilityRole: "button",
            accessibilityState: { selected: on, disabled: off },
            style: [styles17.chip, on && styles17.chipOn, off && styles17.dim],
            children: /* @__PURE__ */ jsx18(
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
      lines.length === 0 ? /* @__PURE__ */ jsxs15(View17, { style: styles17.empty, children: [
        /* @__PURE__ */ jsx18(MartText, { variant: "title", style: styles17.emptyTitle, children: "Nothing on the list yet" }),
        /* @__PURE__ */ jsx18(MartText, { variant: "meta", color: MART.inkQuiet, style: styles17.emptyCopy, children: "Add spoiled, expired or broken stock, then write it off." })
      ] }) : /* @__PURE__ */ jsx18(View17, { style: styles17.list, children: lines.map((line) => {
        const locked = busy || !!flight && flight.itemId === line.itemId;
        return /* @__PURE__ */ jsxs15(
          Pressable8,
          {
            disabled: locked,
            onPress: () => {
              setNote(null);
              setTyped(formatQty4(line.units).replace(/,/g, ""));
              setPrompt({ kind: "edit", line });
              setView("add");
            },
            accessibilityRole: "button",
            accessibilityLabel: `${line.name}, ${formatQty4(line.units)}`,
            style: [styles17.row, locked && styles17.dim],
            children: [
              /* @__PURE__ */ jsxs15(View17, { style: styles17.rowLeft, children: [
                /* @__PURE__ */ jsx18(MartText, { variant: "heading", numberOfLines: 2, children: line.name }),
                flight && flight.itemId === line.itemId ? /* @__PURE__ */ jsx18(MartText, { variant: "meta", color: MART.warning, children: "Being written off" }) : null
              ] }),
              /* @__PURE__ */ jsx18(MartText, { variant: "price", children: formatQty4(line.units) })
            ]
          },
          line.itemId
        );
      }) }),
      /* @__PURE__ */ jsx18(
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
          children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.ink, style: styles17.actionLabel, children: "Add an item" })
        }
      ),
      confirming ? /* @__PURE__ */ jsxs15(View17, { style: styles17.card, children: [
        /* @__PURE__ */ jsx18(MartText, { variant: "body", color: MART.inkMuted, children: `Write off ${lines.length} ${lines.length === 1 ? "item" : "items"} as \u201C${SPOIL_REASONS.find((option) => option.key === reason)?.label ?? ""}\u201D? This lowers the shop's stock records and cannot be undone from the phone.` }),
        /* @__PURE__ */ jsx18(MartButton, { label: busy ? "Working\u2026" : "Yes, write them off", onPress: () => void sendAll(), disabled: busy, busy }),
        /* @__PURE__ */ jsx18(
          PressableScale,
          {
            onPress: () => setConfirming(false),
            disabled: busy,
            scaleTo: 0.98,
            style: [styles17.quietBtn, busy && styles17.dim],
            accessibilityRole: "button",
            accessibilityLabel: "Not yet",
            children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.inkMuted, style: styles17.actionLabel, children: "Not yet" })
          }
        )
      ] }) : /* @__PURE__ */ jsx18(
        MartButton,
        {
          label: `Write off ${lines.length || ""}`.trim(),
          onPress: () => setConfirming(true),
          disabled: busy || lines.length === 0 || !!flight
        }
      ),
      lines.length > 0 && !flight ? /* @__PURE__ */ jsx18(
        PressableScale,
        {
          onPress: () => edit((current) => clearSpoils(current, Date.now())),
          disabled: busy,
          scaleTo: 0.98,
          style: [styles17.quietBtn, busy && styles17.dim],
          accessibilityRole: "button",
          accessibilityLabel: "Clear the list",
          children: /* @__PURE__ */ jsx18(MartText, { variant: "label", color: MART.danger, style: styles17.actionLabel, children: "Clear the list" })
        }
      ) : null
    ] })
  ] });
}
var styles17 = StyleSheet19.create({
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
import { useCallback as useCallback9, useEffect as useEffect13, useMemo as useMemo8, useRef as useRef12, useState as useState14 } from "react";
import { ActivityIndicator as ActivityIndicator3, Alert as Alert4, Linking as Linking3, StyleSheet as StyleSheet23, View as View21 } from "react-native";
import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold
} from "@expo-google-fonts/poppins";
import {
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold
} from "@expo-google-fonts/schibsted-grotesk";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold
} from "@expo-google-fonts/plus-jakarta-sans";
import { Text as Text6, theme as theme3 } from "@kiosk/ui";
import {
  APP_NAMES as APP_NAMES2,
  checkTillRegistration,
  clearKnownStaff,
  createApiClient,
  endSession,
  fetchBranches as fetchBranches2,
  fetchMe,
  fetchPlatformConfig,
  fetchShiftsDisabled,
  forgetKnownStaff,
  forgetTillRegistered,
  getEmbeddedTenantSlug as getEmbeddedTenantSlug3,
  getOrCreateTillDeviceId as getOrCreateTillDeviceId2,
  getTenantDisplayName as getTenantDisplayName2,
  getUnsentSummary as getUnsentSummary2,
  loadKnownStaff,
  parseTenantDeepLink,
  rememberStaff,
  removeKnownStaff,
  requestTillAccess,
  shiftsAreDisabled
} from "@kiosk/core";

// src/lib/entry.ts
import {
  appsThatFit,
  fitsApp,
  isApiError,
  isBranchLockedRole
} from "@kiosk/core";

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
    if (isApiError(error)) {
      if (error.status === 401) return { name: "signed_out" };
      if (error.status === 423) return { name: "shop_off" };
    }
    return { name: "check_failed" };
  }
  if (!user.roleKey) {
    return { name: "no_role", user };
  }
  if (!fitsApp(questions.app, user.permissions)) {
    return { name: "wrong_app", user, fits: appsThatFit(user.permissions) };
  }
  if (user.branchId) {
    return settle(questions, user, user.branchId, void 0, limitMs);
  }
  if (isBranchLockedRole(user.roleKey)) {
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
import { APP_JOBS, APP_NAMES, describeSetup, plainHost, webHomeForRole } from "@kiosk/core";
function shopWebUrl(host, path = "/") {
  const clean = plainHost(host);
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
  const host = plainHost(context.host) ?? void 0;
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
      const step = describeSetup({ requirement: "branch", hint: "assign" }, { web: host });
      return { title: step.title, body: step.body, actions: [{ ...SIGN_OUT, primary: true }] };
    }
    case "no_branch": {
      const step = describeSetup({ requirement: "branch", hint: "none" }, { web: host });
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
      const home = webHomeForRole(stage.user.roleKey);
      const others = stage.fits.filter((app) => app !== context.app).map((app) => APP_NAMES[app]);
      const lines = [
        `The ${APP_NAMES[context.app]} app is for ${APP_JOBS[context.app]}.`,
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
import { ScrollView as ScrollView6, StyleSheet as StyleSheet20, View as View18 } from "react-native";
import { Ionicons as Ionicons10 } from "@expo/vector-icons";
import { jsx as jsx19, jsxs as jsxs16 } from "react/jsx-runtime";
function NoticeScreen({ notice, onAction, busy = false }) {
  const brand = MART.fallbackPrimary;
  return /* @__PURE__ */ jsx19(Screen, { children: /* @__PURE__ */ jsxs16(ScrollView6, { contentContainerStyle: styles18.content, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ jsxs16(Entrance, { delay: 0, style: styles18.card, children: [
      /* @__PURE__ */ jsx19(View18, { style: [styles18.badge, { backgroundColor: tint(brand, 0.12) }], children: /* @__PURE__ */ jsx19(Ionicons10, { name: "information-circle-outline", size: 30, color: brand }) }),
      /* @__PURE__ */ jsx19(MartText, { variant: "title", accessibilityRole: "header", style: styles18.title, children: notice.title }),
      /* @__PURE__ */ jsx19(MartText, { variant: "body", color: MART.inkMuted, style: styles18.body, children: notice.body }),
      /* @__PURE__ */ jsx19(View18, { style: styles18.actions, children: notice.actions.map((action) => /* @__PURE__ */ jsx19(
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
    /* @__PURE__ */ jsxs16(Entrance, { delay: 120, style: styles18.footerMark, children: [
      /* @__PURE__ */ jsx19(View18, { style: [styles18.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ jsx19(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] })
  ] }) });
}
var styles18 = StyleSheet20.create({
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
import { useEffect as useEffect11, useMemo as useMemo6, useRef as useRef10, useState as useState12 } from "react";
import { Pressable as Pressable9, ScrollView as ScrollView7, StyleSheet as StyleSheet21, View as View19 } from "react-native";
import { Ionicons as Ionicons11 } from "@expo/vector-icons";
import {
  getOrCreateTillDeviceId,
  parsePairingCode,
  parsePairingScan,
  previewPairing,
  redeemPairing,
  rememberTillRegistered
} from "@kiosk/core";

// src/lib/pair-copy.ts
import { isProvisionalId } from "@kiosk/core";
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
  if (theirs && ours && !isProvisionalId(ours)) return theirs === ours;
  const named = codeShop.trim().toLowerCase();
  return named.length > 0 && (named === open.host.trim().toLowerCase() || named === open.slug.trim().toLowerCase());
}

// src/screens/PairScreen.tsx
import { Fragment as Fragment4, jsx as jsx20, jsxs as jsxs17 } from "react/jsx-runtime";
function PairScreen({ baseURL, tenant, renderScanner, onPaired, onCancel }) {
  const [step, setStep] = useState12("enter");
  const [text, setText] = useState12("");
  const [code, setCode] = useState12("");
  const [preview, setPreview] = useState12(null);
  const [message, setMessage] = useState12(null);
  const [busy, setBusy] = useState12(false);
  const mounted = useRef10(true);
  const sending = useRef10(false);
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = useMemo6(() => {
    const parts = tenant.displayName.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? "K").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }, [tenant.displayName]);
  useEffect11(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const look = async (candidate) => {
    if (busy || sending.current) return;
    const parsed = parsePairingCode(candidate);
    if (parsed.kind !== "ok") {
      setMessage(describeCodeProblem(parsed));
      setStep("enter");
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage(null);
    const found = await previewPairing(parsed.code, baseURL);
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
    const fromQr = parsePairingScan(scan);
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
      const deviceKey = await getOrCreateTillDeviceId(tenant.businessId);
      if (!deviceKey.trim()) {
        sending.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setMessage("Couldn't set this phone up as a till. Close the app, open it again and try again.");
        return;
      }
      const result = await redeemPairing(code, deviceKey, baseURL);
      sending.current = false;
      if (!mounted.current) return;
      if (result.kind !== "paired") {
        setBusy(false);
        setMessage(describePairingFailure(result));
        setStep(result.kind === "offline" || result.kind === "rate_limited" ? "confirm" : "enter");
        return;
      }
      await rememberTillRegistered(tenant.businessId, preview.branchId).catch(() => void 0);
      onPaired(preview.branchName);
    } catch {
      sending.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setMessage("Couldn't pair this phone. Try again.");
    }
  };
  if (step === "scan" && renderScanner) {
    return /* @__PURE__ */ jsx20(View19, { style: styles19.fill, children: renderScanner({ onScanned: scanned, onCancel: () => setStep("enter") }) });
  }
  const back = step === "confirm" ? () => setStep("enter") : onCancel;
  const backLabel = step === "confirm" ? "Back" : "Cancel";
  return /* @__PURE__ */ jsx20(Screen, { style: styles19.container, children: /* @__PURE__ */ jsxs17(ScrollView7, { contentContainerStyle: styles19.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ jsxs17(Entrance, { delay: 0, style: [styles19.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ jsx20(View19, { style: [styles19.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx20(View19, { style: [styles19.orb, styles19.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx20(View19, { style: [styles19.orb, styles19.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ jsxs17(View19, { style: styles19.passTop, children: [
        /* @__PURE__ */ jsxs17(View19, { style: styles19.passBrand, children: [
          /* @__PURE__ */ jsx20(View19, { style: [styles19.passRing, { borderColor: on.hairline }], children: /* @__PURE__ */ jsx20(View19, { style: [styles19.passMark, { backgroundColor: on.primary }], children: /* @__PURE__ */ jsx20(MartText, { style: [styles19.passMonogram, { color: brand }], children: initials }) }) }),
          /* @__PURE__ */ jsx20(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles19.passStore, children: tenant.displayName.toUpperCase() })
        ] }),
        /* @__PURE__ */ jsxs17(
          Pressable9,
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
              /* @__PURE__ */ jsx20(Ionicons11, { name: "chevron-back", size: 14, color: on.primary }),
              /* @__PURE__ */ jsx20(MartText, { variant: "shelf", color: on.primary, style: styles19.storeChipText, children: backLabel })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx20(MartText, { variant: "display", color: on.primary, style: styles19.passTitle, children: "Pair this phone" }),
      /* @__PURE__ */ jsx20(MartText, { variant: "body", color: on.secondary, style: styles19.passHint, children: step === "confirm" ? "Check the details, then confirm." : "Turn this phone into a till for the shop." })
    ] }),
    /* @__PURE__ */ jsxs17(Entrance, { delay: 90, style: styles19.formBody, children: [
      step === "confirm" && preview ? /* @__PURE__ */ jsxs17(View19, { style: styles19.summary, accessibilityLabel: "Pairing details", children: [
        /* @__PURE__ */ jsx20(View19, { style: [styles19.summaryBadge, { backgroundColor: tint(brand, 0.12) }], children: /* @__PURE__ */ jsx20(Ionicons11, { name: "phone-portrait-outline", size: 22, color: brand }) }),
        /* @__PURE__ */ jsx20(MartText, { variant: "meta", color: MART.inkQuiet, children: "This phone will be a till at" }),
        /* @__PURE__ */ jsx20(MartText, { variant: "title", children: preview.shopName }),
        /* @__PURE__ */ jsxs17(View19, { style: styles19.summaryRows, children: [
          /* @__PURE__ */ jsx20(SummaryRow, { icon: "git-branch-outline", label: "Branch", value: preview.branchName }),
          /* @__PURE__ */ jsx20(SummaryRow, { icon: "person-outline", label: "You sign in as", value: preview.roleName }),
          preview.tillName ? /* @__PURE__ */ jsx20(SummaryRow, { icon: "pricetag-outline", label: "Till name", value: preview.tillName }) : null
        ] })
      ] }) : /* @__PURE__ */ jsx20(
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
      message ? /* @__PURE__ */ jsxs17(View19, { style: styles19.problemBox, accessibilityLiveRegion: "polite", children: [
        /* @__PURE__ */ jsx20(Ionicons11, { name: "alert-circle-outline", size: 18, color: MART.danger }),
        /* @__PURE__ */ jsx20(MartText, { variant: "body", color: MART.danger, style: styles19.problemText, children: message })
      ] }) : null,
      step === "confirm" ? /* @__PURE__ */ jsx20(
        MartButton,
        {
          label: busy ? "Pairing\u2026" : "Pair this phone",
          busy,
          onPress: () => void pairNow(),
          disabled: busy,
          style: styles19.submit
        }
      ) : /* @__PURE__ */ jsxs17(Fragment4, { children: [
        /* @__PURE__ */ jsx20(
          MartButton,
          {
            label: busy ? "Checking\u2026" : "Continue",
            busy,
            onPress: () => void look(text),
            disabled: busy || text.trim().length === 0,
            style: styles19.submit
          }
        ),
        renderScanner ? /* @__PURE__ */ jsx20(MartButton, { label: "Scan QR code", kind: "quiet", onPress: () => setStep("scan"), disabled: busy }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsx20(Entrance, { delay: 180, style: styles19.footer, children: /* @__PURE__ */ jsxs17(View19, { style: styles19.footerMark, children: [
      /* @__PURE__ */ jsx20(View19, { style: [styles19.footerDot, { backgroundColor: brand }] }),
      /* @__PURE__ */ jsx20(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
    ] }) })
  ] }) });
}
function SummaryRow({
  icon,
  label,
  value
}) {
  return /* @__PURE__ */ jsxs17(View19, { style: styles19.summaryRow, children: [
    /* @__PURE__ */ jsx20(Ionicons11, { name: icon, size: 18, color: MART.inkQuiet }),
    /* @__PURE__ */ jsx20(MartText, { variant: "meta", color: MART.inkQuiet, style: styles19.summaryRowLabel, children: label }),
    /* @__PURE__ */ jsx20(MartText, { variant: "label", numberOfLines: 1, style: styles19.summaryRowValue, children: value })
  ] });
}
var EDGE3 = SPACE.xxl;
var styles19 = StyleSheet21.create({
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
import { useEffect as useEffect12, useMemo as useMemo7, useRef as useRef11, useState as useState13 } from "react";
import { Platform as Platform6, Pressable as Pressable10, ScrollView as ScrollView8, StyleSheet as StyleSheet22, View as View20 } from "react-native";

// src/lib/till-request.ts
import { Linking as Linking2 } from "react-native";
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
    await Linking2.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// src/screens/SignInScreen.tsx
import { Ionicons as Ionicons12 } from "@expo/vector-icons";
import {
  loginWithPassword as loginWithPassword2,
  loginWithPin as loginWithPin2,
  resendVerificationEmail
} from "@kiosk/core";

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
import { cleanDisplayText, isApiError as isApiError2 } from "@kiosk/core";
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
  const shop = cleanDisplayText(context.shopName, 60) || "this shop";
  if (!isApiError2(error)) {
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
    const said = cleanDisplayText(error.message, 160);
    if (said) {
      return { kind: "rejected", message: said, clearSecret: false };
    }
  }
  return { kind: "unknown", message: "Couldn't sign in. Try again.", clearSecret: false };
}

// src/screens/SignInScreen.tsx
import { jsx as jsx21, jsxs as jsxs18 } from "react/jsx-runtime";
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
  const [email, setEmail] = useState13("");
  const [pin, setPin] = useState13("");
  const [password, setPassword] = useState13("");
  const [method, setMethod] = useState13("password");
  const [busy, setBusy] = useState13(false);
  const [problem, setProblem] = useState13(null);
  const [resent, setResent] = useState13(null);
  const secretInput = useRef11(null);
  const mounted = useRef11(true);
  const sending = useRef11(false);
  const wrongTries = useRef11(NO_WRONG_TRIES);
  useEffect12(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const typed = cleanEmail(email);
  const known = knownStaff.find((person) => person.email === typed);
  const greeting = useMemo7(() => {
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
  const initials = useMemo7(() => {
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
      const result = method === "pin" ? await loginWithPin2(baseURL, typed, pin) : await loginWithPassword2(baseURL, typed, password);
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
      await resendVerificationEmail(baseURL, typed);
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
  return /* @__PURE__ */ jsx21(Screen, { style: styles20.container, children: /* @__PURE__ */ jsxs18(ScrollView8, { contentContainerStyle: styles20.form, keyboardShouldPersistTaps: "handled", children: [
    /* @__PURE__ */ jsxs18(Entrance, { delay: 0, style: [styles20.pass, { backgroundColor: brand }], children: [
      /* @__PURE__ */ jsx21(View20, { style: [styles20.glow, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx21(View20, { style: [styles20.orb, styles20.orbOne, { backgroundColor: on.wash }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx21(View20, { style: [styles20.orb, styles20.orbTwo, { backgroundColor: on.hairline }], pointerEvents: "none" }),
      /* @__PURE__ */ jsx21(View20, { style: styles20.lacquer, pointerEvents: "none" }),
      /* @__PURE__ */ jsxs18(View20, { style: styles20.passTop, children: [
        /* @__PURE__ */ jsxs18(View20, { style: styles20.passBrand, children: [
          /* @__PURE__ */ jsx21(View20, { style: [styles20.plaque, { backgroundColor: on.primary }], children: /* @__PURE__ */ jsx21(MartText, { variant: "title", color: brand, style: styles20.plaqueMark, children: initials }) }),
          /* @__PURE__ */ jsxs18(View20, { style: styles20.passNames, children: [
            /* @__PURE__ */ jsx21(MartText, { variant: "shelf", color: on.secondary, numberOfLines: 1, style: styles20.passEyebrow, children: (shopName ?? "YOUR SHOP").toUpperCase() }),
            /* @__PURE__ */ jsx21(MartText, { variant: "heading", color: on.primary, children: "Staff sign-in" })
          ] })
        ] }),
        onChangeStore ? /* @__PURE__ */ jsx21(
          Pressable10,
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
            children: /* @__PURE__ */ jsx21(MartText, { variant: "shelf", color: on.primary, style: styles20.storeChipText, children: "Change store" })
          }
        ) : null
      ] }),
      /* @__PURE__ */ jsx21(MartText, { variant: "display", color: on.primary, style: styles20.passTitle, children: firstName ? `${greeting}, ${firstName}.` : `${greeting}.` }),
      /* @__PURE__ */ jsx21(MartText, { variant: "body", color: on.secondary, style: styles20.passHint, children: known ? "Your PIN and the shelf are ready. Your shift picks up where it left off." : "Sign in with your email and PIN or password." })
    ] }),
    /* @__PURE__ */ jsxs18(View20, { style: styles20.formBody, children: [
      /* @__PURE__ */ jsx21(CardGloss, { radius: RADIUS.xl }),
      notice ? /* @__PURE__ */ jsx21(View20, { style: styles20.noticeBox, accessibilityLiveRegion: "polite", children: /* @__PURE__ */ jsx21(MartText, { variant: "body", color: MART.inkMuted, children: notice }) }) : null,
      knownStaff.length > 0 ? /* @__PURE__ */ jsxs18(View20, { style: styles20.people, children: [
        /* @__PURE__ */ jsx21(MartText, { variant: "label", color: MART.inkMuted, style: styles20.peopleLabel, children: "Who's signing in?" }),
        /* @__PURE__ */ jsx21(ScrollView8, { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles20.peopleRow, children: knownStaff.map((person) => {
          const on2 = typed === person.email;
          const parts = (person.name || person.email).trim().split(/\s+/).filter(Boolean);
          const mark = (parts[0]?.[0] ?? "?").toUpperCase();
          return /* @__PURE__ */ jsxs18(
            Pressable10,
            {
              onPress: () => pick(person),
              accessibilityRole: "button",
              accessibilityLabel: `Sign in as ${person.name || person.email}`,
              accessibilityState: { selected: on2 },
              style: ({ pressed }) => [styles20.person, on2 && styles20.personOn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ jsx21(View20, { style: [styles20.personMark, on2 && { backgroundColor: brand }], children: /* @__PURE__ */ jsx21(MartText, { variant: "label", color: on2 ? onFill(brand).primary : MART.ink, children: mark }) }),
                /* @__PURE__ */ jsxs18(View20, { style: styles20.personText, children: [
                  /* @__PURE__ */ jsx21(MartText, { variant: "label", numberOfLines: 1, children: person.name || person.email }),
                  person.name ? /* @__PURE__ */ jsx21(MartText, { variant: "meta", color: MART.inkQuiet, numberOfLines: 1, children: person.email }) : null
                ] })
              ]
            },
            person.email
          );
        }) })
      ] }) : null,
      /* @__PURE__ */ jsx21(Entrance, { delay: 90, children: /* @__PURE__ */ jsx21(
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
      known ? /* @__PURE__ */ jsx21(Pressable10, { onPress: notYou, accessibilityRole: "button", accessibilityLabel: "Not you? Remove from this phone", hitSlop: 8, style: styles20.notYou, children: /* @__PURE__ */ jsx21(MartText, { variant: "meta", style: styles20.link, children: "Not you? Remove from this phone" }) }) : null,
      /* @__PURE__ */ jsx21(Entrance, { delay: 150, children: method === "pin" ? /* @__PURE__ */ jsx21(
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
      ) : /* @__PURE__ */ jsx21(
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
      problem ? /* @__PURE__ */ jsxs18(View20, { accessibilityLiveRegion: "polite", style: styles20.problemBox, children: [
        /* @__PURE__ */ jsx21(MartText, { variant: "body", color: MART.danger, children: problem.message }),
        problem.kind === "not_approved_till" ? /* @__PURE__ */ jsxs18(View20, { style: styles20.askRow, children: [
          /* @__PURE__ */ jsxs18(
            Pressable10,
            {
              onPress: () => void askOwner("whatsapp", ask),
              accessibilityRole: "button",
              accessibilityLabel: "Ask the owner on WhatsApp",
              style: ({ pressed }) => [styles20.askBtn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ jsx21(Ionicons12, { name: "logo-whatsapp", size: 16, color: MART.fallbackPrimary }),
                /* @__PURE__ */ jsx21(MartText, { variant: "label", color: MART.fallbackPrimary, children: "WhatsApp the owner" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs18(
            Pressable10,
            {
              onPress: () => void askOwner("email", ask),
              accessibilityRole: "button",
              accessibilityLabel: "Ask the owner by email",
              style: ({ pressed }) => [styles20.askBtn, pressed && styles20.pressed],
              children: [
                /* @__PURE__ */ jsx21(Ionicons12, { name: "mail-outline", size: 16, color: MART.fallbackPrimary }),
                /* @__PURE__ */ jsx21(MartText, { variant: "label", color: MART.fallbackPrimary, children: "Email" })
              ]
            }
          )
        ] }) : null,
        problem.action === "resend_verification" ? /* @__PURE__ */ jsx21(MartButton, { label: "Send the link again", kind: "quiet", onPress: resend, disabled: busy, style: styles20.problemAction }) : null,
        problem.action === "pair" && onPair ? /* @__PURE__ */ jsx21(MartButton, { label: "Pair this phone", kind: "quiet", onPress: onPair, disabled: busy, style: styles20.problemAction }) : null,
        resent ? /* @__PURE__ */ jsx21(MartText, { variant: "meta", color: MART.inkQuiet, style: styles20.resent, children: resent }) : null
      ] }) : null,
      /* @__PURE__ */ jsx21(Entrance, { delay: 210, children: /* @__PURE__ */ jsx21(MartButton, { label: busy ? "Signing in\u2026" : "Sign in", busy, onPress: submit, disabled: !ready || busy, style: styles20.submit }) }),
      allowPassword ? /* @__PURE__ */ jsx21(
        MartButton,
        {
          label: method === "pin" ? "Use password instead" : "Use PIN instead",
          kind: "quiet",
          onPress: switchMethod,
          disabled: busy,
          style: styles20.secondary
        }
      ) : null,
      pairingEnabled && onPair && problem?.action !== "pair" ? /* @__PURE__ */ jsx21(Pressable10, { onPress: onPair, accessibilityRole: "button", accessibilityLabel: "Pair this phone with a code", hitSlop: 8, style: styles20.pairLink, children: /* @__PURE__ */ jsx21(MartText, { variant: "meta", style: styles20.link, children: "New phone? Pair it with a code" }) }) : null
    ] }),
    /* @__PURE__ */ jsxs18(Entrance, { delay: 270, style: styles20.footer, children: [
      /* @__PURE__ */ jsx21(MartText, { variant: "meta", color: MART.inkQuiet, style: styles20.footerText, children: "Trouble signing in? Ask the shop owner to reset your PIN." }),
      /* @__PURE__ */ jsxs18(View20, { style: styles20.footerMark, children: [
        /* @__PURE__ */ jsx21(View20, { style: [styles20.footerDot, { backgroundColor: brand }] }),
        /* @__PURE__ */ jsx21(MartText, { variant: "shelf", color: MART.inkQuiet, children: "POWERED BY KIOSK" })
      ] })
    ] })
  ] }) });
}
var EDGE4 = SPACE.xxl;
var styles20 = StyleSheet22.create({
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
    paddingTop: Platform6.select({ ios: 72, android: 40, default: 72 }),
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
import { Fragment as Fragment5, jsx as jsx22, jsxs as jsxs19 } from "react/jsx-runtime";
var SESSION_ENDED = "You were signed out. Sign in again.";
function openShop() {
  return useAuthStore.getState().tenant?.slug;
}
function StaffShell({ app, baseURL, allowPassword = false, isTill = false, exportUnsent, onRemoved, renderScanner, children }) {
  const [fontsLoaded, fontsError] = useFonts({
    SandeMore_400Regular: require_SandeMore_Regular(),
    SandeMore_500Medium: require_SandeMore_Medium(),
    SandeMore_700Bold: require_SandeMore_Bold(),
    SandeMore_800ExtraBold: require_SandeMore_ExtraBold(),
    DMSans_400Regular: require_DMSans_Regular(),
    DMSans_500Medium: require_DMSans_Medium(),
    DMSans_600SemiBold: require_DMSans_SemiBold(),
    DMSans_700Bold: require_DMSans_Bold(),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold
  });
  const { tenant, setTenant, setBranch, setEmail, setAuthenticated, reset } = useAuthStore();
  const stageRef = useRef12({ name: "signin" });
  const { phase, setPhase, bootError, retry } = useStaffBoot(
    baseURL,
    setTenant,
    (url) => mayFollowShopLink(stageRef.current.name, parseTenantDeepLink(url), useAuthStore.getState().tenant)
  );
  const [stage, setStage] = useState14({ name: "signin" });
  const [banner, setBanner] = useState14(null);
  const [known, setKnown] = useState14([]);
  const [platform, setPlatform] = useState14(null);
  const [unsent, setUnsent] = useState14(0);
  const [busy, setBusy] = useState14(false);
  const attempt = useRef12(0);
  const typedEmail = useRef12("");
  const go = useCallback9((next) => {
    stageRef.current = next;
    setStage(next);
  }, []);
  const canChangeStore = !getEmbeddedTenantSlug3();
  const pairingEnabled = platform?.pairingEnabled === true;
  const tenantId = tenant?.businessId ?? null;
  const tenantSlug = tenant?.slug ?? null;
  const shopName = tenant?.displayName ?? getTenantDisplayName2() ?? void 0;
  const appTitle = `${shopName ?? "Kiosk"} ${APP_NAMES2[app]}`;
  const api = useMemo8(
    () => createApiClient({
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
  const coldStart = useRef12(true);
  useEffect13(() => {
    if (!tenantSlug || !coldStart.current) return;
    coldStart.current = false;
    void endSession(baseURL).catch(() => void 0);
  }, [tenantSlug, baseURL]);
  useEffect13(() => {
    let alive = true;
    void fetchPlatformConfig(baseURL).then((config) => {
      if (alive) setPlatform(config);
    });
    return () => {
      alive = false;
    };
  }, [baseURL]);
  useEffect13(() => {
    attempt.current += 1;
    go({ name: "signin" });
    setBanner(null);
    setAuthenticated(false);
    setKnown([]);
    setUnsent(0);
  }, [tenantSlug, go, setAuthenticated]);
  useEffect13(() => {
    if (!tenantId || stage.name !== "signin") return;
    let alive = true;
    void loadKnownStaff(tenantId).then((people) => {
      if (alive) setKnown(people);
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);
  useEffect13(() => {
    if (!tenantId || stage.name !== "removed") return;
    let alive = true;
    void getUnsentSummary2(tenantId).then((summary) => {
      if (alive) setUnsent(summary.total);
    }).catch(() => void 0);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);
  const questions = useCallback9(
    (id) => ({
      app,
      loadMe: () => fetchMe(api),
      loadBranches: () => fetchBranches2(baseURL),
      ...isTill ? {
        checkTill: (branchId) => checkTillRegistration(api, id, branchId),
        askTillAccess: async (branchId) => {
          const deviceKey = await getOrCreateTillDeviceId2(id);
          if (!deviceKey) return;
          await requestTillAccess(api, { branchId, deviceKey });
        },
        // A shop that runs without shifts says so in its public settings, which need no sign-in.
        loadShiftsDisabled: () => fetchShiftsDisabled(baseURL, useAuthStore.getState().tenant?.host)
      } : {}
    }),
    [api, app, baseURL, isTill]
  );
  const arrive = useCallback9(
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
        if (id && email) void rememberStaff({ email, name: next.user.name }, id).catch(() => void 0);
      } else {
        setAuthenticated(false);
        if (next.name === "removed" && id) {
          void clearKnownStaff(id).catch(() => void 0);
          if (onRemoved) void Promise.resolve(onRemoved(id)).catch(() => void 0);
        }
        if (endsSessionOn(next.name)) void endSession(baseURL).catch(() => void 0);
      }
      go(next);
    },
    [baseURL, go, onRemoved, setAuthenticated, setBranch, setEmail]
  );
  const enter = useCallback9(async () => {
    const shop = useAuthStore.getState().tenant;
    if (!shop) return;
    const mine = ++attempt.current;
    go({ name: "checking" });
    const next = await enterApp(questions(shop.businessId));
    if (wantsEntryAnswer({ attempt: mine, shop: shop.slug }, { attempt: attempt.current, shop: openShop() })) arrive(next);
  }, [arrive, go, questions]);
  const choose = useCallback9(
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
  const leaving = useRef12(false);
  const signOut = useCallback9(async () => {
    if (leaving.current) return false;
    leaving.current = true;
    try {
      if (!await confirmSignOut(useAuthStore.getState().tenant?.displayName)) return false;
      attempt.current += 1;
      const id = useAuthStore.getState().tenant?.businessId;
      const wasRemoved = stageRef.current.name === "removed";
      go({ name: "signing_out" });
      try {
        await endSession(baseURL);
      } catch {
      }
      if (wasRemoved && id) await forgetTillRegistered(id).catch(() => void 0);
      setAuthenticated(false);
      setBanner(null);
      go({ name: "signin" });
      return true;
    } finally {
      leaving.current = false;
    }
  }, [baseURL, go, setAuthenticated]);
  const changeStore = useCallback9(async () => {
    if (!canChangeStore) return;
    if (!await leaveStore(useAuthStore.getState().tenant?.displayName)) return;
    attempt.current += 1;
    reset();
    go({ name: "signin" });
    setPhase("tenant");
  }, [canChangeStore, go, reset, setPhase]);
  const signedIn = useCallback9(
    (details) => {
      const verdict = judgeSignIn(details.shop, { shop: openShop(), stage: stageRef.current.name });
      if (verdict === "drop") return;
      if (verdict === "end") {
        void endSession(baseURL).catch(() => void 0);
        return;
      }
      typedEmail.current = details.email;
      setBanner(null);
      void enter();
    },
    [baseURL, enter]
  );
  const forget = useCallback9(
    (email) => {
      setKnown((people) => removeKnownStaff(people, email));
      if (tenantId) void forgetKnownStaff(email, tenantId).catch(() => void 0);
    },
    [tenantId]
  );
  if (!fontsLoaded && !fontsError || phase === "loading") return /* @__PURE__ */ jsx22(View21, { style: styles21.blank });
  if (phase === "error" && bootError) return /* @__PURE__ */ jsx22(WhiteLabelErrorScreen, { message: bootError, onRetry: retry });
  if (phase === "tenant" || !tenant) {
    return /* @__PURE__ */ jsx22(
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
      return /* @__PURE__ */ jsxs19(View21, { style: styles21.center, accessibilityLiveRegion: "polite", children: [
        /* @__PURE__ */ jsx22(ActivityIndicator3, { color: theme3.colors.primary }),
        /* @__PURE__ */ jsx22(Text6, { variant: "muted", style: styles21.checking, children: stage.name === "checking" ? "Checking your account..." : "Signing out..." })
      ] });
    case "signin":
      return /* @__PURE__ */ jsx22(
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
      return /* @__PURE__ */ jsx22(
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
      return /* @__PURE__ */ jsx22(
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
      return /* @__PURE__ */ jsx22(Fragment5, { children: children({
        api,
        tenant,
        user: stage.user,
        branchId: stage.branchId,
        branchName: stage.branchName,
        shiftsDisabled: shiftsAreDisabled(tenant) || stage.shiftsDisabled,
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
            if (notice.webUrl) await Linking3.openURL(notice.webUrl).catch(() => void 0);
            return;
          case "save_unsent":
            setBusy(true);
            try {
              await exportUnsent?.();
            } catch {
              Alert4.alert("Could not save the sales", "They are still on this phone. Try again.");
            } finally {
              setBusy(false);
            }
            return;
          case "pair":
            go({ name: "pairing" });
            return;
        }
      };
      return /* @__PURE__ */ jsx22(NoticeScreen, { notice: { ...notice, actions }, onAction: (id) => void act(id), busy });
    }
  }
}
var styles21 = StyleSheet23.create({
  blank: { flex: 1, backgroundColor: MART.paper },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme3.colors.background },
  checking: { marginTop: theme3.spacing.md }
});

// src/index.ts
var DM_SANS = {
  DMSans_400Regular: require_DMSans_Regular(),
  DMSans_500Medium: require_DMSans_Medium(),
  DMSans_600SemiBold: require_DMSans_SemiBold(),
  DMSans_700Bold: require_DMSans_Bold()
};
export {
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
};
