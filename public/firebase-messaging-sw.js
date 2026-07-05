/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAtrTEwqjIighvLEDMMJ5OeF3OpEAGMlTM',
  authDomain: 'syncfound-fe04d.firebaseapp.com',
  projectId: 'syncfound-fe04d',
  storageBucket: 'syncfound-fe04d.firebasestorage.app',
  messagingSenderId: '527982762549',
  appId: '1:527982762549:web:428e5b748dbdad195b2f7c',
  measurementId: 'G-2VMQ1X78Y5',
});

const messaging = firebase.messaging();

function normalizeChatPayload(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const type = String(input.type || '').trim();
  const conversationId = String(input.conversation_id || '').trim();

  if (!type || !conversationId) {
    return null;
  }

  return {
    type,
    conversation_id: conversationId,
    message_id: String(input.message_id || '').trim(),
    sender_user_id: String(input.sender_user_id || '').trim(),
    recipient_user_id: String(input.recipient_user_id || '').trim(),
    preview_text: String(input.preview_text || '').trim(),
    created_at: String(input.created_at || '').trim(),
    last_read_message_id: String(input.last_read_message_id || '').trim(),
  };
}

function buildNotificationTitle(chatPayload) {
  if (chatPayload?.type === 'chat.message.read') {
    return 'Message read';
  }

  return 'New message';
}

function buildNotificationBody(chatPayload) {
  if (chatPayload?.preview_text) {
    return chatPayload.preview_text;
  }

  if (chatPayload?.type === 'chat.message.read') {
    return 'Your message was read.';
  }

  return 'You have a new chat update.';
}

messaging.onBackgroundMessage((payload) => {
  const data = payload?.data || {};
  const chatPayload = normalizeChatPayload(data);
  if (!chatPayload) {
    return;
  }

  const notificationTitle = buildNotificationTitle(chatPayload);
  const notificationOptions = {
    body: buildNotificationBody(chatPayload),
    data: {
      chatPayload,
    },
    tag: `chat-${chatPayload.conversation_id}`,
    renotify: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);

  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'chat.push.event',
        chatPayload,
      });
    });
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const chatPayload = event.notification?.data?.chatPayload;
  const conversationId = String(chatPayload?.conversation_id || '').trim();
  const messageId = String(chatPayload?.message_id || '').trim();

  const targetUrl = conversationId
    ? `${self.location.origin}/?chat_conversation_id=${encodeURIComponent(conversationId)}${
      messageId ? `&chat_message_id=${encodeURIComponent(messageId)}` : ''
    }`
    : `${self.location.origin}/`;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({
        type: 'chat.notification.open',
        chatPayload,
      });
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && targetUrl) {
          await client.navigate(targetUrl);
        }
        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
