import { normalizeChatConversation } from '../utils/chatTypes';
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