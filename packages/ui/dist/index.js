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
  Button: () => Button,
  Card: () => Card,
  Text: () => Text2,
  theme: () => theme
});
module.exports = __toCommonJS(index_exports);

// src/components/Button.tsx
var import_react_native = require("react-native");

// src/theme.ts
var theme = {
  colors: {
    primary: "#28a745",
    primaryDark: "#1e7e34",
    background: "#ffffff",
    surface: "#f8f9fa",
    text: "#212529",
    textMuted: "#6c757d",
    border: "#dee2e6",
    danger: "#dc3545",
    warning: "#ffc107",
    success: "#28a745"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16
  }
};

// src/components/Button.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function Button({ title, onPress, variant = "primary", disabled, style, textStyle }) {
  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.danger
  }[variant];
  const color = variant === "secondary" ? theme.colors.text : "#ffffff";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_react_native.TouchableOpacity,
    {
      onPress,
      disabled,
      activeOpacity: 0.8,
      style: [styles.button, { backgroundColor }, disabled && styles.disabled, style],
      accessibilityRole: "button",
      accessibilityLabel: title,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: [styles.text, { color }, textStyle], children: title })
    }
  );
}
var styles = import_react_native.StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  disabled: {
    opacity: 0.6
  },
  text: {
    fontSize: 16,
    fontWeight: "600"
  }
});

// src/components/Card.tsx
var import_react_native2 = require("react-native");
var import_jsx_runtime2 = require("react/jsx-runtime");
function Card({ children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: [styles2.card, style], children });
}
var styles2 = import_react_native2.StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  }
});

// src/components/Text.tsx
var import_react_native3 = require("react-native");
var import_jsx_runtime3 = require("react/jsx-runtime");
function Text2({ variant = "body", style, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_react_native3.Text, { style: [styles3.base, styles3[variant], style], ...props });
}
var styles3 = import_react_native3.StyleSheet.create({
  base: {
    color: theme.colors.text
  },
  h1: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: theme.spacing.md
  },
  h2: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: theme.spacing.sm
  },
  body: {
    fontSize: 16,
    lineHeight: 24
  },
  caption: {
    fontSize: 14,
    lineHeight: 20
  },
  muted: {
    fontSize: 14,
    color: theme.colors.textMuted
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Button,
  Card,
  Text,
  theme
});
