// src/index.ts
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
export {
  getPushToken,
  registerPushToken,
  requestPushPermissions,
  setupNotifications
};
