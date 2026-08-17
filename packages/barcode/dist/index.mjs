// src/index.tsx
import React, { useCallback, useState } from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { jsx, jsxs } from "react/jsx-runtime";
function BarcodeScanner({ onBarcode, onError, onClose }) {
  const [CameraView, setCameraView] = useState(null);
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  React.useEffect(() => {
    import("expo-camera").then(
      (mod) => setCameraView(() => mod.CameraView)
    ).catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
  }, [onError]);
  const handleScan = useCallback(
    (result) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );
  if (!CameraView) {
    return /* @__PURE__ */ jsx(View, { style: styles.container, children: /* @__PURE__ */ jsx(Text, { style: styles.hint, children: "Loading camera..." }) });
  }
  return /* @__PURE__ */ jsxs(View, { style: styles.container, children: [
    /* @__PURE__ */ jsx(
      CameraView,
      {
        style: StyleSheet.absoluteFillObject,
        facing: "back",
        barcodeScannerSettings: {
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"]
        },
        onBarcodeScanned: handleScan
      }
    ),
    /* @__PURE__ */ jsxs(View, { style: styles.overlay, children: [
      /* @__PURE__ */ jsx(View, { style: styles.frame }),
      /* @__PURE__ */ jsxs(View, { style: styles.controls, children: [
        /* @__PURE__ */ jsx(TouchableOpacity, { style: styles.button, onPress: () => setTorch((t) => !t), children: /* @__PURE__ */ jsx(Text, { style: styles.buttonText, children: torch ? "Torch Off" : "Torch On" }) }),
        onClose && /* @__PURE__ */ jsx(TouchableOpacity, { style: styles.button, onPress: onClose, children: /* @__PURE__ */ jsx(Text, { style: styles.buttonText, children: "Close" }) })
      ] })
    ] })
  ] });
}
var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
export {
  BarcodeScanner
};
