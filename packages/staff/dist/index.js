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
  BranchSelectScreen: () => BranchSelectScreen,
  PinLoginScreen: () => PinLoginScreen,
  TenantEntryScreen: () => TenantEntryScreen,
  WhiteLabelErrorScreen: () => WhiteLabelErrorScreen,
  useAuthStore: () => useAuthStore,
  useStaffAuthNavigation: () => useStaffAuthNavigation,
  useStaffBoot: () => useStaffBoot
});
module.exports = __toCommonJS(index_exports);

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
var import_react = require("react");
var import_react_native = require("react-native");
var import_core = require("@kiosk/core");
async function tryResolveStaffDeepLink(url, baseURL) {
  if (!url?.trim()) {
    return null;
  }
  const result = await (0, import_core.resolveTenantFromDeepLink)(url, baseURL, {
    hostSuffixes: [(0, import_core.tenantHostSuffix)()]
  });
  if (!result || !(0, import_core.isStaffDeepLinkIntent)(result.intent)) {
    return null;
  }
  return result.tenant;
}
function useStaffBoot(baseURL, setTenant) {
  const [phase, setPhase] = (0, import_react.useState)("loading");
  const [bootError, setBootError] = (0, import_react.useState)(null);
  const applyDeepLinkTenant = (0, import_react.useCallback)(
    (tenant) => {
      setTenant(tenant);
      setBootError(null);
      setPhase("branch");
    },
    [setTenant]
  );
  const runBootstrap = (0, import_react.useCallback)(async () => {
    setPhase("loading");
    setBootError(null);
    try {
      const initialUrl = await import_react_native.Linking.getInitialURL();
      const fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
      if (fromDeepLink) {
        applyDeepLinkTenant(fromDeepLink);
        return;
      }
      const tenant = await (0, import_core.bootstrapTenant)(baseURL);
      if (tenant) {
        setTenant(tenant);
        setPhase("branch");
        return;
      }
      if ((0, import_core.getEmbeddedTenantSlug)()) {
        setBootError("Could not connect to your store. Check your network and try again.");
        setPhase("error");
        return;
      }
      setPhase("tenant");
    } catch (error) {
      if ((0, import_core.getEmbeddedTenantSlug)()) {
        setBootError(error instanceof Error ? error.message : "Could not load your store");
        setPhase("error");
      } else {
        setPhase("tenant");
      }
    }
  }, [applyDeepLinkTenant, baseURL, setTenant]);
  (0, import_react.useEffect)(() => {
    void runBootstrap();
  }, [runBootstrap]);
  (0, import_core.useTenantDeepLink)(async (url) => {
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
var import_react2 = require("react");
var import_core2 = require("@kiosk/core");
function useStaffAuthNavigation(setPhase, onLeaveStore) {
  const { reset, setBranch } = useAuthStore();
  const canChangeStore = !(0, import_core2.getEmbeddedTenantSlug)();
  const goToTenant = (0, import_react2.useCallback)(async () => {
    if (!canChangeStore) {
      return;
    }
    await (0, import_core2.clearTenant)();
    reset();
    onLeaveStore?.();
    setPhase("tenant");
  }, [canChangeStore, onLeaveStore, reset, setPhase]);
  const goToBranch = (0, import_react2.useCallback)(() => {
    setBranch(null);
    setPhase("branch");
  }, [setBranch, setPhase]);
  return { canChangeStore, goToTenant, goToBranch };
}

// src/screens/TenantEntryScreen.tsx
var import_react4 = require("react");
var import_react_native3 = require("react-native");
var import_ui2 = require("@kiosk/ui");
var import_core3 = require("@kiosk/core");

// src/components/AuthBackBar.tsx
var import_react3 = require("react");
var import_react_native2 = require("react-native");
var import_ui = require("@kiosk/ui");
var import_jsx_runtime = require("react/jsx-runtime");
function AuthBackBar({
  onBack,
  backLabel = "Back",
  onSecondary,
  secondaryLabel
}) {
  (0, import_react3.useEffect)(() => {
    if (!onBack) {
      return;
    }
    const sub = import_react_native2.BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  if (!onBack && !onSecondary) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, { style: styles.spacer });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native2.View, { style: styles.bar, children: [
    onBack ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native2.Pressable,
      {
        onPress: onBack,
        accessibilityRole: "button",
        accessibilityLabel: backLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles.hit, pressed && styles.pressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { style: styles.label, children: backLabel })
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native2.View, {}),
    onSecondary && secondaryLabel ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_native2.Pressable,
      {
        onPress: onSecondary,
        accessibilityRole: "button",
        accessibilityLabel: secondaryLabel,
        hitSlop: 8,
        style: ({ pressed }) => [styles.hit, pressed && styles.pressed],
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_ui.Text, { style: styles.secondary, children: secondaryLabel })
      }
    ) : null
  ] });
}
var styles = import_react_native2.StyleSheet.create({
  spacer: {
    height: import_react_native2.Platform.OS === "android" ? import_react_native2.StatusBar.currentHeight ?? 16 : 48
  },
  bar: {
    paddingTop: import_react_native2.Platform.OS === "android" ? (import_react_native2.StatusBar.currentHeight ?? 12) + 8 : 52,
    paddingBottom: import_ui.theme.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48
  },
  hit: {
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: import_ui.theme.spacing.sm,
    paddingRight: import_ui.theme.spacing.md
  },
  pressed: {
    opacity: 0.6
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: import_ui.theme.colors.primaryDark
  },
  secondary: {
    fontSize: 16,
    fontWeight: "600",
    color: import_ui.theme.colors.primaryDark
  }
});

// src/screens/TenantEntryScreen.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }) {
  const [input, setInput] = (0, import_react4.useState)("");
  const [email, setEmail] = (0, import_react4.useState)("");
  const [loading, setLoading] = (0, import_react4.useState)(false);
  const [showEmailFallback, setShowEmailFallback] = (0, import_react4.useState)(false);
  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const tenant = await (0, import_core3.resolveTenant)(input.trim(), baseURL);
      onTenantResolved(tenant);
    } catch (e) {
      import_react_native3.Alert.alert("Error", e instanceof Error ? e.message : "Could not resolve tenant");
    } finally {
      setLoading(false);
    }
  };
  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await (0, import_core3.resolveTenantByEmail)(baseURL, email.trim());
      const tenant = await (0, import_core3.resolveTenant)(result.host, baseURL);
      onTenantResolved(tenant);
    } catch (e) {
      import_react_native3.Alert.alert("Error", e instanceof Error ? e.message : "Could not find tenant for email");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native3.View, { style: styles2.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AuthBackBar, {}),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native3.View, { style: styles2.form, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "h1", children: appTitle }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Text, { variant: "body", style: styles2.subtitle, children: "Enter your business slug or host" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_react_native3.TextInput,
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
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_ui2.Button, { title: loading ? "Loading..." : "Continue", onPress: resolve, disabled: loading }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_ui2.Button,
        {
          title: showEmailFallback ? "Hide email lookup" : "Find by email",
          variant: "secondary",
          onPress: () => setShowEmailFallback((v) => !v),
          style: styles2.secondary
        }
      ),
      showEmailFallback && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_react_native3.TextInput,
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          import_ui2.Button,
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
var styles2 = import_react_native3.StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: import_ui2.theme.spacing.lg,
    paddingBottom: import_ui2.theme.spacing.lg,
    backgroundColor: import_ui2.theme.colors.background
  },
  form: {
    flex: 1,
    justifyContent: "center"
  },
  subtitle: {
    marginBottom: import_ui2.theme.spacing.lg,
    color: import_ui2.theme.colors.textMuted
  },
  input: {
    borderWidth: 1,
    borderColor: import_ui2.theme.colors.border,
    borderRadius: import_ui2.theme.borderRadius.md,
    padding: import_ui2.theme.spacing.md,
    marginBottom: import_ui2.theme.spacing.md,
    fontSize: 16,
    minHeight: 48
  },
  secondary: {
    marginTop: import_ui2.theme.spacing.md
  }
});

// src/screens/PinLoginScreen.tsx
var import_react5 = require("react");
var import_react_native4 = require("react-native");
var import_ui3 = require("@kiosk/ui");
var import_core4 = require("@kiosk/core");
var import_jsx_runtime3 = require("react/jsx-runtime");
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
  const [email, setEmail] = (0, import_react5.useState)("");
  const [pin, setPin] = (0, import_react5.useState)("");
  const [password, setPassword] = (0, import_react5.useState)("");
  const [usePassword, setUsePassword] = (0, import_react5.useState)(false);
  const [loading, setLoading] = (0, import_react5.useState)(false);
  const login = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      if (usePassword && allowPassword) {
        await (0, import_core4.loginWithPassword)(baseURL, email.trim(), password);
      } else {
        if (pin.length < 4) {
          import_react_native4.Alert.alert("Error", "Enter your PIN");
          return;
        }
        await (0, import_core4.loginWithPin)(baseURL, email.trim(), pin, branchId);
      }
      const branches = await (0, import_core4.fetchBranches)(baseURL);
      onSuccess(branches);
    } catch (e) {
      import_react_native4.Alert.alert("Login failed", e instanceof Error ? e.message : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };
  const contextBits = [branchName, storeName].filter(Boolean).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native4.View, { style: styles3.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      AuthBackBar,
      {
        onBack,
        backLabel: "Back",
        onSecondary: onChangeStore,
        secondaryLabel: "Change store"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react_native4.View, { style: styles3.form, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "h1", children: "Sign in" }),
      contextBits ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Text, { variant: "muted", style: styles3.context, children: contextBits }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_react_native4.TextInput,
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
      usePassword ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_react_native4.TextInput,
        {
          style: styles3.input,
          placeholder: "Password",
          value: password,
          onChangeText: setPassword,
          secureTextEntry: true,
          accessibilityLabel: "Password"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_react_native4.TextInput,
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
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_ui3.Button, { title: loading ? "Signing in..." : "Sign in", onPress: login, disabled: loading }),
      allowPassword && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_ui3.Button,
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
var styles3 = import_react_native4.StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: import_ui3.theme.spacing.lg,
    paddingBottom: import_ui3.theme.spacing.lg,
    backgroundColor: import_ui3.theme.colors.background
  },
  form: {
    flex: 1,
    justifyContent: "center"
  },
  context: {
    marginBottom: import_ui3.theme.spacing.lg
  },
  input: {
    borderWidth: 1,
    borderColor: import_ui3.theme.colors.border,
    borderRadius: import_ui3.theme.borderRadius.md,
    padding: import_ui3.theme.spacing.md,
    marginBottom: import_ui3.theme.spacing.md,
    fontSize: 16,
    minHeight: 48
  },
  secondary: {
    marginTop: import_ui3.theme.spacing.md
  }
});

// src/screens/BranchSelectScreen.tsx
var import_react_native5 = require("react-native");
var import_ui4 = require("@kiosk/ui");
var import_jsx_runtime4 = require("react/jsx-runtime");
function BranchSelectScreen({
  branches,
  onSelect,
  storeName,
  onChangeStore
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_react_native5.View, { style: styles4.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      AuthBackBar,
      {
        onBack: onChangeStore,
        backLabel: "Change store"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_ui4.Text, { variant: "h1", children: "Select branch" }),
    storeName ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_ui4.Text, { variant: "muted", style: styles4.store, children: storeName }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_react_native5.FlatList,
      {
        data: branches,
        keyExtractor: (item) => item.id,
        renderItem: ({ item }) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
          import_react_native5.TouchableOpacity,
          {
            style: styles4.item,
            onPress: () => onSelect(item),
            accessibilityRole: "button",
            accessibilityLabel: `Select branch ${item.name}`,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_ui4.Text, { variant: "body", children: item.name }),
              item.code ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_ui4.Text, { variant: "caption", style: styles4.code, children: item.code }) : null
            ]
          }
        )
      }
    )
  ] });
}
var styles4 = import_react_native5.StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: import_ui4.theme.spacing.lg,
    paddingBottom: import_ui4.theme.spacing.lg,
    backgroundColor: import_ui4.theme.colors.background
  },
  store: {
    marginBottom: import_ui4.theme.spacing.md
  },
  item: {
    padding: import_ui4.theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: import_ui4.theme.colors.border,
    minHeight: 48,
    justifyContent: "center"
  },
  code: {
    color: import_ui4.theme.colors.textMuted,
    marginTop: 4
  }
});

// src/screens/WhiteLabelErrorScreen.tsx
var import_react_native6 = require("react-native");
var import_ui5 = require("@kiosk/ui");
var import_core5 = require("@kiosk/core");
var import_jsx_runtime5 = require("react/jsx-runtime");
function WhiteLabelErrorScreen({ message, onRetry }) {
  const displayName = (0, import_core5.getTenantDisplayName)();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_react_native6.View, { style: styles5.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_ui5.Text, { variant: "h1", children: displayName ?? "Store unavailable" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_ui5.Text, { variant: "body", style: styles5.message, children: message }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_ui5.Button, { title: "Try again", onPress: onRetry })
  ] });
}
var styles5 = import_react_native6.StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: import_ui5.theme.spacing.lg,
    backgroundColor: import_ui5.theme.colors.background
  },
  message: {
    marginVertical: import_ui5.theme.spacing.lg,
    color: import_ui5.theme.colors.textMuted
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BranchSelectScreen,
  PinLoginScreen,
  TenantEntryScreen,
  WhiteLabelErrorScreen,
  useAuthStore,
  useStaffAuthNavigation,
  useStaffBoot
});
