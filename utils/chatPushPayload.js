const CHAT_EVENT_CREATED = 'chat.message.created';
const CHAT_EVENT_READ = 'chat.message.read';

const ALLOWED_TYPES = new Set([CHAT_EVENT_CREATED, CHAT_EVENT_READ]);

function normalizeString(value) {
  return String(value || '').trim();
}

function pickField(source, keys) {
  for (const key of keys) {
    const value = normalizeString(source?.[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

export function normalizeChatPushPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const type = pickField(payload, ['type', 'event_type', 'eventType']);
  if (!ALLOWED_TYPES.has(type)) {
    return null;
  }

  const conversationId = pickField(payload, ['conversation_id', 'conversationId']);
  if (!conversationId) {
    return null;
  }

  return {
    type,
    conversationId,
    messageId: pickField(payload, ['message_id', 'messageId']),
    senderUserId: pickField(payload, ['sender_user_id', 'senderUserId']),
    recipientUserId: pickField(payload, ['recipient_user_id', 'recipientUserId']),
    previewText: pickField(payload, ['preview_text', 'previewText']),
    createdAt: pickField(payload, ['created_at', 'createdAt']),
    lastReadMessageId: pickField(payload, ['last_read_message_id', 'lastReadMessageId']),
    raw: payload,
  };
}

export function parseRemoteMessageToChatEvent(remoteMessage) {
  if (!remoteMessage) {
    return null;
  }

  const data = remoteMessage?.data && typeof remoteMessage.data === 'object'
    ? remoteMessage.data
    : {};

  const normalized = normalizeChatPushPayload(data);
  if (!normalized) {
    return null;
  }

  return {
    ...normalized,
    source: 'fcm',
    receivedAt: new Date().toISOString(),
  };
}
