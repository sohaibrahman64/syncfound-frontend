/**
 * @typedef {Object} ChatParticipant
 * @property {string} userId
 * @property {string} displayName
 * @property {string} photoUrl
 * @property {string} headline
 * @property {string} locationText
 * @property {string} bio
 * @property {string} userRole
 * @property {string} linkedinUrl
 */

/**
 * @typedef {Object} ChatConversationCard
 * @property {string} conversationId
 * @property {string} linkedInviteId
 * @property {string} linkedMatchId
 * @property {string} title
 * @property {string} subtitle
 * @property {string} preview
 * @property {string} previewAt
 * @property {number} unreadCount
 * @property {string} lastReadMessageId
 * @property {string} lastReadAt
 * @property {string} lastMessageId
 * @property {string} lastMessageKind
 * @property {ChatParticipant|null} otherParticipant
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} messageId
 * @property {string} conversationId
 * @property {string} senderUserId
 * @property {string} senderName
 * @property {string} messageText
 * @property {string} messageKind
 * @property {string} createdAt
 * @property {string} idempotencyKey
 * @property {boolean} isMine
 * @property {boolean} isOptimistic
 * @property {'sending'|'sent'|'failed'} sendState
 */

function asText(value, fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function asNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeChatParticipant(raw = {}) {
  return {
    userId: asText(raw.user_id || raw.userId || raw.id),
    displayName: asText(raw.display_name || raw.full_name || raw.name, 'Unknown user'),
    photoUrl: asText(
      raw.profile_picture_url || raw.profile_photo_url || raw.photo_url || raw.avatar_url,
    ),
    headline: asText(raw.title || raw.headline || raw.linkedin_headline),
    locationText: asText(raw.location_text || raw.location),
    bio: asText(raw.bio),
    userRole: asText(raw.user_role || raw.role),
    linkedinUrl: asText(raw.linkedin_url),
  };
}

export function normalizeChatConversation(raw = {}) {
  const conversationId = asText(raw.conversation_id || raw.public_id || raw.id);
  const participants = asArray(raw.participants).map(normalizeChatParticipant);
  const otherParticipant =
    normalizeChatParticipant(
      raw.other_user || raw.other_participant || raw.counterparty || participants[0] || {},
    );

  const latestMessage = raw.latest_message || raw.last_message || {};
  const previewText = asText(
    latestMessage.message_text || latestMessage.text || raw.preview || raw.message_preview,
  );

  return {
    conversationId,
    linkedInviteId: asText(raw.linked_invite_id),
    linkedMatchId: asText(raw.linked_match_id),
    title: asText(raw.title || otherParticipant.displayName, 'Chat'),
    subtitle: asText(raw.subtitle || otherParticipant.headline),
    preview: previewText,
    previewAt: asText(latestMessage.created_at || raw.last_message_at || raw.updated_at || raw.created_at),
    updatedAt: asText(raw.updated_at || raw.last_message_at || latestMessage.created_at || raw.created_at),
    isArchived: Boolean(
      raw?.is_archived ||
      String(raw?.status || '').toLowerCase() === 'archived' ||
      String(raw?.state || '').toLowerCase() === 'archived',
    ),
    unreadCount: Math.max(asNumber(raw.unread_count, 0), 0),
    lastReadMessageId: asText(raw.last_read_message_id),
    lastReadAt: asText(raw.last_read_at),
    lastMessageId: asText(latestMessage.message_id || latestMessage.public_id || raw.last_message_id),
    lastMessageKind: asText(latestMessage.kind || latestMessage.message_kind || raw.last_message_kind),
    otherParticipant: otherParticipant.userId ? otherParticipant : null,
  };
}

export function normalizeChatDetails(raw = {}) {
  const participants = asArray(raw.participants).map(normalizeChatParticipant);

  return {
    conversationId: asText(raw.conversation_id || raw.public_id || raw.id),
    linkedInviteId: asText(raw.linked_invite_id),
    linkedMatchId: asText(raw.linked_match_id),
    participants,
    otherParticipant: normalizeChatParticipant(
      raw.other_user || raw.other_participant || raw.counterparty || participants[0] || {},
    ),
  };
}

export function normalizeChatMessage(raw = {}, currentUserId = '') {
  const senderUserId = asText(raw.sender_user_id || raw.sender_id || raw.user_id);
  const messageId = asText(raw.message_id || raw.public_id || raw.id);
  const createdAt = asText(raw.created_at || raw.timestamp || raw.sent_at);
  const messageKind = asText(raw.kind || raw.message_kind || 'text', 'text');

  return {
    messageId,
    conversationId: asText(raw.conversation_id),
    senderUserId,
    senderName: asText(raw.sender_name || raw.display_name),
    messageText: asText(raw.message_text || raw.text),
    messageKind,
    createdAt,
    idempotencyKey: asText(raw.idempotency_key),
    isMine: Boolean(
      raw?.is_mine ||
      raw?.from_me ||
      (currentUserId && senderUserId && currentUserId === senderUserId),
    ),
    isOptimistic: false,
    sendState: 'sent',
  };
}

export function normalizeCursorPayload(payload = {}) {
  return {
    items: asArray(payload.items),
    nextCursor: payload?.next_cursor ?? payload?.nextCursor ?? null,
    hasMore:
      typeof payload?.has_more === 'boolean'
        ? payload.has_more
        : typeof payload?.hasMore === 'boolean'
          ? payload.hasMore
          : Boolean(payload?.next_cursor ?? payload?.nextCursor),
  };
}
