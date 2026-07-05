import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import firebaseWebConfig from './firebaseWebConfig';
import { deactivateDevicePushToken, registerDevicePushToken } from './backendAuth';
import { emitChatPushEvent } from './chatPushEvents';
import { getOrCreateDeviceId } from './deviceIdentity';
import { normalizeChatPushPayload, parseRemoteMessageToChatEvent } from './chatPushPayload';

const VAPID_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_FIREBASE_WEB_VAPID_KEY ||
  'BEkfviWl-wUeKcfFk0f-lw8F-OLK6h0zxxfFXNQBcufHEWBYYWmW9FA94GyB7xMAPTYn_rY49imSww5XmBqiyqY';

const APP_VERSION = String(process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0').trim() || '1.0.0';

let activeToken = '';
let onMessageUnsubscribe = null;
let onServiceWorkerMessage = null;
let initRunId = 0;
let retryTimeoutId = null;
let visibilityHandler = null;

function clearRetry() {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

function getWebFirebaseApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseWebConfig);
  }

  return getApp();
}

function parseChatLaunchFromPayload(payload) {
  const normalized = normalizeChatPushPayload(payload);
  if (!normalized) {
    return null;
  }

  return {
    conversationId: normalized.conversationId,
    initialMessageId: normalized.messageId,
  };
}

async function ensureWebFcmToken({ firebaseToken, attempt = 0, onAuthExpired } = {}) {
  const app = getWebFirebaseApp();
  const messaging = getMessaging(app);

  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration,
  });

  if (!token) {
    return null;
  }

  const deviceId = await getOrCreateDeviceId();

  try {
    await registerDevicePushToken({
      firebaseToken,
      provider: 'fcm',
      platform: 'web',
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
        void ensureWebFcmToken({ firebaseToken, attempt: attempt + 1, onAuthExpired });
      }, Math.min(1000 * (attempt + 1), 4000));
    }

    return null;
  }
}

export async function initializeChatNotifications({
  firebaseToken,
  onAuthExpired,
  onChatNotificationOpen,
} = {}) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return () => {};
  }

  if (!String(firebaseToken || '').trim()) {
    return () => {};
  }

  const supported = await isSupported().catch(() => false);
  if (!supported || !('Notification' in window)) {
    return () => {};
  }

  initRunId += 1;
  const runId = initRunId;

  const app = getWebFirebaseApp();
  const messaging = getMessaging(app);

  await ensureWebFcmToken({ firebaseToken, attempt: 0, onAuthExpired });

  if (typeof document !== 'undefined') {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }

    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void ensureWebFcmToken({ firebaseToken, attempt: 0, onAuthExpired });
      }
    };

    document.addEventListener('visibilitychange', visibilityHandler);
  }

  onMessageUnsubscribe?.();
  onMessageUnsubscribe = onMessage(messaging, (remoteMessage) => {
    const event = parseRemoteMessageToChatEvent(remoteMessage);
    if (event) {
      emitChatPushEvent(event);
    }
  });

  if (navigator.serviceWorker) {
    if (onServiceWorkerMessage) {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    }

    onServiceWorkerMessage = (serviceWorkerEvent) => {
      const payload = serviceWorkerEvent?.data || {};

      if (payload?.type === 'chat.notification.open') {
        const launch = parseChatLaunchFromPayload(payload?.chatPayload || {});
        if (launch) {
          onChatNotificationOpen?.(launch);
        }
      }

      if (payload?.type === 'chat.push.event') {
        const normalized = normalizeChatPushPayload(payload?.chatPayload || {});
        if (normalized) {
          emitChatPushEvent({
            ...normalized,
            source: 'fcm',
            receivedAt: new Date().toISOString(),
          });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage);
  }

  return () => {
    if (runId !== initRunId) {
      return;
    }

    onMessageUnsubscribe?.();
    onMessageUnsubscribe = null;

    if (navigator.serviceWorker && onServiceWorkerMessage) {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage);
    }
    onServiceWorkerMessage = null;

    if (typeof document !== 'undefined' && visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
    visibilityHandler = null;

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
