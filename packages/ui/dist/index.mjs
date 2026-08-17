// src/components/Button.tsx
import { TouchableOpacity, Text, StyleSheet } from "react-native";

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
import { jsx } from "react/jsx-runtime";
function Button({ title, onPress, variant = "primary", disabled, style, textStyle }) {
  const backgroundColor = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.danger
  }[variant];
  const color = variant === "secondary" ? theme.colors.text : "#ffffff";
  return /* @__PURE__ */ jsx(
    TouchableOpacity,
    {
      onPress,
      disabled,
      activeOpacity: 0.8,
      style: [styles.button, { backgroundColor }, disabled && styles.disabled, style],
      accessibilityRole: "button",
      accessibilityLabel: title,
      children: /* @__PURE__ */ jsx(Text, { style: [styles.text, { color }, textStyle], children: title })
    }
  );
}
var styles = StyleSheet.create({
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
import { View, StyleSheet as StyleSheet2 } from "react-native";
import { jsx as jsx2 } from "react/jsx-runtime";
function Card({ children, style }) {
  return /* @__PURE__ */ jsx2(View, { style: [styles2.card, style], children });
}
var styles2 = StyleSheet2.create({
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
import { Text as RNText, StyleSheet as StyleSheet3 } from "react-native";
import { jsx as jsx3 } from "react/jsx-runtime";
function Text2({ variant = "body", style, ...props }) {
  return /* @__PURE__ */ jsx3(RNText, { style: [styles3.base, styles3[variant], style], ...props });
}
var styles3 = StyleSheet3.create({
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
export {
  Button,
  Card,
  Text2 as Text,
  theme
};
