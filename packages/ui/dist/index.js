"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Banner: () => Banner,
  Button: () => Button,
  Card: () => Card,
  Chip: () => Chip,
  FONT: () => FONT,
  Field: () => Field,
  Row: () => Row,
  Text: () => Text2,
  WEIGHT: () => WEIGHT,
  resetUiFont: () => resetUiFont,
  setUiFont: () => setUiFont,
  theme: () => theme
});
module.exports = __toCommonJS(index_exports);

// src/components/Button.tsx
var import_react = require("react");
var import_react_native2 = require("react-native");

// src/theme.ts
var theme = {
  colors: {
    // Amber is the accent only (the primary button, active states), not a fill background.
    primary: "#F08A24",
    primaryDark: "#D97515",
    /** The ground of every screen: the counter's warm cream. */
    background: "#FBF7F1",
    /** Cards and fields: pure white, set apart by a hairline, not a shadow. */
    surface: "#ffffff",
    /** A quiet sunken well: pressed tiles, skeleton bones. */
    surfaceSunken: "#F6F1E8",
    text: "#17130D",
    textMuted: "#6B6357",
    /** Darkest quiet tone that still clears 4.5:1 on the background. */
    textQuiet: "#9C9384",
    /** Hairline dividers and card edges. */
    border: "#EDE6DA",
    borderStrong: "#DCD2C2",
    danger: "#a8281b",
    warning: "#7a5a00",
    success: "#2f6b12"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    // Rounder, in step with mart: capsule controls, soft tiles.
    sm: 10,
    md: 16,
    lg: 22,
    xl: 32
  }
};

// src/type.ts
var import_react_native = require("react-native");
var SYSTEM_FACE = import_react_native.Platform.select({ ios: "System", android: "sans-serif", default: "System" });
var FONT = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
  black: "DMSans_700Bold"
};
function setUiFont(family) {
  FONT.regular = family.regular;
  FONT.medium = family.medium;
  FONT.semibold = family.semibold;
  FONT.bold = family.bold;
  FONT.black = family.black;
}
function resetUiFont() {
  setUiFont({ regular: SYSTEM_FACE, medium: SYSTEM_FACE, semibold: SYSTEM_FACE, bold: SYSTEM_FACE, black: SYSTEM_FACE });
}
var WEIGHT = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  black: "800"
};

// src/components/Button.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var EASE_OUT = import_react_native2.Easing.bezier(0.16, 1, 0.3, 1);
function tintedLift(fill) {
  return {
    shadowColor: fill,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4
  };
}
function Button({ title, onPress, variant = "primary", disabled, style, textStyle }) {
  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.danger
  }[variant];
  const color = variant === "secondary" ? theme.colors.text : "#fffdf6";
  const scale = (0, import_react.useRef)(new import_react_native2.Animated.Value(1)).current;
  const press = (to, duration) => import_react_native2.Animated.timing(scale, { toValue: to, duration, easing: EASE_OUT, useNativeDriver: true }).start();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Animated.View, { style: { transform: [{ scale }] }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_react_native2.Pressable,
    {
      onPress,
      disabled,
      onPressIn: () => !disabled && press(0.97, 130),
      onPressOut: () => press(1, 220),
      style: [
        styles.button,
        { backgroundColor },
        // Secondary is an outlined capsule on white; the fills carry the colour and a soft lift in that colour.
        variant === "secondary" ? styles.outlined : !disabled ? tintedLift(backgroundColor) : null,
        disabled && styles.disabled,
        style
      ],
      accessibilityRole: "button",
      accessibilityLabel: title,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.Text, { style: [styles.text, { color }, textStyle], children: title })
    }
  ) });
}
var styles = import_react_native2.StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong
  },
  disabled: {
    opacity: 0.55
  },
  text: {
    fontFamily: FONT.medium,
    fontWeight: WEIGHT.medium,
    fontSize: 15,
    letterSpacing: -0.1
  }
});

// src/components/Card.tsx
var import_react_native3 = require("react-native");
var import_jsx_runtime2 = require("react/jsx-runtime");
function Card({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native3.View, { style: [styles2.card, style], children });
}
var styles2 = import_react_native3.StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: import_react_native3.StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: "#1a2416",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2
  }
});

// src/components/Text.tsx
var import_react_native4 = require("react-native");
var import_jsx_runtime3 = require("react/jsx-runtime");
function Text2({ variant = "body", style, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native4.Text, { style: [styles3.base, styles3[variant], style], ...props });
}
var styles3 = import_react_native4.StyleSheet.create({
  base: {
    color: theme.colors.text,
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular
  },
  h1: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: theme.spacing.md
  },
  h2: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: theme.spacing.sm
  },
  body: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 15,
    lineHeight: 22
  },
  caption: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 19
  },
  muted: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted
  }
});

// src/components/Banner.tsx
var import_react_native5 = require("react-native");
var import_jsx_runtime4 = require("react/jsx-runtime");
var TONES = {
  info: { background: "#cfe8ff", border: "#aed4fb", text: "#0b5cab" },
  warn: { background: "#fbf3a0", border: "#f3e67a", text: "#7a5a00" },
  danger: { background: "#ffd5cd", border: "#f7b6aa", text: "#a8281b" },
  ok: { background: "#d9f0c6", border: "#bfe3a4", text: "#2f6b12" }
};
function Banner({ tone = "info", children, style }) {
  const colors = TONES[tone];
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    import_react_native5.View,
    {
      accessibilityRole: tone === "warn" || tone === "danger" ? "alert" : void 0,
      style: [styles4.box, { backgroundColor: colors.background, borderColor: colors.border }, style],
      children: typeof children === "string" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Text2, { variant: "caption", style: { color: colors.text }, children }) : children
    }
  );
}
var styles4 = import_react_native5.StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm
  }
});

// src/components/Field.tsx
var import_react2 = require("react");
var import_react_native6 = require("react-native");
var import_jsx_runtime5 = require("react/jsx-runtime");
function Field({ label, error, hint, style, onFocus, onBlur, ...input }) {
  const [focused, setFocused] = (0, import_react2.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native6.View, { style: [styles5.wrap, style], children: [
    label ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Text2, { variant: "caption", style: styles5.label, children: label }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      import_react_native6.TextInput,
      {
        placeholderTextColor: theme.colors.textMuted,
        autoCorrect: false,
        accessibilityLabel: label ?? input.placeholder,
        ...input,
        onFocus: (e) => {
          setFocused(true);
          onFocus?.(e);
        },
        onBlur: (e) => {
          setFocused(false);
          onBlur?.(e);
        },
        style: [styles5.input, focused && !error ? styles5.inputFocused : null, error ? styles5.inputError : null]
      }
    ),
    error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Text2, { variant: "caption", style: styles5.error, children: error }) : hint ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Text2, { variant: "muted", children: hint }) : null
  ] });
}
var styles5 = import_react_native6.StyleSheet.create({
  wrap: { marginBottom: theme.spacing.sm },
  label: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, marginBottom: theme.spacing.xs },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface
  },
  // Active: the edge brightens to the brand green and the box lifts with a faint green-tinted ring.
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, marginTop: theme.spacing.xs }
});

// src/components/Row.tsx
var import_react_native7 = require("react-native");
var import_jsx_runtime6 = require("react/jsx-runtime");
var TONES2 = { normal: theme.colors.text, warn: theme.colors.warning, danger: theme.colors.danger, ok: theme.colors.success };
function Row({ title, subtitle, right, rightTone = "normal", onPress, disabled, style }) {
  const body = /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_react_native7.View, { style: styles6.left, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Text2, { style: styles6.title, numberOfLines: 2, children: title }),
      subtitle ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Text2, { variant: "muted", numberOfLines: 2, children: subtitle }) : null
    ] }),
    right ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Text2, { style: { ...styles6.right, color: TONES2[rightTone] }, children: right }) : null
  ] });
  if (!onPress) return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_react_native7.View, { style: [styles6.row, style], children: body });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    import_react_native7.Pressable,
    {
      onPress,
      disabled,
      accessibilityRole: "button",
      accessibilityLabel: subtitle ? `${title}. ${subtitle}` : title,
      style: ({ pressed }) => [styles6.row, pressed && styles6.pressed, disabled && styles6.disabled, style],
      children: body
    }
  );
}
var styles6 = import_react_native7.StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: import_react_native7.StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  pressed: { backgroundColor: theme.colors.surfaceSunken },
  disabled: { opacity: 0.5 },
  left: { flex: 1, paddingRight: theme.spacing.sm },
  title: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 15, letterSpacing: -0.2 },
  right: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 15, letterSpacing: -0.2 }
});

// src/components/Chip.tsx
var import_react_native8 = require("react-native");
var import_jsx_runtime7 = require("react/jsx-runtime");
function Chip({ label, selected = false, onPress, disabled, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    import_react_native8.Pressable,
    {
      onPress,
      disabled,
      accessibilityRole: "button",
      accessibilityState: { selected, disabled: !!disabled },
      style: [styles7.chip, selected && styles7.selected, disabled && styles7.disabled, style],
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Text2, { variant: "caption", style: selected ? styles7.labelSelected : styles7.label, children: label })
    }
  );
}
var styles7 = import_react_native8.StyleSheet.create({
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  labelSelected: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, color: "#fffdf6" }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Banner,
  Button,
  Card,
  Chip,
  FONT,
  Field,
  Row,
  Text,
  WEIGHT,
  resetUiFont,
  setUiFont,
  theme
});
