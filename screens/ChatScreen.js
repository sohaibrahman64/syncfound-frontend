import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import useChatsList from '../hooks/useChatsList';
import useChatThread from '../hooks/useChatThread';
import useMarkRead from '../hooks/useMarkRead';
import ChatListCard from '../components/chat/ChatListCard';
import MessageBubble from '../components/chat/MessageBubble';
import MessageComposer from '../components/chat/MessageComposer';
import { logAnalyticsEvent } from '../utils/swipeMonetization';

const TAB_ACTIVE = 'active';
const TAB_ARCHIVED = 'archived';
const THREAD_TAB_CHAT = 'chat';
const THREAD_TAB_PROFILE = 'profile';

const TABS = [
  { key: TAB_ACTIVE, label: 'Active' },
  { key: TAB_ARCHIVED, label: 'Archived' },
];

export default function ChatScreen({
  onNavigate,
  firebaseToken = '',
  onAuthExpired,
  launchConversationId = '',
  launchInitialMessageId = '',
  currentUserId = '',
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);
  const [activeTab, setActiveTab] = useState(TAB_ACTIVE);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [threadTab, setThreadTab] = useState(THREAD_TAB_CHAT);
  const [composerText, setComposerText] = useState('');
  const [highlightMessageId, setHighlightMessageId] = useState('');
  const messageListRef = useRef(null);
  const pendingScrollIndexRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const navItems = useMemo(() => [
    { key: 'invites', label: 'Invites', icon: require('../assets/invites-inactive.png'), active: false },
    { key: 'sync', label: 'Sync', icon: require('../assets/sync-inactive.png'), active: false },
    { key: 'chat', label: 'Chat', icon: require('../assets/chat-active.png'), active: true },
    { key: 'profile', label: 'Profile', icon: require('../assets/profile-inactive.png'), active: false },
  ], []);

  const {
    items,
    isLoading,
    isRefreshing,
    isPaginating,
    hasMore,
    error,
    loadInitial,
    refresh,
    loadMore,
    patchConversation,
  } = useChatsList({
    firebaseToken,
    onAuthExpired,
    onAnalyticsEvent: logAnalyticsEvent,
  });

  const {
    chat,
    messages,
    latestMessage,
    isLoading: isThreadLoading,
    isRefreshing: isThreadRefreshing,
    isPaginating: isThreadPaginating,
    hasMore: hasOlderMessages,
    error: threadError,
    sendError,
    isSending,
    sendTextMessage,
    loadOlderMessages,
    refreshThread,
  } = useChatThread({
    firebaseToken,
    conversationId: selectedConversationId,
    currentUserId,
    onAuthExpired,
    onAnalyticsEvent: logAnalyticsEvent,
  });

  const handleMarkReadSuccess = useCallback((payload) => {
    patchConversation(payload.conversationId, {
      unreadCount: payload.unreadCount,
      lastReadMessageId: payload.lastReadMessageId,
      lastReadAt: payload.lastReadAt,
    });

    logAnalyticsEvent('chat_mark_read', {
      conversation_id: payload.conversationId,
    });
  }, [patchConversation]);

  const { markAsRead } = useMarkRead({
    firebaseToken,
    onAuthExpired,
    onError: undefined,
    onSuccess: handleMarkReadSuccess,
  });

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    const conversationId = String(launchConversationId || '').trim();
    if (!conversationId) {
      return;
    }

    setSelectedConversationId(conversationId);
    setThreadTab(THREAD_TAB_CHAT);
    setHighlightMessageId(String(launchInitialMessageId || '').trim());
  }, [launchConversationId, launchInitialMessageId]);

  useEffect(() => {
    if (!selectedConversationId || threadTab !== THREAD_TAB_CHAT) {
      return;
    }

    if (!latestMessage?.messageId) {
      return;
    }

    void markAsRead({
      conversationId: selectedConversationId,
      lastReadMessageId: latestMessage.messageId,
    });
  }, [latestMessage?.messageId, markAsRead, selectedConversationId, threadTab]);

  useEffect(() => {
    if (!highlightMessageId || !Array.isArray(messages) || messages.length === 0) {
      return;
    }

    const targetIndex = messages.findIndex((item) => item.messageId === highlightMessageId);
    if (targetIndex < 0) {
      return;
    }

    pendingScrollIndexRef.current = targetIndex;
    messageListRef.current?.scrollToIndex?.({
      index: targetIndex,
      animated: true,
      viewPosition: 0.5,
    });
    setHighlightMessageId('');
  }, [highlightMessageId, messages]);

  useEffect(() => {
    if (!selectedConversationId || threadTab !== THREAD_TAB_CHAT) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    const intervalId = setInterval(() => {
      if (appStateRef.current !== 'active') {
        return;
      }

      if (isThreadLoading || isThreadRefreshing || isThreadPaginating || isSending) {
        return;
      }

      refreshThread();
    }, 200);

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [
    isSending,
    isThreadLoading,
    isThreadPaginating,
    isThreadRefreshing,
    refreshThread,
    selectedConversationId,
    threadTab,
  ]);

  const handleScrollToIndexFailed = useCallback((info) => {
    const pendingIndex = pendingScrollIndexRef.current;
    if (!messageListRef.current || pendingIndex == null) {
      return;
    }

    const highestMeasuredIndex = Math.max(Number(info?.highestMeasuredFrameIndex) || 0, 0);
    if (highestMeasuredIndex > 0) {
      messageListRef.current.scrollToIndex({
        index: highestMeasuredIndex,
        animated: false,
      });
    } else if (Number(info?.averageItemLength) > 0) {
      messageListRef.current.scrollToOffset({
        offset: Number(info.averageItemLength) * pendingIndex,
        animated: false,
      });
    }

    requestAnimationFrame(() => {
      if (!messageListRef.current || pendingScrollIndexRef.current == null) {
        return;
      }

      messageListRef.current.scrollToIndex({
        index: pendingScrollIndexRef.current,
        animated: true,
        viewPosition: 0.5,
      });
      pendingScrollIndexRef.current = null;
    });
  }, []);

  const filteredConversations = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === TAB_ARCHIVED) {
        return Boolean(item?.isArchived);
      }

      return !item?.isArchived;
    });
  }, [activeTab, items]);

  const selectedConversationCard = useMemo(() => (
    items.find((item) => item.conversationId === selectedConversationId) || null
  ), [items, selectedConversationId]);

  const threadTitle =
    chat?.otherParticipant?.displayName ||
    selectedConversationCard?.title ||
    'Conversation';

  const handleOpenConversation = useCallback((item) => {
    if (!item?.conversationId) {
      return;
    }

    setSelectedConversationId(item.conversationId);
    setThreadTab(THREAD_TAB_CHAT);
    setHighlightMessageId('');
  }, []);

  const handleBackFromThread = useCallback(() => {
    setSelectedConversationId('');
    setThreadTab(THREAD_TAB_CHAT);
    setComposerText('');
    setHighlightMessageId('');
    void refresh();
  }, [refresh]);

  const handleSend = useCallback(async () => {
    const trimmed = String(composerText || '').trim();
    if (!trimmed) {
      return;
    }

    const response = await sendTextMessage(trimmed);
    if (!response) {
      return;
    }

    setComposerText('');
    patchConversation(selectedConversationId, {
      preview: response.messageText,
      previewAt: response.createdAt,
      unreadCount: 0,
      lastMessageId: response.messageId,
      lastMessageKind: response.messageKind,
    });
  }, [composerText, patchConversation, selectedConversationId, sendTextMessage]);

  const emptyMessage =
    activeTab === TAB_ACTIVE
      ? 'No new messages at the moment!'
      : 'No archived messages at the moment!';

  const threadTabs = [
    { key: THREAD_TAB_CHAT, label: 'Chat' },
    { key: THREAD_TAB_PROFILE, label: 'Profile' },
  ];

  const renderBottomNav = () => (
    <View style={styles.bottomTabBar}>
      {navItems.map((item) => (
        <Pressable key={item.key} style={styles.navItem} onPress={() => onNavigate?.(item.key)}>
          <Image source={item.icon} style={styles.navIcon} />
          <Text style={item.active ? styles.navTextActive : styles.navText}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (selectedConversationId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.threadHeaderRow}>
          <Pressable style={styles.threadBackButton} onPress={handleBackFromThread}>
            <Image source={require('../assets/back_arrow.png')} style={styles.threadBackIcon} />
          </Pressable>
          <Text style={styles.pageTitle} numberOfLines={1}>{threadTitle}</Text>
        </View>

        <View style={styles.tabsRow}>
          {threadTabs.map((tab) => {
            const isActive = threadTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setThreadTab(tab.key)}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                {isActive ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        {threadTab === THREAD_TAB_PROFILE ? (
          <View style={styles.profilePanel}>
            <View style={styles.profileTopRow}>
              {chat?.otherParticipant?.photoUrl ? (
                <Image source={{ uri: chat.otherParticipant.photoUrl }} style={styles.profileAvatar} />
              ) : (
                <Image source={require('../assets/cofounders.jpg')} style={styles.profileAvatar} />
              )}
              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName}>{chat?.otherParticipant?.displayName || threadTitle}</Text>
                {!!chat?.otherParticipant?.headline && (
                  <Text style={styles.profileHeadline}>{chat.otherParticipant.headline}</Text>
                )}
                {!!chat?.otherParticipant?.locationText && (
                  <Text style={styles.profileLocation}>{chat.otherParticipant.locationText}</Text>
                )}
              </View>
            </View>

            {!!chat?.otherParticipant?.bio && (
              <Text style={styles.profileBio}>{chat.otherParticipant.bio}</Text>
            )}

            {!!chat?.otherParticipant?.linkedinUrl && (
              <Pressable
                style={styles.profileLinkButton}
                onPress={() => {
                  const url = /^https?:\/\//i.test(chat.otherParticipant.linkedinUrl)
                    ? chat.otherParticipant.linkedinUrl
                    : `https://${chat.otherParticipant.linkedinUrl}`;
                  void Linking.openURL(url).catch(() => {});
                }}
              >
                <Text style={styles.profileLinkText}>Open LinkedIn</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {isThreadLoading ? (
              <View style={styles.threadStateWrap}>
                <ActivityIndicator size="large" color="#20bcc8" />
              </View>
            ) : threadError ? (
              <View style={styles.threadStateWrap}>
                <Text style={styles.errorText}>{threadError}</Text>
                <Pressable style={styles.retryButton} onPress={refreshThread}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <FlatList
                ref={messageListRef}
                data={messages}
                keyExtractor={(item) => item.messageId}
                renderItem={({ item }) => <MessageBubble item={item} styles={styles} />}
                contentContainerStyle={styles.threadListContent}
                showsVerticalScrollIndicator={false}
                onScrollToIndexFailed={handleScrollToIndexFailed}
                onRefresh={refreshThread}
                refreshing={isThreadRefreshing}
                ListHeaderComponent={
                  hasOlderMessages ? (
                    <Pressable
                      style={styles.loadOlderButton}
                      onPress={loadOlderMessages}
                      disabled={isThreadPaginating}
                    >
                      {isThreadPaginating ? (
                        <ActivityIndicator size="small" color="#20bcc8" />
                      ) : (
                        <Text style={styles.loadOlderText}>Load older messages</Text>
                      )}
                    </Pressable>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.threadStateWrap}>
                    <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
                  </View>
                }
              />
            )}

            <MessageComposer
              value={composerText}
              onChangeText={setComposerText}
              onSend={handleSend}
              disabled={isSending}
              isSending={isSending}
              errorMessage={sendError}
              styles={styles}
            />
          </>
        )}

        {renderBottomNav()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Messages</Text>

      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              {isActive ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.emptyStateWrap}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#20bcc8" />
        ) : error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </>
        ) : filteredConversations.length > 0 ? (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.conversationId}
            renderItem={({ item }) => <ChatListCard item={item} onPress={handleOpenConversation} styles={styles} />}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMore}
            onEndReachedThreshold={0.45}
            onRefresh={refresh}
            refreshing={isRefreshing}
            ListFooterComponent={
              isPaginating ? (
                <View style={styles.paginationWrap}>
                  <ActivityIndicator size="small" color="#20bcc8" />
                </View>
              ) : !hasMore ? <View style={styles.listEndSpacer} /> : null
            }
          />
        ) : (
          <>
            <Image source={require('../assets/chat-inactive.png')} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </>
        )}
      </View>

      {renderBottomNav()}
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, insets = {}) {
  const isNarrowScreen = width < 370;
  const isShortScreen = height < 760;
  const topInset = insets?.top || 0;
  const bottomInset = insets?.bottom || 0;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#dfddd5',
      paddingTop: topInset + vh(isShortScreen ? 1.2 : 2.2),
    },
    threadHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: vw(5.4),
    },
    threadBackButton: {
      width: moderateScale(34),
      height: moderateScale(34),
      marginLeft: vw(3.2),
      alignItems: 'center',
      justifyContent: 'center',
    },
    threadBackIcon: {
      width: moderateScale(20),
      height: moderateScale(20),
      resizeMode: 'contain',
      tintColor: '#7f8696',
    },
    pageTitle: {
      fontSize: responsiveFont(38, 30, 44),
      lineHeight: responsiveFont(42, 34, 48),
      fontWeight: '700',
      color: '#050505',
      marginHorizontal: vw(5.4),
      marginTop: vh(0.8),
      marginBottom: vh(2.2),
      letterSpacing: -0.4,
    },
    tabsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: vw(3.8),
      marginBottom: vh(1.2),
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingTop: vh(0.5),
      paddingBottom: vh(0.8),
      minHeight: moderateScale(42),
    },
    tabItemActive: {
      borderBottomWidth: 0,
    },
    tabLabel: {
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '600',
      color: '#0b0b0b',
    },
    tabLabelActive: {
      color: '#20bcc8',
    },
    tabUnderline: {
      marginTop: moderateScale(8),
      width: '88%',
      alignSelf: 'center',
      borderBottomWidth: moderateScale(4),
      borderBottomColor: '#20bcc8',
    },
    emptyStateWrap: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: vh(1.2),
      paddingHorizontal: vw(3),
    },
    chatListContent: {
      width: '100%',
      paddingTop: moderateScale(8),
      paddingBottom: moderateScale(16),
    },
    chatCardWrap: {
      width: '100%',
      overflow: 'hidden',
    },
    chatCardRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 0,
      paddingVertical: moderateScale(10),
      overflow: 'hidden',
    },
    chatAvatarWrap: {
      width: moderateScale(isNarrowScreen ? 74 : 78),
      height: moderateScale(isNarrowScreen ? 74 : 78),
      borderRadius: moderateScale(14),
      overflow: 'hidden',
      flexShrink: 0,
      marginRight: moderateScale(12),
      backgroundColor: '#d6d6d6',
    },
    chatAvatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    chatCardTextWrap: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      maxWidth: '100%',
      overflow: 'hidden',
      justifyContent: 'center',
      minHeight: moderateScale(68),
      paddingRight: moderateScale(6),
    },
    chatCardName: {
      color: '#111111',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
      flexShrink: 1,
      maxWidth: '100%',
      overflow: 'hidden',
    },
    chatCardPreview: {
      marginTop: moderateScale(4),
      color: '#6f7b96',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(21, 17, 23),
      fontWeight: '400',
      flexShrink: 1,
      maxWidth: '100%',
      overflow: 'hidden',
    },
    chatUnreadBadge: {
      minWidth: moderateScale(24),
      height: moderateScale(24),
      borderRadius: moderateScale(12),
      paddingHorizontal: moderateScale(7),
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#20bcc8',
      marginLeft: moderateScale(10),
    },
    chatUnreadBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(12, 10, 13),
      lineHeight: responsiveFont(15, 12, 16),
      fontWeight: '600',
    },
    chatCardDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#8f98aa',
      marginHorizontal: 0,
    },
    threadListContent: {
      flexGrow: 1,
      paddingHorizontal: vw(4),
      paddingBottom: vh(1.5),
    },
    threadStateWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(8),
      paddingVertical: vh(3),
    },
    errorText: {
      color: '#6f7b96',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: moderateScale(12),
      backgroundColor: '#20bcc8',
      borderRadius: 999,
      paddingHorizontal: moderateScale(18),
      paddingVertical: moderateScale(10),
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(18, 15, 19),
      fontWeight: '600',
    },
    loadOlderButton: {
      alignSelf: 'center',
      marginTop: moderateScale(8),
      marginBottom: moderateScale(10),
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
      borderRadius: 999,
      backgroundColor: '#e7f8fa',
    },
    loadOlderText: {
      color: '#1599a5',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(17, 14, 18),
      fontWeight: '600',
    },
    messageRow: {
      width: '100%',
      marginBottom: moderateScale(10),
    },
    messageRowMine: {
      alignItems: 'flex-end',
    },
    messageRowOther: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '88%',
      borderRadius: moderateScale(18),
      paddingHorizontal: moderateScale(14),
      paddingTop: moderateScale(11),
      paddingBottom: moderateScale(9),
    },
    messageBubbleMine: {
      backgroundColor: '#33b9c5',
      borderBottomRightRadius: moderateScale(4),
    },
    messageBubbleOther: {
      backgroundColor: '#ececec',
      borderBottomLeftRadius: moderateScale(4),
    },
    messageBubbleAcceptance: {
      borderWidth: 1,
      borderColor: '#1a9ca8',
    },
    messageBubbleFailed: {
      backgroundColor: '#d78282',
    },
    messageText: {
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
    },
    messageTextMine: {
      color: '#ffffff',
    },
    messageTextOther: {
      color: '#232323',
    },
    messageMetaText: {
      marginTop: moderateScale(7),
      fontSize: responsiveFont(12, 10, 13),
      lineHeight: responsiveFont(15, 12, 16),
      fontWeight: '400',
      textAlign: 'right',
    },
    messageMetaTextMine: {
      color: '#e9feff',
    },
    messageMetaTextOther: {
      color: '#6f7b96',
    },
    composerWrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#cdd0d6',
      paddingHorizontal: vw(4),
      paddingTop: vh(0.9),
      paddingBottom: vh(0.7),
      backgroundColor: '#dfddd5',
    },
    composerErrorText: {
      color: '#b15757',
      fontSize: responsiveFont(13, 11, 14),
      lineHeight: responsiveFont(16, 13, 17),
      marginBottom: moderateScale(6),
      textAlign: 'center',
    },
    composerInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: moderateScale(8),
    },
    composerInput: {
      flex: 1,
      minHeight: moderateScale(46),
      maxHeight: moderateScale(120),
      borderRadius: moderateScale(14),
      backgroundColor: '#f6f6f6',
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(10),
      color: '#1d1d1d',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '400',
      textAlignVertical: 'top',
    },
    composerSendButton: {
      height: moderateScale(46),
      borderRadius: moderateScale(14),
      minWidth: moderateScale(78),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#20bcc8',
      paddingHorizontal: moderateScale(14),
    },
    composerSendButtonDisabled: {
      opacity: 0.55,
    },
    composerSendButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '600',
    },
    profilePanel: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: vh(1.6),
    },
    profileTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: moderateScale(14),
    },
    profileAvatar: {
      width: moderateScale(86),
      height: moderateScale(86),
      borderRadius: moderateScale(18),
      resizeMode: 'cover',
      backgroundColor: '#d4d4d4',
      marginRight: moderateScale(12),
    },
    profileTextWrap: {
      flex: 1,
      paddingTop: moderateScale(4),
    },
    profileName: {
      color: '#141414',
      fontSize: responsiveFont(24, 20, 28),
      lineHeight: responsiveFont(30, 24, 34),
      fontWeight: '700',
    },
    profileHeadline: {
      marginTop: moderateScale(4),
      color: '#2d2d2d',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '500',
    },
    profileLocation: {
      marginTop: moderateScale(4),
      color: '#6f7b96',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '400',
    },
    profileBio: {
      color: '#232323',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    profileLinkButton: {
      marginTop: moderateScale(16),
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: '#20bcc8',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(10),
    },
    profileLinkText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(18, 15, 19),
      fontWeight: '600',
    },
    paginationWrap: {
      paddingVertical: moderateScale(12),
      alignItems: 'center',
    },
    listEndSpacer: {
      height: moderateScale(8),
    },
    emptyIcon: {
      width: moderateScale(isNarrowScreen ? 66 : 74),
      height: moderateScale(isNarrowScreen ? 66 : 74),
      tintColor: '#b8b8b8',
      marginBottom: vh(2.2),
      resizeMode: 'contain',
    },
    emptyText: {
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(24, 20, 28),
      fontWeight: '500',
      color: '#6f7b96',
      textAlign: 'center',
      letterSpacing: 0.1,
    },
    bottomTabBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: '#f4f4f4',
      borderTopWidth: 1,
      borderTopColor: '#e4e4e4',
      paddingTop: vh(1),
      paddingBottom: Math.max(vh(1), bottomInset + vh(0.45)),
      paddingHorizontal: vw(2),
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: vw(20),
    },
    navIcon: {
      width: moderateScale(32),
      height: moderateScale(32),
      resizeMode: 'contain',
      marginBottom: vh(0.2),
    },
    navText: {
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '400',
      color: '#9a9a9a',
    },
    navTextActive: {
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '500',
      color: '#20bcc8',
    },
  }));
}