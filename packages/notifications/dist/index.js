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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  getPushToken: () => getPushToken,
  registerPushToken: () => registerPushToken,
  requestPushPermissions: () => requestPushPermissions,
  setupNotifications: () => setupNotifications
});
module.exports = __toCommonJS(index_exports);
async function requestPushPermissions() {
  try {
    const Notifications = await import("expo-notifications");
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}
async function getPushToken() {
  try {
    const granted = await requestPushPermissions();
    if (!granted) return null;
    const Notifications = await import("expo-notifications");
    const Constants = await import("expo-constants");
    const projectId = Constants.default.expoConfig?.extra?.eas?.projectId ?? Constants.default.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : void 0
    );
    const platform = Constants.default.platform?.ios ? "ios" : Constants.default.platform?.android ? "android" : "web";
    return { token: tokenResult.data, platform };
  } catch {
    return null;
  }
}
async function registerPushToken(api, token) {
  await api.post("/api/v1/me/device-tokens/fcm", {
    token: token.token,
    platform: token.platform.toUpperCase()
  });
}
async function setupNotifications(api, onNotification) {
  const token = await getPushToken();
  if (token) {
    await registerPushToken(api, token);
  }
  if (onNotification) {
    try {
      const Notifications = await import("expo-notifications");
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        onNotification(data);
      });
    } catch {
    }
  }
  return token;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getPushToken,
  registerPushToken,
  requestPushPermissions,
  setupNotifications
});
