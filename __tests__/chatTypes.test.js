import { normalizeChatConversation, normalizeChatDetails } from '../utils/chatTypes';
import { BASE_URL_NO_API } from '../utils/Constants';

describe('normalizeChatConversation profile photos', () => {
  it.each(['profile_photo_url', 'profile_picture_url'])(
    'resolves relative %s paths against the host root',
    (photoField) => {
      const conversation = normalizeChatConversation({
        other_user: {
          user_id: 'user-1',
          [photoField]: '/uploads/images/avatar.jpg',
        },
      });

      expect(conversation.otherParticipant.photoUrl).toBe(
        `${BASE_URL_NO_API}uploads/images/avatar.jpg`,
      );
    },
  );

  it('preserves absolute photo URLs', () => {
    const conversation = normalizeChatConversation({
      other_user: {
        user_id: 'user-1',
        profile_picture_url: 'https://cdn.example.com/avatar.jpg',
      },
    });

    expect(conversation.otherParticipant.photoUrl).toBe('https://cdn.example.com/avatar.jpg');
  });
});

describe('normalizeChatConversation participant profile', () => {
  it('keeps and normalizes profile fields used by the chat profile tab', () => {
    const conversation = normalizeChatConversation({
      other_user: {
        user_id: 'user-1',
        profile_details: {
          startup_idea: 'A local commerce platform',
          industries: ['E-Commerce', { name: 'Retail' }],
          linkedin_experiences: [{ title: 'Director', company: 'Example Co.' }],
          education_details: [{ school: 'Example University' }],
        },
        intent_badge: 'Looking for a cofounder',
      },
    });

    expect(conversation.otherParticipant).toMatchObject({
      userId: 'user-1',
      startupIdea: 'A local commerce platform',
      intentBadge: 'Looking for a cofounder',
      industries: ['E-Commerce', 'Retail'],
      linkedinExperiences: [{ title: 'Director', company: 'Example Co.' }],
      educationEntries: [{ school: 'Example University' }],
    });
  });
});

describe('normalizeChatDetails participant selection', () => {
  it('selects the other participant and keeps profile data when participants are normalized twice', () => {
    const chat = normalizeChatDetails({
      participants: [
        { user_id: 'current-user', display_name: 'Current User' },
        {
          user_id: 'other-user',
          display_name: 'Other User',
          profile_picture_url: 'https://cdn.example.com/avatar.jpg',
          linkedin_experiences: [{ title: 'Director', company: 'Example Co.' }],
          education_details: [{ school: 'Example University' }],
        },
      ],
    }, 'current-user');

    expect(chat.otherParticipant).toMatchObject({
      userId: 'other-user',
      displayName: 'Other User',
      photoUrl: 'https://cdn.example.com/avatar.jpg',
      linkedinExperiences: [{ title: 'Director', company: 'Example Co.' }],
      educationEntries: [{ school: 'Example University' }],
    });
  });
});