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
import { useCallback, useEffect, useState } from "react";
import { Linking } from "react-native";
import {
  bootstrapTenant,
  getEmbeddedTenantSlug,
  isStaffDeepLinkIntent,
  resolveTenantFromDeepLink,
  tenantHostSuffix,
  useTenantDeepLink
} from "@kiosk/core";
async function tryResolveStaffDeepLink(url, baseURL) {
  if (!url?.trim()) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, baseURL, {
    hostSuffixes: [tenantHostSuffix()]
  });
  if (!result || !isStaffDeepLinkIntent(result.intent)) {
    return null;
  }
  return result.tenant;
}
function useStaffBoot(baseURL, setTenant) {
  const [phase, setPhase] = useState("loading");
  const [bootError, setBootError] = useState(null);
  const applyDeepLinkTenant = useCallback(
    (tenant) => {
      setTenant(tenant);
      setBootError(null);
      setPhase("branch");
    },
    [setTenant]
  );
  const runBootstrap = useCallback(async () => {
    setPhase("loading");
    setBootError(null);
    try {
      const initialUrl = await Linking.getInitialURL();
      const fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
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
  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);
  useTenantDeepLink(async (url) => {
    try {
      const tenant = await tryResolveStaffDeepLink(url, baseURL);
      if (!tenant) {
        return;
      }
      applyDeepLinkTenant(tenant);
    } catch {
    }
  });
  return { phase, setPhase, bootError, retry: runBootstrap };
}

// src/hooks/useStaffAuthNavigation.ts
import { useCallback as useCallback2 } from "react";
import { clearTenant, getEmbeddedTenantSlug as getEmbeddedTenantSlug2 } from "@kiosk/core";
function useStaffAuthNavigation(setPhase, onLeaveStore) {
  const { reset, setBranch } = useAuthStore();
  const canChangeStore = !getEmbeddedTenantSlug2();
  const goToTenant = useCallback2(async () => {
    if (!canChangeStore) {
      return;
    }
    await clearTenant();
    reset();
    onLeaveStore?.();
    setPhase("tenant");
  }, [canChangeStore, onLeaveStore, reset, setPhase]);
  const goToBranch = useCallback2(() => {
    setBranch(null);
    setPhase("branch");
  }, [setBranch, setPhase]);
  return { canChangeStore, goToTenant, goToBranch };
}

// src/screens/TenantEntryScreen.tsx
import { useState as useState2 } from "react";
import { StyleSheet as StyleSheet2, View as View2, TextInput, Alert } from "react-native";
import { Button, Text as Text2, theme as theme2 } from "@kiosk/ui";
import { resolveTenant, resolveTenantByEmail } from "@kiosk/core";

// src/components/AuthBackBar.tsx
import { useEffect as useEffect2 } from "react";
import {
  BackHandler,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View
} from "react-native";
import { Text, theme } from "@kiosk/ui";
import { jsx, jsxs } from "react/jsx-runtime";
function AuthBackBar({
  onBack,
  backLabel = "Back",
  onSecondary,
  secondaryLabel
}) {
  useEffect2(() => {
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
    return /* @__PURE__ */ jsx(View, { style: styles.spacer });
  }
  return /* @__PURE__ */ jsxs(View, { style: styles.bar, children: [
    onBack ? /* @__PURE__ */ jsx(
      Pressable,
      {
        onPress: onBack,
        accessibilityRole: "button",
        accessibilityLabel: backLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles.hit, pressed && styles.pressed],
        children: /* @__PURE__ */ jsx(Text, { style: styles.label, children: backLabel })
      }
    ) : /* @__PURE__ */ jsx(View, {}),
    onSecondary && secondaryLabel ? /* @__PURE__ */ jsx(
      Pressable,
      {
        onPress: onSecondary,
        accessibilityRole: "button",
        accessibilityLabel: secondaryLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles.hit, pressed && styles.pressed],
        children: /* @__PURE__ */ jsx(Text, { style: styles.secondary, children: secondaryLabel })
      }
    ) : null
  ] });
}
var styles = StyleSheet.create({
  spacer: {
    height: Platform.OS === "android" ? StatusBar.currentHeight ?? 16 : 48
  },
  bar: {
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 12) + 8 : 52,
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

// src/screens/TenantEntryScreen.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }) {
  const [input, setInput] = useState2("");
  const [email, setEmail] = useState2("");
  const [loading, setLoading] = useState2(false);
  const [showEmailFallback, setShowEmailFallback] = useState2(false);
  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const tenant = await resolveTenant(input.trim(), baseURL);
      onTenantResolved(tenant);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not resolve tenant");
    } finally {
      setLoading(false);
    }
  };
  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await resolveTenantByEmail(baseURL, email.trim());
      const tenant = await resolveTenant(result.host, baseURL);
      onTenantResolved(tenant);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not find tenant for email");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsxs2(View2, { style: styles2.container, children: [
    /* @__PURE__ */ jsx2(AuthBackBar, {}),
    /* @__PURE__ */ jsxs2(View2, { style: styles2.form, children: [
      /* @__PURE__ */ jsx2(Text2, { variant: "h1", children: appTitle }),
      /* @__PURE__ */ jsx2(Text2, { variant: "body", style: styles2.subtitle, children: "Enter your business slug or host" }),
      /* @__PURE__ */ jsx2(
        TextInput,
        {
          style: styles2.input,
          placeholder: "e.g. palmart",
          value: input,
          onChangeText: setInput,
          autoCapitalize: "none",
          autoCorrect: false,
          accessibilityLabel: "Business slug or host"
        }
      ),
      /* @__PURE__ */ jsx2(Button, { title: loading ? "Loading..." : "Continue", onPress: resolve, disabled: loading }),
      /* @__PURE__ */ jsx2(
        Button,
        {
          title: showEmailFallback ? "Hide email lookup" : "Find by email",
          variant: "secondary",
          onPress: () => setShowEmailFallback((v) => !v),
          style: styles2.secondary
        }
      ),
      showEmailFallback && /* @__PURE__ */ jsxs2(Fragment, { children: [
        /* @__PURE__ */ jsx2(
          TextInput,
          {
            style: styles2.input,
            placeholder: "Staff email",
            value: email,
            onChangeText: setEmail,
            autoCapitalize: "none",
            keyboardType: "email-address",
            accessibilityLabel: "Staff email"
          }
        ),
        /* @__PURE__ */ jsx2(
          Button,
          {
            title: "Look up tenant",
            variant: "secondary",
            onPress: resolveByEmail,
            disabled: loading
          }
        )
      ] })
    ] })
  ] });
}
var styles2 = StyleSheet2.create({
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
  subtitle: {
    marginBottom: theme2.spacing.lg,
    color: theme2.colors.textMuted
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

// src/screens/PinLoginScreen.tsx
import { useState as useState3 } from "react";
import { StyleSheet as StyleSheet3, View as View3, TextInput as TextInput2, Alert as Alert2 } from "react-native";
import { Button as Button2, Text as Text3, theme as theme3 } from "@kiosk/ui";
import { loginWithPin, loginWithPassword, fetchBranches } from "@kiosk/core";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
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
  const [email, setEmail] = useState3("");
  const [pin, setPin] = useState3("");
  const [password, setPassword] = useState3("");
  const [usePassword, setUsePassword] = useState3(false);
  const [loading, setLoading] = useState3(false);
  const login = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      if (usePassword && allowPassword) {
        await loginWithPassword(baseURL, email.trim(), password);
      } else {
        if (pin.length < 4) {
          Alert2.alert("Error", "Enter your PIN");
          return;
        }
        await loginWithPin(baseURL, email.trim(), pin, branchId);
      }
      const branches = await fetchBranches(baseURL);
      onSuccess(branches);
    } catch (e) {
      Alert2.alert("Login failed", e instanceof Error ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };
  const contextBits = [branchName, storeName].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ jsxs3(View3, { style: styles3.container, children: [
    /* @__PURE__ */ jsx3(
      AuthBackBar,
      {
        onBack,
        backLabel: "Back",
        onSecondary: onChangeStore,
        secondaryLabel: "Change store"
      }
    ),
    /* @__PURE__ */ jsxs3(View3, { style: styles3.form, children: [
      /* @__PURE__ */ jsx3(Text3, { variant: "h1", children: "Sign in" }),
      contextBits ? /* @__PURE__ */ jsx3(Text3, { variant: "muted", style: styles3.context, children: contextBits }) : null,
      /* @__PURE__ */ jsx3(
        TextInput2,
        {
          style: styles3.input,
          placeholder: "Email",
          value: email,
          onChangeText: setEmail,
          autoCapitalize: "none",
          keyboardType: "email-address",
          accessibilityLabel: "Email"
        }
      ),
      usePassword ? /* @__PURE__ */ jsx3(
        TextInput2,
        {
          style: styles3.input,
          placeholder: "Password",
          value: password,
          onChangeText: setPassword,
          secureTextEntry: true,
          accessibilityLabel: "Password"
        }
      ) : /* @__PURE__ */ jsx3(
        TextInput2,
        {
          style: styles3.input,
          placeholder: "PIN",
          value: pin,
          onChangeText: setPin,
          secureTextEntry: true,
          keyboardType: "number-pad",
          maxLength: 6,
          accessibilityLabel: "PIN"
        }
      ),
      /* @__PURE__ */ jsx3(Button2, { title: loading ? "Signing in..." : "Sign in", onPress: login, disabled: loading }),
      allowPassword && /* @__PURE__ */ jsx3(
        Button2,
        {
          title: usePassword ? "Use PIN instead" : "Use password instead",
          variant: "secondary",
          onPress: () => setUsePassword((v) => !v),
          style: styles3.secondary
        }
      )
    ] })
  ] });
}
var styles3 = StyleSheet3.create({
  container: {
    flex: 1,
    paddingHorizontal: theme3.spacing.lg,
    paddingBottom: theme3.spacing.lg,
    backgroundColor: theme3.colors.background
  },
  form: {
    flex: 1,
    justifyContent: "center"
  },
  context: {
    marginBottom: theme3.spacing.lg
  },
  input: {
    borderWidth: 1,
    borderColor: theme3.colors.border,
    borderRadius: theme3.borderRadius.md,
    padding: theme3.spacing.md,
    marginBottom: theme3.spacing.md,
    fontSize: 16,
    minHeight: 48
  },
  secondary: {
    marginTop: theme3.spacing.md
  }
});

// src/screens/BranchSelectScreen.tsx
import { StyleSheet as StyleSheet4, View as View4, FlatList, TouchableOpacity } from "react-native";
import { Text as Text4, theme as theme4 } from "@kiosk/ui";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function BranchSelectScreen({
  branches,
  onSelect,
  storeName,
  onChangeStore
}) {
  return /* @__PURE__ */ jsxs4(View4, { style: styles4.container, children: [
    /* @__PURE__ */ jsx4(
      AuthBackBar,
      {
        onBack: onChangeStore,
        backLabel: "Change store"
      }
    ),
    /* @__PURE__ */ jsx4(Text4, { variant: "h1", children: "Select branch" }),
    storeName ? /* @__PURE__ */ jsx4(Text4, { variant: "muted", style: styles4.store, children: storeName }) : null,
    /* @__PURE__ */ jsx4(
      FlatList,
      {
        data: branches,
        keyExtractor: (item) => item.id,
        renderItem: ({ item }) => /* @__PURE__ */ jsxs4(
          TouchableOpacity,
          {
            style: styles4.item,
            onPress: () => onSelect(item),
            accessibilityRole: "button",
            accessibilityLabel: `Select branch ${item.name}`,
            children: [
              /* @__PURE__ */ jsx4(Text4, { variant: "body", children: item.name }),
              item.code ? /* @__PURE__ */ jsx4(Text4, { variant: "caption", style: styles4.code, children: item.code }) : null
            ]
          }
        )
      }
    )
  ] });
}
var styles4 = StyleSheet4.create({
  container: {
    flex: 1,
    paddingHorizontal: theme4.spacing.lg,
    paddingBottom: theme4.spacing.lg,
    backgroundColor: theme4.colors.background
  },
  store: {
    marginBottom: theme4.spacing.md
  },
  item: {
    padding: theme4.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme4.colors.border,
    minHeight: 48,
    justifyContent: "center"
  },
  code: {
    color: theme4.colors.textMuted,
    marginTop: 4
  }
});

// src/screens/WhiteLabelErrorScreen.tsx
import { StyleSheet as StyleSheet5, View as View5 } from "react-native";
import { Button as Button3, Text as Text5, theme as theme5 } from "@kiosk/ui";
import { getTenantDisplayName } from "@kiosk/core";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
function WhiteLabelErrorScreen({ message, onRetry }) {
  const displayName = getTenantDisplayName();
  return /* @__PURE__ */ jsxs5(View5, { style: styles5.container, children: [
    /* @__PURE__ */ jsx5(Text5, { variant: "h1", children: displayName ?? "Store unavailable" }),
    /* @__PURE__ */ jsx5(Text5, { variant: "body", style: styles5.message, children: message }),
    /* @__PURE__ */ jsx5(Button3, { title: "Try again", onPress: onRetry })
  ] });
}
var styles5 = StyleSheet5.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: theme5.spacing.lg,
    backgroundColor: theme5.colors.background
  },
  message: {
    marginVertical: theme5.spacing.lg,
    color: theme5.colors.textMuted
  }
});
export {
  BranchSelectScreen,
  PinLoginScreen,
  TenantEntryScreen,
  WhiteLabelErrorScreen,
  useAuthStore,
  useStaffAuthNavigation,
  useStaffBoot
};
