import { ApiClient } from '@kiosk/core';

interface PushToken {
    token: string;
    platform: 'ios' | 'android' | 'web';
}
declare function requestPushPermissions(): Promise<boolean>;
declare function getPushToken(): Promise<PushToken | null>;
declare function registerPushToken(api: ApiClient, token: PushToken): Promise<void>;
declare function setupNotifications(api: ApiClient, onNotification?: (data: Record<string, unknown>) => void): Promise<PushToken | null>;

export { type PushToken, getPushToken, registerPushToken, requestPushPermissions, setupNotifications };
