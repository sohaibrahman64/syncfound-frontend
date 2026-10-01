import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
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
import { subscribeToChatPushEvents } from '../utils/chatPushEvents';

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

    if (latestMessage?.isOptimistic || latestMessage?.sendState === 'failed') {
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
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState !== 'active' && nextState === 'active') {
        void refresh();
        if (selectedConversationId && threadTab === THREAD_TAB_CHAT) {
          refreshThread();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refresh, refreshThread, selectedConversationId, threadTab]);

  useEffect(() => {
    const unsubscribe = subscribeToChatPushEvents((event) => {
      if (!event?.type) {
        return;
      }

      if (event.type !== 'chat.message.created' && event.type !== 'chat.message.read') {
        return;
      }

      void refresh();

      if (
        selectedConversationId &&
        threadTab === THREAD_TAB_CHAT &&
        String(event.conversationId || '') === String(selectedConversationId || '')
      ) {
        refreshThread();
      }
    });

    return unsubscribe;
  }, [refresh, refreshThread, selectedConversationId, threadTab]);

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
    (chat?.otherParticipant?.displayName !== 'Unknown user' && chat?.otherParticipant?.displayName) ||
    selectedConversationCard?.title ||
    'Conversation';
  const profileParticipant = mergeProfileParticipant(
    chat?.otherParticipant || {},
    selectedConversationCard?.otherParticipant || {},
  );
  const profileRoleTags = Array.isArray(profileParticipant.roleTags)
    ? profileParticipant.roleTags.join(', ')
    : displayText(profileParticipant.roleTagsText);
  const profileAge = getProfileAgeText(profileParticipant);
  const profileExperiences = Array.isArray(profileParticipant.linkedinExperiences)
    ? profileParticipant.linkedinExperiences
    : [];
  const profileEducation = Array.isArray(profileParticipant.educationEntries)
    ? profileParticipant.educationEntries
    : [];
  const profileIndustries = Array.isArray(profileParticipant.industries) ? profileParticipant.industries : [];
  const profileStartupExperiences = Array.isArray(profileParticipant.startupExperiences)
    ? profileParticipant.startupExperiences
    : [];
  const profileWorkPreferences = Array.isArray(profileParticipant.workPreferences)
    ? profileParticipant.workPreferences
    : [];
  const profileFounderPreferences = Array.isArray(profileParticipant.founderPreferences)
    ? profileParticipant.founderPreferences
    : [];
  const profileTalentSkills = Array.isArray(profileParticipant.talentSkills)
    ? profileParticipant.talentSkills
    : [];

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
                <View style={[styles.tabUnderline, isActive && styles.tabUnderlineActive]} />
              </Pressable>
            );
          })}
        </View>

        {threadTab === THREAD_TAB_PROFILE ? (
          <ScrollView
            style={styles.profileScroll}
            contentContainerStyle={styles.profileScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileHero}>
              <View style={styles.profileTopRow}>
                {profileParticipant.photoUrl ? (
                  <Image source={{ uri: profileParticipant.photoUrl }} style={styles.profileAvatar} />
                ) : (
                  <Image source={require('../assets/cofounders.jpg')} style={styles.profileAvatar} />
                )}
                <View style={styles.profileTextWrap}>
                  <Text style={styles.profileName}>{profileParticipant.displayName || threadTitle}</Text>
                  {!!profileParticipant.headline && (
                    <Text style={styles.profileHeadline}>{profileParticipant.headline}</Text>
                  )}
                  {!!profileParticipant.locationText && (
                    <Text style={styles.profileLocation}>{profileParticipant.locationText}</Text>
                  )}
                  {!!profileParticipant.userRole && (
                    <Text style={styles.profileLocation}>{profileParticipant.userRole}</Text>
                  )}
                </View>
                {!!profileParticipant.linkedinUrl && (
                  <Pressable
                    style={styles.profileLinkedinButton}
                    onPress={() => {
                      const url = /^https?:\/\//i.test(profileParticipant.linkedinUrl)
                        ? profileParticipant.linkedinUrl
                        : `https://${profileParticipant.linkedinUrl}`;
                      void Linking.openURL(url).catch(() => {});
                    }}
                  >
                    <Image source={require('../assets/linkedin.png')} style={styles.profileLinkedinIcon} />
                  </Pressable>
                )}
              </View>

              {!!profileParticipant.intentBadge && (
                <View style={styles.profileIntentBadge}>
                  <Text style={styles.profileIntentText}>{profileParticipant.intentBadge}</Text>
                </View>
              )}
              {!!profileParticipant.bio && <Text style={styles.profileBio}>{profileParticipant.bio}</Text>}
            </View>

            {!!profileParticipant.startupIdea && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>My idea</Text>
                <Text style={styles.profileSectionBody}>{profileParticipant.startupIdea}</Text>
              </View>
            )}

            {!!(profileParticipant.intentBadge || profileParticipant.timeCommitment || profileRoleTags || profileAge) && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>As a founder, I am...</Text>
                {!!profileParticipant.intentBadge && (
                  <View style={styles.profileDetailRow}>
                    <Image source={require('../assets/search.png')} style={styles.profileDetailIcon} />
                    <Text style={styles.profileSectionBody}>{profileParticipant.intentBadge}</Text>
                  </View>
                )}
                {!!profileParticipant.timeCommitment && (
                  <View style={styles.profileDetailRow}>
                    <Image source={require('../assets/teamwork.png')} style={styles.profileDetailIcon} />
                    <Text style={styles.profileSectionBody}>{profileParticipant.timeCommitment}</Text>
                  </View>
                )}
                {!!profileRoleTags && (
                  <View style={styles.profileDetailRow}>
                    <Image source={require('../assets/internship.png')} style={styles.profileDetailIcon} />
                    <Text style={styles.profileSectionBody}>{profileRoleTags}</Text>
                  </View>
                )}
                {!!profileAge && (
                  <View style={styles.profileDetailRow}>
                    <Image source={require('../assets/user.png')} style={styles.profileDetailIcon} />
                    <Text style={styles.profileSectionBody}>{profileAge}</Text>
                  </View>
                )}
              </View>
            )}

            {profileIndustries.length > 0 && (
              <View style={styles.profileBadgeSection}>
                <Text style={styles.profileSectionTitle}>Industries &amp; interests</Text>
                <View style={styles.profileBadgesWrap}>
                  {profileIndustries.map((industry, index) => (
                    <View key={`${industry}-${index}`} style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>{industry}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {profileStartupExperiences.length > 0 && (
              <View style={styles.profileBadgeSection}>
                <Text style={styles.profileSectionTitle}>Startup experience</Text>
                <View style={styles.profileBadgesWrap}>
                  {profileStartupExperiences.map((entry, index) => (
                    <View key={`${entry}-${index}`} style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>{entry}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {profileWorkPreferences.length > 0 && (
              <View style={styles.profileBadgeSection}>
                <Text style={styles.profileSectionTitle}>Work preferences</Text>
                <View style={styles.profileBadgesWrap}>
                  {profileWorkPreferences.map((entry, index) => (
                    <View key={`${entry}-${index}`} style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>{entry}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {!!profileParticipant.motivation && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>My motivation to build a startup</Text>
                <Text style={styles.profileSectionBody}>{profileParticipant.motivation}</Text>
              </View>
            )}

            {!!profileParticipant.superpower && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>My strength / superpower</Text>
                <Text style={styles.profileSectionBody}>{profileParticipant.superpower}</Text>
              </View>
            )}

            {(profileExperiences.length > 0 || profileParticipant.experienceSummary || profileParticipant.title) && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>Experiences</Text>
                {profileExperiences.length > 0 ? profileExperiences.map((experience, index) => (
                  <View key={`${experience?.company || 'company'}-${experience?.title || 'title'}-${index}`} style={styles.profileListRow}>
                    <Image source={require('../assets/briefcase.png')} style={styles.profileListIcon} />
                    <View style={styles.profileListBody}>
                      {!!displayText(experience?.title || experience?.position) && (
                        <Text style={styles.profileListTitle}>{displayText(experience?.title || experience?.position)}</Text>
                      )}
                      {!!displayText(experience?.company || experience?.company_name) && (
                        <Text style={styles.profileSectionBody}>{displayText(experience?.company || experience?.company_name)}</Text>
                      )}
                      {!!displayText(experience?.duration || experience?.date_range) && (
                        <Text style={styles.profileListMeta}>{displayText(experience?.duration || experience?.date_range)}</Text>
                      )}
                      {!!displayText(experience?.description) && (
                        <Text style={styles.profileSectionBody}>{displayText(experience?.description)}</Text>
                      )}
                    </View>
                  </View>
                )) : (
                  <Text style={styles.profileSectionBody}>{profileParticipant.experienceSummary || profileParticipant.title}</Text>
                )}
              </View>
            )}

            {profileEducation.length > 0 && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>Education</Text>
                {profileEducation.map((education, index) => (
                  <View key={`${education?.school || education?.institution || 'school'}-${index}`} style={styles.profileListRow}>
                    <Image source={require('../assets/graduation.png')} style={styles.profileListIcon} />
                    <View style={styles.profileListBody}>
                      {!!displayText(education?.school || education?.school_name || education?.institution) && (
                        <Text style={styles.profileListTitle}>{displayText(education?.school || education?.school_name || education?.institution)}</Text>
                      )}
                      {!!displayText(education?.degree_name || education?.degree) && (
                        <Text style={styles.profileSectionBody}>{displayText(education?.degree_name || education?.degree)}</Text>
                      )}
                      {!!displayText(education?.field_of_study || education?.field || education?.major) && (
                        <Text style={styles.profileSectionBody}>{displayText(education?.field_of_study || education?.field || education?.major)}</Text>
                      )}
                      {!!displayText(education?.duration || education?.date_range || education?.dates) && (
                        <Text style={styles.profileListMeta}>{displayText(education?.duration || education?.date_range || education?.dates)}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!!profileParticipant.passionAbout && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>I'm passionate about</Text>
                <Text style={styles.profileSectionBody}>{profileParticipant.passionAbout}</Text>
              </View>
            )}

            {!!(profileParticipant.lookingForFounder || profileFounderPreferences.length > 0) && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>What I'm looking for in a founder</Text>
                {!!profileParticipant.lookingForFounder && (
                  <Text style={styles.profilePreferenceLead}>{profileParticipant.lookingForFounder}</Text>
                )}
                {profileFounderPreferences.map((preference, index) => (
                  <Text key={`${preference}-${index}`} style={styles.profileSectionBody}>{preference}</Text>
                ))}
              </View>
            )}

            {!!(profileParticipant.lookingForTalent || profileTalentSkills.length > 0) && (
              <View style={styles.profileSectionCard}>
                <Text style={styles.profileSectionTitle}>What I'm looking for in a talent</Text>
                <Text style={styles.profilePreferenceLead}>
                  {profileParticipant.lookingForTalent || profileTalentSkills.join(', ')}
                </Text>
              </View>
            )}

            <View style={styles.profileBottomSpacer} />
          </ScrollView>
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
              <View style={[styles.tabUnderline, isActive && styles.tabUnderlineActive]} />
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
          <View style={styles.emptyContentWrap}>
            <Image source={require('../assets/chat-inactive.png')} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        )}
      </View>

      {renderBottomNav()}
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, insets = {}) {
  const isNarrowScreen = width < 370;
  const topInset = insets?.top || 0;
  const bottomInset = insets?.bottom || 0;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#dfddd5',
      paddingTop: topInset + moderateScale(40),
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
      fontSize: responsiveFont(28, 22, 32),
      lineHeight: responsiveFont(32, 26, 36),
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
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(18, 15, 20),
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
      height: moderateScale(4),
      backgroundColor: 'transparent',
    },
    tabUnderlineActive: {
      backgroundColor: '#20bcc8',
    },
    emptyStateWrap: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      marginBottom: vh(1.2),
      paddingHorizontal: vw(3),
    },
    emptyContentWrap: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
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
      width: moderateScale(isNarrowScreen ? 88 : 96),
      height: moderateScale(isNarrowScreen ? 88 : 96),
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
      fontSize: responsiveFont(18, 16, 20),
      lineHeight: responsiveFont(24, 20, 26),
      fontWeight: '500',
      flexShrink: 1,
      maxWidth: '100%',
      overflow: 'hidden',
    },
    chatCardPreview: {
      marginTop: moderateScale(4),
      color: '#6f7b96',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
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
      alignItems: 'center',
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    composerSendButtonDisabled: {
      opacity: 0.55,
    },
    composerSendIcon: {
      width: moderateScale(22),
      height: moderateScale(22),
      resizeMode: 'contain',
    },
    profileScroll: {
      flex: 1,
    },
    profileScrollContent: {
      paddingHorizontal: vw(5),
      paddingTop: vh(1.6),
      paddingBottom: moderateScale(16),
    },
    profileHero: {
      marginBottom: moderateScale(14),
    },
    profileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileAvatar: {
      width: moderateScale(isNarrowScreen ? 82 : 96),
      height: moderateScale(isNarrowScreen ? 82 : 96),
      borderRadius: moderateScale(14),
      resizeMode: 'cover',
      backgroundColor: '#d4d4d4',
      marginRight: moderateScale(12),
      flexShrink: 0,
    },
    profileTextWrap: {
      flex: 1,
      minWidth: 0,
      paddingTop: moderateScale(4),
    },
    profileName: {
      color: '#141414',
      fontSize: responsiveFont(22, 18, 24),
      lineHeight: responsiveFont(28, 22, 30),
      fontWeight: '600',
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
    profileLinkedinButton: {
      width: moderateScale(30),
      height: moderateScale(30),
      marginLeft: moderateScale(8),
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileLinkedinIcon: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    profileIntentBadge: {
      alignSelf: 'flex-start',
      marginTop: moderateScale(10),
      borderRadius: moderateScale(8),
      backgroundColor: '#7f8696',
      paddingHorizontal: moderateScale(10),
      paddingVertical: moderateScale(5),
    },
    profileIntentText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '500',
    },
    profileBio: {
      marginTop: moderateScale(12),
      color: '#232323',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '600',
    },
    profileSectionCard: {
      borderRadius: moderateScale(22),
      backgroundColor: '#ffffff',
      paddingHorizontal: vw(5),
      paddingVertical: moderateScale(18),
      marginBottom: moderateScale(16),
    },
    profileSectionTitle: {
      color: '#111111',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(23, 19, 24),
      fontWeight: '700',
      marginBottom: moderateScale(8),
    },
    profileSectionBody: {
      color: '#1a1a1a',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(23, 19, 25),
      fontWeight: '400',
    },
    profileDetailRow: {
      minHeight: moderateScale(48),
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#aaaaaa',
      paddingVertical: moderateScale(10),
      gap: moderateScale(12),
    },
    profileDetailIcon: {
      width: moderateScale(24),
      height: moderateScale(24),
      resizeMode: 'contain',
    },
    profileBadgeSection: {
      marginHorizontal: moderateScale(8),
      marginBottom: moderateScale(20),
    },
    profileBadgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(9),
    },
    profileBadge: {
      maxWidth: '100%',
      borderRadius: 999,
      backgroundColor: '#1098b6',
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(8),
    },
    profileBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '500',
    },
    profileListRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: moderateScale(10),
      paddingBottom: moderateScale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#d5d5d5',
    },
    profileListIcon: {
      width: moderateScale(48),
      height: moderateScale(48),
      borderRadius: moderateScale(8),
      backgroundColor: '#e1e4e9',
      resizeMode: 'contain',
      marginRight: moderateScale(10),
    },
    profileListBody: {
      flex: 1,
      minWidth: 0,
    },
    profileListTitle: {
      color: '#111111',
      fontSize: responsiveFont(16, 14, 17),
      lineHeight: responsiveFont(21, 18, 22),
      fontWeight: '700',
    },
    profileListMeta: {
      color: '#6f7b96',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '400',
      marginTop: moderateScale(3),
    },
    profilePreferenceLead: {
      color: '#111111',
      fontSize: responsiveFont(20, 17, 22),
      lineHeight: responsiveFont(27, 22, 29),
      fontWeight: '400',
      marginBottom: moderateScale(8),
    },
    profileBottomSpacer: {
      height: moderateScale(8),
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

function getProfileAgeText(profile = {}) {
  const explicitAge = Number.parseInt(profile.age, 10);
  if (Number.isFinite(explicitAge) && explicitAge > 0) {
    return `${Math.trunc(explicitAge)} years old`;
  }

  const dateOfBirth = String(profile.dateOfBirth || '').trim();
  const date = new Date(dateOfBirth);
  if (!dateOfBirth || Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (
    now.getMonth() < date.getMonth()
    || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
  ) {
    age -= 1;
  }

  return age > 0 ? `${age} years old` : '';
}

function displayText(value) {
  return String(value || '').trim();
}

function mergeProfileParticipant(primary = {}, fallback = {}) {
  const participant = { ...fallback, ...primary };

  Object.keys(fallback).forEach((key) => {
    const value = primary[key];
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      participant[key] = fallback[key];
    }
  });

  if (primary.displayName === 'Unknown user') {
    participant.displayName = fallback.displayName || primary.displayName;
  }

  return participant;
}