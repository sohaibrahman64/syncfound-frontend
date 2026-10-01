import { BASE_URL_NO_API } from './Constants';

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

function asTextArray(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return values
    .map((item) => (typeof item === 'object' && item !== null
      ? asText(item.name || item.label || item.value || item.title)
      : asText(item)))
    .filter(Boolean);
}

function resolveChatPhotoUrl(value) {
  const photoUrl = asText(value);
  if (!photoUrl || /^([a-z][a-z\d+.-]*:|\/\/)/i.test(photoUrl)) {
    return photoUrl;
  }

  const baseUrl = String(BASE_URL_NO_API || '').trim().replace(/\/+$/, '');
  const photoPath = photoUrl.replace(/^\/+/, '');
  return baseUrl && photoPath ? `${baseUrl}/${photoPath}` : photoUrl;
}

export function normalizeChatParticipant(raw = {}) {
  const profile = {
    ...(raw.profile_details || raw.profile || {}),
    ...raw,
  };
  const experiences = asArray(profile.linkedin_experiences || profile.linkedinExperiences || profile.experiences);
  const education = asArray(
    profile.education_details || profile.educationEntries || profile.education || profile.linkedin_education || profile.linkedin_educations,
  );

  return {
    ...profile,
    userId: asText(profile.user_id || profile.userId || profile.id),
    displayName: asText(profile.display_name || profile.full_name || profile.displayName || profile.name, 'Unknown user'),
    photoUrl: resolveChatPhotoUrl(
      profile.profile_picture_url || profile.profile_photo_url || profile.photo_url || profile.photoUrl || profile.avatar_url,
    ),
    headline: asText(profile.title || profile.headline || profile.linkedin_headline),
    locationText: asText(profile.location_text || profile.locationText || profile.location),
    bio: asText(profile.bio),
    userRole: asText(profile.user_role || profile.role),
    linkedinUrl: asText(profile.linkedin_url || profile.linkedinUrl),
    intentBadge: asText(profile.intent_badge || profile.intentBadge),
    timeCommitment: asText(profile.time_commitment || profile.timeCommitment),
    roleTags: asTextArray(profile.role_tags || profile.roleTags),
    age: asText(profile.age),
    dateOfBirth: asText(profile.date_of_birth || profile.dateOfBirth || profile.dob || profile.birth_date),
    startupIdea: asText(profile.startup_idea || profile.startupIdea),
    motivation: asText(profile.motivation),
    superpower: asText(profile.superpower || profile.strength),
    passionAbout: asText(profile.passion_about || profile.passionAbout),
    experienceSummary: asText(profile.experience_summary || profile.experienceSummary),
    industries: asTextArray(profile.industries),
    startupExperiences: asTextArray(profile.startup_experience || profile.startup_experiences || profile.startupExperiences),
    workPreferences: asTextArray(profile.work_preferences || profile.work_preference || profile.work_modes || profile.workPreferences),
    lookingForFounder: asText(
      profile.looking_for_in_founder || profile.looking_for_founder || profile.lookingForFounder,
    ),
    founderPreferences: asTextArray(
      profile.founder_preferences || profile.cofounder_preferences || profile.founderPreferences,
    ),
    lookingForTalent: asText(
      profile.looking_for_in_talent || profile.looking_for_talent || profile.lookingForTalent,
    ),
    talentSkills: asTextArray(
      profile.talent_skills || profile.desired_skills || profile.cofounder_skills || profile.talentSkills,
    ),
    linkedinExperiences: experiences,
    educationEntries: education,
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

export function normalizeChatDetails(raw = {}, currentUserId = '') {
  const participants = asArray(raw.participants).map(normalizeChatParticipant);
  const otherParticipant = normalizeChatParticipant(
    raw.other_user
      || raw.other_participant
      || raw.counterparty
      || participants.find((participant) => participant.userId && participant.userId !== currentUserId)
      || participants[0]
      || {},
  );

  return {
    conversationId: asText(raw.conversation_id || raw.public_id || raw.id),
    linkedInviteId: asText(raw.linked_invite_id),
    linkedMatchId: asText(raw.linked_match_id),
    participants,
    otherParticipant,
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
