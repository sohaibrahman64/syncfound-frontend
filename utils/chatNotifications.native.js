import { AppState, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { deactivateDevicePushToken, registerDevicePushToken } from './backendAuth';
import { emitChatPushEvent } from './chatPushEvents';
import { getOrCreateDeviceId } from './deviceIdentity';
import { parseRemoteMessageToChatEvent } from './chatPushPayload';

const APP_VERSION = String(process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0').trim() || '1.0.0';

let activeToken = '';
let tokenRefreshUnsubscribe = null;
let foregroundMessageUnsubscribe = null;
let notificationOpenUnsubscribe = null;
let appStateUnsubscribe = null;
let initRunId = 0;
let retryTimeoutId = null;

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const event = parseRemoteMessageToChatEvent(remoteMessage);
  if (event) {
    emitChatPushEvent(event);
  }
});

function clearRetry() {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

async function requestAndroidNotificationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }

  if (Platform.Version < 33) {
    return true;
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function ensureNativeFcmToken({ firebaseToken, onAuthExpired, attempt = 0 } = {}) {
  const hasPermission = await requestAndroidNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  await messaging().registerDeviceForRemoteMessages();
  const token = await messaging().getToken();

  if (!token) {
    return null;
  }

  const deviceId = await getOrCreateDeviceId();

  try {
    await registerDevicePushToken({
      firebaseToken,
      provider: 'fcm',
      platform: Platform.OS,
      token,
      app_version: APP_VERSION,
      device_id: deviceId,
    });

    activeToken = token;
    return token;
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) {
      onAuthExpired?.();
      return null;
    }

    if (attempt < 3) {
      clearRetry();
      retryTimeoutId = setTimeout(() => {
        void ensureNativeFcmToken({ firebaseToken, onAuthExpired, attempt: attempt + 1 });
      }, Math.min(1000 * (attempt + 1), 4000));
    }

    return null;
  }
}

function toLaunchContext(remoteMessage) {
  const event = parseRemoteMessageToChatEvent(remoteMessage);
  if (!event) {
    return null;
  }

  return {
    conversationId: event.conversationId,
    initialMessageId: event.messageId,
  };
}

export async function initializeChatNotifications({
  firebaseToken,
  onAuthExpired,
  onChatNotificationOpen,
} = {}) {
  if (!String(firebaseToken || '').trim()) {
    return () => {};
  }

  initRunId += 1;
  const runId = initRunId;

  await ensureNativeFcmToken({ firebaseToken, onAuthExpired, attempt: 0 });

  tokenRefreshUnsubscribe?.();
  tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (nextToken) => {
    const normalized = String(nextToken || '').trim();
    if (!normalized) {
      return;
    }

    const deviceId = await getOrCreateDeviceId();

    try {
      await registerDevicePushToken({
        firebaseToken,
        provider: 'fcm',
        platform: Platform.OS,
        token: normalized,
        app_version: APP_VERSION,
        device_id: deviceId,
      });
      activeToken = normalized;
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        onAuthExpired?.();
      }
    }
  });

  foregroundMessageUnsubscribe?.();
  foregroundMessageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
    const event = parseRemoteMessageToChatEvent(remoteMessage);
    if (event) {
      emitChatPushEvent(event);
    }
  });

  notificationOpenUnsubscribe?.();
  notificationOpenUnsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
    const launch = toLaunchContext(remoteMessage);
    if (launch) {
      onChatNotificationOpen?.(launch);
    }

    const event = parseRemoteMessageToChatEvent(remoteMessage);
    if (event) {
      emitChatPushEvent(event);
    }
  });

  const initialMessage = await messaging().getInitialNotification().catch(() => null);
  if (initialMessage) {
    const launch = toLaunchContext(initialMessage);
    if (launch) {
      onChatNotificationOpen?.(launch);
    }

    const event = parseRemoteMessageToChatEvent(initialMessage);
    if (event) {
      emitChatPushEvent(event);
    }
  }

  appStateUnsubscribe?.remove?.();
  appStateUnsubscribe = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      void ensureNativeFcmToken({ firebaseToken, onAuthExpired, attempt: 0 });
    }
  });

  return () => {
    if (runId !== initRunId) {
      return;
    }

    tokenRefreshUnsubscribe?.();
    tokenRefreshUnsubscribe = null;

    foregroundMessageUnsubscribe?.();
    foregroundMessageUnsubscribe = null;

    notificationOpenUnsubscribe?.();
    notificationOpenUnsubscribe = null;

    appStateUnsubscribe?.remove?.();
    appStateUnsubscribe = null;

    clearRetry();
  };
}

export function getActiveDevicePushToken() {
  return activeToken;
}

export async function deactivateCurrentDevicePushToken({ firebaseToken } = {}) {
  const token = String(activeToken || '').trim();
  if (!token) {
    return;
  }

  await deactivateDevicePushToken({
    firebaseToken,
    token,
  }).catch(() => {});

  activeToken = '';
}
