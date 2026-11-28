"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  BarcodeScanner: () => BarcodeScanner,
  QrScanner: () => QrScanner
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");
var import_react_native2 = require("react-native");

// src/camera-copy.ts
function describeCameraAccess(access, scanAgain = "Scan QR code") {
  switch (access.kind) {
    case "checking":
      return "Opening the camera...";
    case "refused":
      return access.canAskAgain ? `Camera access wasn't allowed. Type the code instead, or go back and tap ${scanAgain} again to be asked once more.` : "Camera access is turned off for this app. Turn it on in your phone's settings, or type the code instead.";
    case "missing":
      return "The camera isn't available on this phone. Type the code instead.";
  }
}

// src/qr-scanner.tsx
var import_react = require("react");
var import_react_native = require("react-native");
var import_jsx_runtime = require("react/jsx-runtime");
function QrScanner({ onScanned, onCancel }) {
  const [access, setAccess] = (0, import_react.useState)({ kind: "checking" });
  const done = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    let alive = true;
    void (async () => {
      try {
        const kit = await import("expo-camera");
        let permission = await kit.Camera.getCameraPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await kit.Camera.requestCameraPermissionsAsync();
        }
        if (!alive) return;
        setAccess(
          permission.granted ? { kind: "ready", CameraView: kit.CameraView } : { kind: "refused", canAskAgain: permission.canAskAgain }
        );
      } catch {
        if (alive) setAccess({ kind: "missing" });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const read = (0, import_react.useCallback)(
    (result) => {
      if (done.current || typeof result.data !== "string" || result.data.length === 0) return;
      done.current = true;
      onScanned(result.data);
    },
    [onScanned]
  );
  if (access.kind === "ready") {
    const { CameraView } = access;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.container, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        CameraView,
        {
          style: import_react_native.StyleSheet.absoluteFillObject,
          facing: "back",
          barcodeScannerSettings: { barcodeTypes: ["qr"] },
          onBarcodeScanned: read
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.overlay, pointerEvents: "none", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.frame }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.hint, children: "Point the camera at the QR code your manager made for this phone." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.TouchableOpacity, { style: styles.button, onPress: onCancel, accessibilityRole: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.buttonText, children: "Type the code instead" }) })
    ] });
  }
  const message = describeCameraAccess(access);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.overlay, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.hint, accessibilityLiveRegion: "polite", children: message }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.TouchableOpacity, { style: styles.button, onPress: onCancel, accessibilityRole: "button", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.buttonText, children: access.kind === "checking" ? "Cancel" : "Type the code instead" }) })
  ] });
}
var styles = import_react_native.StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...import_react_native.StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
  frame: { width: 240, height: 240, borderWidth: 2, borderColor: "#28a745", borderRadius: 12 },
  hint: { color: "#fff", textAlign: "center", marginTop: 24, fontSize: 16 },
  button: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center"
  },
  buttonText: { color: "#fff", fontWeight: "600" }
});

// src/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function BarcodeScanner({ onBarcode, onError, onClose }) {
  const [access, setAccess] = (0, import_react2.useState)({ kind: "checking" });
  const [torch, setTorch] = (0, import_react2.useState)(false);
  const [scanned, setScanned] = (0, import_react2.useState)(false);
  const failed = (0, import_react2.useRef)(onError);
  (0, import_react2.useEffect)(() => {
    failed.current = onError;
  }, [onError]);
  (0, import_react2.useEffect)(() => {
    let alive = true;
    void (async () => {
      try {
        const kit = await import("expo-camera");
        let permission = await kit.Camera.getCameraPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) {
          permission = await kit.Camera.requestCameraPermissionsAsync();
        }
        if (!alive) return;
        setAccess(
          permission.granted ? { kind: "ready", CameraView: kit.CameraView } : { kind: "refused", canAskAgain: permission.canAskAgain }
        );
      } catch (e) {
        if (!alive) return;
        setAccess({ kind: "missing" });
        failed.current?.(e instanceof Error ? e : new Error(String(e)));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const handleScan = (0, import_react2.useCallback)(
    (result) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );
  if (access.kind !== "ready") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.container, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: styles2.note, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: styles2.hint, accessibilityLiveRegion: "polite", children: describeCameraAccess(access, "Scan") }) }),
      onClose ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.TouchableOpacity, { style: [styles2.button, styles2.alone], onPress: onClose, accessibilityRole: "button", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: styles2.buttonText, children: access.kind === "checking" ? "Cancel" : "Close" }) }) : null
    ] });
  }
  const { CameraView } = access;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      CameraView,
      {
        style: import_react_native2.StyleSheet.absoluteFillObject,
        facing: "back",
        enableTorch: torch,
        barcodeScannerSettings: {
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"]
        },
        onBarcodeScanned: handleScan
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.overlay, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.View, { style: styles2.frame }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_react_native2.View, { style: styles2.controls, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.TouchableOpacity, { style: styles2.button, onPress: () => setTorch((t) => !t), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: styles2.buttonText, children: torch ? "Torch Off" : "Torch On" }) }),
        onClose && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.TouchableOpacity, { style: styles2.button, onPress: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_react_native2.Text, { style: styles2.buttonText, children: "Close" }) })
      ] })
    ] })
  ] });
}
var styles2 = import_react_native2.StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  overlay: {
    ...import_react_native2.StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  note: {
    ...import_react_native2.StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24
  },
  frame: {
    width: 260,
    height: 160,
    borderWidth: 2,
    borderColor: "#28a745",
    borderRadius: 12,
    backgroundColor: "transparent"
  },
  controls: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    gap: 12
  },
  button: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8
  },
  alone: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    minHeight: 48,
    justifyContent: "center"
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  },
  hint: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BarcodeScanner,
  QrScanner
});
