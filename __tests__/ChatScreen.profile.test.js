import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ChatScreen from '../screens/ChatScreen';
import useChatsList from '../hooks/useChatsList';
import useChatThread from '../hooks/useChatThread';
import useMarkRead from '../hooks/useMarkRead';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../utils/responsive', () => ({
  useResponsiveMetrics: () => ({
    width: 390,
    height: 844,
    vw: (value) => (390 * value) / 100,
    vh: (value) => (844 * value) / 100,
    moderateScale: (value) => value,
    responsiveFont: (value) => value,
  }),
}));

jest.mock('../hooks/useChatsList', () => jest.fn());
jest.mock('../hooks/useChatThread', () => jest.fn());
jest.mock('../hooks/useMarkRead', () => jest.fn());
jest.mock('../utils/chatPushEvents', () => ({
  subscribeToChatPushEvents: () => jest.fn(),
}));

describe('ChatScreen profile tab', () => {
  it('renders the selected conversation participant profile details', () => {
    const participant = {
      userId: 'participant-1',
      displayName: 'Riley Founder',
      locationText: 'Seattle, USA',
      photoUrl: 'https://cdn.example.com/riley.jpg',
      intentBadge: 'Seeking a cofounder',
      startupIdea: 'I am building a local marketplace',
      industries: ['E-Commerce', 'Retail'],
      motivation: 'Make local commerce easier to access.',
      linkedinExperiences: [{ title: 'Product Lead', company: 'Market Co.' }],
      educationEntries: [{ school: 'Example University', degree: 'MBA' }],
    };

    useChatsList.mockReturnValue({
      items: [{ conversationId: 'conversation-1', title: participant.displayName, otherParticipant: participant }],
      isLoading: false,
      isRefreshing: false,
      isPaginating: false,
      hasMore: false,
      error: '',
      loadInitial: jest.fn(),
      refresh: jest.fn(),
      loadMore: jest.fn(),
      patchConversation: jest.fn(),
    });
    useChatThread.mockReturnValue({
      chat: { otherParticipant: participant },
      messages: [],
      latestMessage: null,
      isLoading: false,
      isRefreshing: false,
      isPaginating: false,
      hasMore: false,
      error: '',
      sendError: '',
      isSending: false,
      sendTextMessage: jest.fn(),
      loadOlderMessages: jest.fn(),
      refreshThread: jest.fn(),
    });
    useMarkRead.mockReturnValue({ markAsRead: jest.fn() });

    const { getAllByText, getByText } = render(
      <ChatScreen launchConversationId="conversation-1" />,
    );

    fireEvent.press(getAllByText('Profile')[0]);

    expect(getByText('I am building a local marketplace')).toBeTruthy();
    expect(getByText('Industries & interests')).toBeTruthy();
    expect(getByText('E-Commerce')).toBeTruthy();
    expect(getByText('Make local commerce easier to access.')).toBeTruthy();
    expect(getByText('Product Lead')).toBeTruthy();
    expect(getByText('Example University')).toBeTruthy();
  });
});