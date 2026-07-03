import { BASE_URL } from './Constants';
import {
  normalizeChatConversation,
  normalizeChatDetails,
  normalizeChatMessage,
  normalizeCursorPayload,
} from './chatTypes';

const CHAT_BASE_PATH = '/users/me/chats';

function normalizeApiBaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/^['\"]|['\"]$/g, '')
    .replace(/\/$/, '');
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);

function clampLimit(limit, fallback, max) {
  const num = Number(limit);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(num), 1), max);
}

function normalizeErrorMessage(payload, fallback) {
  return String(payload?.detail || payload?.message || fallback || 'Request failed').trim();
}

export function mapChatApiError(status, payload, fallback = '') {
  const baseMessage = normalizeErrorMessage(payload, fallback);

  const error = new Error(baseMessage);
  error.status = status;
  error.payload = payload;
  error.code = 'chat_unknown';

  if (status === 401 || status === 403) {
    error.code = 'chat_auth';
    error.userMessage = 'Your session expired. Please sign in again.';
    return error;
  }

  if (status === 404) {
    error.code = 'chat_not_found';
    error.userMessage = 'This conversation is no longer available.';
    return error;
  }

  if (status === 409) {
    error.code = 'chat_conflict';
    error.userMessage = baseMessage || 'This action conflicts with the latest chat state.';
    return error;
  }

  if (status === 422) {
    error.code = 'chat_validation';
    error.userMessage = baseMessage || 'Please review your message and try again.';
    return error;
  }

  if (status >= 500) {
    error.code = 'chat_server';
    error.userMessage = 'Chat service is temporarily unavailable. Try again shortly.';
    return error;
  }

  if (status === 0) {
    error.code = 'chat_network';
    error.userMessage = 'Network error. Check connection and retry.';
    return error;
  }

  error.userMessage = baseMessage || 'Something went wrong. Please retry.';
  return error;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function createAuthHeaders(firebaseToken = '') {
  const token = String(firebaseToken || '').trim();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request({
  path,
  firebaseToken,
  method = 'GET',
  body,
  query,
  signal,
  fallbackError,
} = {}) {
  const querySuffix = query ? `?${query.toString()}` : '';

  if (!String(firebaseToken || '').trim()) {
    throw mapChatApiError(401, null, 'Missing auth token');
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}${querySuffix}`, {
      method,
      headers: createAuthHeaders(firebaseToken),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw mapChatApiError(response.status, payload, fallbackError);
    }

    return payload || {};
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    if (error?.status) {
      throw error;
    }

    throw mapChatApiError(0, null, error?.message || fallbackError || 'Network request failed');
  }
}

export async function listChats({ firebaseToken, limit = 20, cursor = null, signal } = {}) {
  const query = new URLSearchParams();
  query.set('limit', String(clampLimit(limit, 20, 100)));
  if (cursor) {
    query.set('cursor', String(cursor));
  }

  const payload = await request({
    path: CHAT_BASE_PATH,
    firebaseToken,
    method: 'GET',
    query,
    signal,
    fallbackError: 'Failed to load chats.',
  });

  const normalized = normalizeCursorPayload(payload);
  return {
    items: normalized.items.map(normalizeChatConversation),
    nextCursor: normalized.nextCursor,
    hasMore: normalized.hasMore,
  };
}

export async function getChat({ firebaseToken, conversationId, signal } = {}) {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) {
    throw new Error('conversationId is required');
  }

  const payload = await request({
    path: `${CHAT_BASE_PATH}/${encodeURIComponent(normalizedConversationId)}`,
    firebaseToken,
    method: 'GET',
    signal,
    fallbackError: 'Failed to load conversation details.',
  });

  return normalizeChatDetails(payload);
}

export async function listMessages({
  firebaseToken,
  conversationId,
  currentUserId = '',
  limit = 30,
  cursor = null,
  signal,
} = {}) {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) {
    throw new Error('conversationId is required');
  }

  const query = new URLSearchParams();
  query.set('limit', String(clampLimit(limit, 30, 100)));
  if (cursor) {
    query.set('cursor', String(cursor));
  }

  const payload = await request({
    path: `${CHAT_BASE_PATH}/${encodeURIComponent(normalizedConversationId)}/messages`,
    firebaseToken,
    method: 'GET',
    query,
    signal,
    fallbackError: 'Failed to load messages.',
  });

  const normalized = normalizeCursorPayload(payload);
  return {
    items: normalized.items.map((item) => normalizeChatMessage(item, currentUserId)),
    nextCursor: normalized.nextCursor,
    hasMore: normalized.hasMore,
  };
}

export async function sendMessage({
  firebaseToken,
  conversationId,
  messageText,
  idempotencyKey,
  currentUserId = '',
  signal,
} = {}) {
  const normalizedConversationId = String(conversationId || '').trim();
  if (!normalizedConversationId) {
    throw new Error('conversationId is required');
  }

  const trimmedMessage = String(messageText || '').trim();
  if (!trimmedMessage || trimmedMessage.length > 4000) {
    throw mapChatApiError(422, null, 'Message must be between 1 and 4000 characters.');
  }

  const payload = await request({
    path: `${CHAT_BASE_PATH}/${encodeURIComponent(normalizedConversationId)}/messages`,
    firebaseToken,
    method: 'POST',
    body: {
      message_text: trimmedMessage,
      ...(idempotencyKey ? { idempotency_key: String(idempotencyKey).slice(0, 150) } : {}),
    },
    signal,
    fallbackError: 'Failed to send message.',
  });

  return normalizeChatMessage(payload, currentUserId);
}

export async function markRead({
  firebaseToken,
  conversationId,
  lastReadMessageId,
  signal,
} = {}) {
  const normalizedConversationId = String(conversationId || '').trim();
  const normalizedMessageId = String(lastReadMessageId || '').trim();

  if (!normalizedConversationId) {
    throw new Error('conversationId is required');
  }

  if (!normalizedMessageId) {
    throw new Error('lastReadMessageId is required');
  }

  const payload = await request({
    path: `${CHAT_BASE_PATH}/${encodeURIComponent(normalizedConversationId)}/read`,
    firebaseToken,
    method: 'PATCH',
    body: {
      last_read_message_id: normalizedMessageId,
    },
    signal,
    fallbackError: 'Failed to mark chat as read.',
  });

  return {
    conversationId: String(payload?.conversation_id || normalizedConversationId),
    lastReadMessageId: String(payload?.last_read_message_id || normalizedMessageId),
    lastReadAt: String(payload?.last_read_at || ''),
    unreadCount: Number(payload?.unread_count || 0),
  };
}
