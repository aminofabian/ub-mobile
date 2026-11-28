// src/index.tsx
import { useCallback as useCallback2, useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import { StyleSheet as StyleSheet2, View as View2, TouchableOpacity as TouchableOpacity2, Text as Text2 } from "react-native";

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
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { jsx, jsxs } from "react/jsx-runtime";
function QrScanner({ onScanned, onCancel }) {
  const [access, setAccess] = useState({ kind: "checking" });
  const done = useRef(false);
  useEffect(() => {
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
  const read = useCallback(
    (result) => {
      if (done.current || typeof result.data !== "string" || result.data.length === 0) return;
      done.current = true;
      onScanned(result.data);
    },
    [onScanned]
  );
  if (access.kind === "ready") {
    const { CameraView } = access;
    return /* @__PURE__ */ jsxs(View, { style: styles.container, children: [
      /* @__PURE__ */ jsx(
        CameraView,
        {
          style: StyleSheet.absoluteFillObject,
          facing: "back",
          barcodeScannerSettings: { barcodeTypes: ["qr"] },
          onBarcodeScanned: read
        }
      ),
      /* @__PURE__ */ jsxs(View, { style: styles.overlay, pointerEvents: "none", children: [
        /* @__PURE__ */ jsx(View, { style: styles.frame }),
        /* @__PURE__ */ jsx(Text, { style: styles.hint, children: "Point the camera at the QR code your manager made for this phone." })
      ] }),
      /* @__PURE__ */ jsx(TouchableOpacity, { style: styles.button, onPress: onCancel, accessibilityRole: "button", children: /* @__PURE__ */ jsx(Text, { style: styles.buttonText, children: "Type the code instead" }) })
    ] });
  }
  const message = describeCameraAccess(access);
  return /* @__PURE__ */ jsxs(View, { style: styles.container, children: [
    /* @__PURE__ */ jsx(View, { style: styles.overlay, children: /* @__PURE__ */ jsx(Text, { style: styles.hint, accessibilityLiveRegion: "polite", children: message }) }),
    /* @__PURE__ */ jsx(TouchableOpacity, { style: styles.button, onPress: onCancel, accessibilityRole: "button", children: /* @__PURE__ */ jsx(Text, { style: styles.buttonText, children: access.kind === "checking" ? "Cancel" : "Type the code instead" }) })
  ] });
}
var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", padding: 24 },
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
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function BarcodeScanner({ onBarcode, onError, onClose }) {
  const [access, setAccess] = useState2({ kind: "checking" });
  const [torch, setTorch] = useState2(false);
  const [scanned, setScanned] = useState2(false);
  const failed = useRef2(onError);
  useEffect2(() => {
    failed.current = onError;
  }, [onError]);
  useEffect2(() => {
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
  const handleScan = useCallback2(
    (result) => {
      if (scanned) return;
      setScanned(true);
      onBarcode({ value: result.data, format: result.type });
      setTimeout(() => setScanned(false), 1500);
    },
    [onBarcode, scanned]
  );
  if (access.kind !== "ready") {
    return /* @__PURE__ */ jsxs2(View2, { style: styles2.container, children: [
      /* @__PURE__ */ jsx2(View2, { style: styles2.note, children: /* @__PURE__ */ jsx2(Text2, { style: styles2.hint, accessibilityLiveRegion: "polite", children: describeCameraAccess(access, "Scan") }) }),
      onClose ? /* @__PURE__ */ jsx2(TouchableOpacity2, { style: [styles2.button, styles2.alone], onPress: onClose, accessibilityRole: "button", children: /* @__PURE__ */ jsx2(Text2, { style: styles2.buttonText, children: access.kind === "checking" ? "Cancel" : "Close" }) }) : null
    ] });
  }
  const { CameraView } = access;
  return /* @__PURE__ */ jsxs2(View2, { style: styles2.container, children: [
    /* @__PURE__ */ jsx2(
      CameraView,
      {
        style: StyleSheet2.absoluteFillObject,
        facing: "back",
        enableTorch: torch,
        barcodeScannerSettings: {
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"]
        },
        onBarcodeScanned: handleScan
      }
    ),
    /* @__PURE__ */ jsxs2(View2, { style: styles2.overlay, children: [
      /* @__PURE__ */ jsx2(View2, { style: styles2.frame }),
      /* @__PURE__ */ jsxs2(View2, { style: styles2.controls, children: [
        /* @__PURE__ */ jsx2(TouchableOpacity2, { style: styles2.button, onPress: () => setTorch((t) => !t), children: /* @__PURE__ */ jsx2(Text2, { style: styles2.buttonText, children: torch ? "Torch Off" : "Torch On" }) }),
        onClose && /* @__PURE__ */ jsx2(TouchableOpacity2, { style: styles2.button, onPress: onClose, children: /* @__PURE__ */ jsx2(Text2, { style: styles2.buttonText, children: "Close" }) })
      ] })
    ] })
  ] });
}
var styles2 = StyleSheet2.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  overlay: {
    ...StyleSheet2.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center"
  },
  note: {
    ...StyleSheet2.absoluteFillObject,
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
export {
  BarcodeScanner,
  QrScanner
};
