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
  BarcodeScanner: () => BarcodeScanner
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var import_react_native = require("react-native");
var import_jsx_runtime = require("react/jsx-runtime");
function BarcodeScanner({ onBarcode, onError, onClose }) {
  const [CameraView, setCameraView] = (0, import_react.useState)(null);
  const [torch, setTorch] = (0, import_react.useState)(false);
  const [scanned, setScanned] = (0, import_react.useState)(false);
  import_react.default.useEffect(() => {
    import("expo-camera").then(
      (mod) => setCameraView(() => mod.CameraView)
    ).catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
  }, [onError]);
  const handleScan = (0, import_react.useCallback)(
    (result) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );
  if (!CameraView) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.container, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.hint, children: "Loading camera..." }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.container, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      CameraView,
      {
        style: import_react_native.StyleSheet.absoluteFillObject,
        facing: "back",
        barcodeScannerSettings: {
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"]
        },
        onBarcodeScanned: handleScan
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.overlay, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.View, { style: styles.frame }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react_native.View, { style: styles.controls, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.TouchableOpacity, { style: styles.button, onPress: () => setTorch((t) => !t), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.buttonText, children: torch ? "Torch Off" : "Torch On" }) }),
        onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.TouchableOpacity, { style: styles.button, onPress: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native.Text, { style: styles.buttonText, children: "Close" }) })
      ] })
    ] })
  ] });
}
var styles = import_react_native.StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  overlay: {
    ...import_react_native.StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
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
  buttonText: {
    color: "#fff",
    fontWeight: "600"
  },
  hint: {
    color: "#fff",
    textAlign: "center",
    marginTop: 48
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BarcodeScanner
});
