import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getEntitlements, getInviteCounts, getMyMatches, getPricingPlans, postMatchAction } from '../utils/backendAuth';
import { getCurrentFirebaseIdToken } from '../utils/firebaseAuth';
import { listChats } from '../utils/chatApi';
import { subscribeToChatPushEvents } from '../utils/chatPushEvents';
import { FLAG_ASSET_MAP } from '../utils/flagAssetMap';
import { useResponsiveMetrics } from '../utils/responsive';
import {
  generateRequestId,
  logAnalyticsEvent,
  processActionResponse,
  shouldShowFallbackAd,
} from '../utils/swipeMonetization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { withPlatformFontStyles } from '../utils/typography';
import InvitesScreen from './InvitesScreen';
import ChatScreen from './ChatScreen';

const PAGE_LIMIT = 20;
const MODE_MATCHMAKING = 'matchmaking';
const MODE_DISCOVER = 'discover';
const TAB_INVITES = 'invites';
const TAB_SYNC = 'sync';
const TAB_CHAT = 'chat';
const TAB_PROFILE = 'profile';

function resolveFlagSource(countryCode) {
  const normalized = String(countryCode || '').trim().toLowerCase();
  const primaryKey = `assets/flags_new/${normalized}.png`;

  if (FLAG_ASSET_MAP[primaryKey]) {
    return FLAG_ASSET_MAP[primaryKey];
  }

  return FLAG_ASSET_MAP['assets/flags_new/us.png'] || null;
}

function normalizeSkills(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function toMatchCardModel(item) {
  return {
    candidateId: item?.candidate_id ?? item?.id ?? null,
    displayName: String(item?.display_name || item?.name || 'Founder').trim(),
    profilePhotoUrl: String(item?.profile_photo_url || item?.image_url || '').trim(),
    countryCode: String(item?.country_code || '').trim(),
    locationText: String(item?.location_text || '').trim() || [item?.city, item?.country_code].filter(Boolean).join(', '),
    userRole: String(item?.user_role || '').trim() || 'Founder',
    role: String(item?.role || '').trim() || 'Cofounder',
    intentBadge: String(item?.intent_badge || '').trim() || 'Open To Explore',
    industryText:
      String(item?.industry_text || '').trim() ||
      (Array.isArray(item?.industries) && item.industries.length > 0
        ? String(item.industries[0] || '').trim()
        : ''),
    experienceSummary: String(item?.experience_summary || '').trim(),
    startupIdea: String(item?.startup_idea || '').trim(),
    bio: String(item?.bio || item?.user_bio || '').trim(),
    userSkills: normalizeSkills(item?.user_skills),
    cofounderSkills: normalizeSkills(item?.cofounder_skills),
    linkedinHeadline: String(item?.linkedin_headline || '').trim(),
    linkedinCurrentCompany: String(item?.linkedin_current_company || '').trim(),
    linkedinLocation: String(item?.linkedin_location || '').trim(),
    linkedinTopEducationSchoolName: String(item?.linkedin_top_education_school_name || '').trim(),
    linkedinExperiences: Array.isArray(item?.linkedin_experiences) ? item.linkedin_experiences : [],
    liked: Boolean(item?.liked),
    passed: Boolean(item?.passed),
    saved: Boolean(item?.saved),
  };
}

function dedupeByCandidateId(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = item?.candidateId == null ? '' : String(item.candidateId);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function MatchCard({ card, styles }) {
  const flagSource = resolveFlagSource(card.countryCode);
  const experiences = Array.isArray(card.linkedinExperiences)
    ? card.linkedinExperiences.filter(Boolean)
    : [];
  const hasExperienceSection =
    experiences.length > 0 ||
    card.linkedinCurrentCompany ||
    card.linkedinHeadline ||
    card.experienceSummary;

  return (
    <ScrollView
      style={styles.cardScroll}
      contentContainerStyle={styles.cardScrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.topSummaryCard}>
        <View style={styles.cardPhotoWrap}>
          {card.profilePhotoUrl ? (
            <Image source={{ uri: card.profilePhotoUrl }} style={styles.cardPhoto} />
          ) : (
            <Image source={require('../assets/cofounders.jpg')} style={styles.cardPhoto} />
          )}
        </View>

        <View style={styles.identityRow}>
          <View style={styles.rolePill}>
            <Image source={require('../assets/team_member.png')} style={styles.rolePillIcon} />
            <Text style={styles.rolePillText}>{card.role}</Text>
          </View>

          <View style={styles.locationWrap}>
            {flagSource ? <Image source={flagSource} style={styles.flagImage} /> : null}
            <Text style={styles.locationText} numberOfLines={1}>{card.locationText || 'Location unavailable'}</Text>
          </View>
        </View>

        <Text style={styles.nameText} numberOfLines={1}>{card.displayName}</Text>

        <View style={styles.intentWrap}>
          <View style={styles.intentAccent} />
          <Text style={styles.intentText} numberOfLines={1}>{card.intentBadge}</Text>
        </View>

        {!!card.industryText && <Text style={styles.industryText}>{card.industryText}</Text>}
      </View>

      {!!card.startupIdea && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What I'm Building/Seeking</Text>
          <Text style={styles.sectionBody}>{card.startupIdea}</Text>
        </View>
      )}

      {card.userSkills.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.chipsWrap}>
            {card.userSkills.map((skill) => (
              <View key={`user-${skill}`} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {card.cofounderSkills.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Looking for Skills</Text>
          <View style={styles.chipsWrap}>
            {card.cofounderSkills.map((skill) => (
              <View key={`cofounder-${skill}`} style={styles.skillChip}>
                <Text style={styles.skillChipText}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {hasExperienceSection && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {experiences.length > 0 ? (
            experiences.map((experience, index) => (
              <View
                key={`${experience?.company || experience?.company_name || 'company'}-${experience?.title || 'title'}-${index}`}
                style={[
                  styles.experienceRow,
                  index > 0 && styles.experienceRowSpaced,
                  index < experiences.length - 1 && styles.experienceRowWithDivider,
                ]}
              >
                <Image source={require('../assets/internship_green.png')} style={styles.experienceIcon} />
                <View style={styles.experienceCopy}>
                  {!!(experience?.company_name || experience?.company) && (
                    <Text style={styles.experienceCompany}>
                      {experience?.company_name || experience?.company}
                    </Text>
                  )}
                  {!!experience?.title && (
                    <Text style={styles.experienceRole}>
                      {experience.title}
                    </Text>
                  )}
                  {!!(experience?.duration || experience?.date_range) && (
                    <Text style={styles.experienceDate}>
                      {experience?.duration || experience?.date_range}
                    </Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.experienceRow}>
              <Image source={require('../assets/internship_green.png')} style={styles.experienceIcon} />
              <View style={styles.experienceCopy}>
                {!!card.linkedinCurrentCompany && (
                  <Text style={styles.experienceCompany}>
                    {card.linkedinCurrentCompany}
                  </Text>
                )}
                {!!card.linkedinHeadline && (
                  <Text style={styles.experienceRole}>
                    {card.linkedinHeadline}
                  </Text>
                )}
                {!!card.experienceSummary && (
                  <Text style={styles.experienceDate}>
                    {card.experienceSummary}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function DiscoverListItem({ card, styles, onPress }) {
  const flagSource = resolveFlagSource(card.countryCode);

  return (
    <Pressable style={styles.discoverItem} onPress={() => onPress?.(card)}>
      <View style={styles.discoverPhotoWrap}>
        {card.profilePhotoUrl ? (
          <Image source={{ uri: card.profilePhotoUrl }} style={styles.discoverPhoto} />
        ) : (
          <Image source={require('../assets/cofounders.jpg')} style={styles.discoverPhoto} />
        )}
      </View>

      <View style={styles.discoverContent}>
        <View style={styles.discoverHeaderRow}>
          <Text style={styles.discoverName} numberOfLines={1}>{card.displayName}</Text>
          <View style={styles.discoverLocationWrap}>
            {flagSource ? <Image source={flagSource} style={styles.discoverFlag} /> : null}
            <Text style={styles.discoverLocation} numberOfLines={1}>{card.locationText}</Text>
          </View>
        </View>

        {!!card.bio && (
          <Text style={styles.discoverBio} numberOfLines={3}>
            {`\u201c${card.bio}\u201d`}
          </Text>
        )}

        <View style={styles.discoverBadgePill}>
          <Text style={styles.discoverBadgeText} numberOfLines={1}>{card.intentBadge}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen({
  firebaseToken = '',
  onAuthExpired,
  backendUserId = '',
  chatNotificationLaunch = null,
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);
  const swipePosition = useRef(new Animated.ValueXY()).current;

  const [mode, setMode] = useState(MODE_MATCHMAKING);
  const [activeBottomTab, setActiveBottomTab] = useState(TAB_SYNC);
  const [chatLaunchContext, setChatLaunchContext] = useState({
    conversationId: '',
    initialMessageId: '',
  });
  const [inviteUnreadCount, setInviteUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [cards, setCards] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaging, setIsPaging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [likeModal, setLikeModal] = useState({ visible: false, card: null });
  const [selectedDiscoverCard, setSelectedDiscoverCard] = useState(null);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isSendingLike, setIsSendingLike] = useState(false);
  const [isSubmittingCardAction, setIsSubmittingCardAction] = useState(false);
  const [likeError, setLikeError] = useState('');

  // Monetization state
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [interstitialVisible, setInterstitialVisible] = useState(false);
  const [swipesUsed, setSwipesUsed] = useState(null);
  const [swipesRemaining, setSwipesRemaining] = useState(null);
  const [invitesUpgradeSignal, setInvitesUpgradeSignal] = useState(0);
  // resumedAfterPaywall enables the local fallback ad counter (every 4 swipes)
  const [resumedAfterPaywall, setResumedAfterPaywall] = useState(false);
  const [entitlements, setEntitlements] = useState(null);
  const [pricingPlans, setPricingPlans] = useState([]);
  const resumeActionCountRef = useRef(0);
  const invitesUpgradeRequestedRef = useRef(false);
  // Holds the card-advance callback to execute once the interstitial is dismissed
  const pendingAdvanceRef = useRef(null);

  const CONNECTION_MESSAGE_LIMIT = 1000;
  const trimmedConnectionMessage = connectionMessage.trim();
  // Disable the Send Like button when a submission is already in flight or message is empty
  const isSendLikeDisabled = isSubmittingCardAction || !trimmedConnectionMessage;

  const currentCard = cards[activeIndex] || null;
  const nextCard = cards[activeIndex + 1] || null;
  const remainingCards = Math.max(cards.length - activeIndex, 0);
  const actionTargetCard = mode === MODE_DISCOVER ? selectedDiscoverCard : currentCard;

  const swipeThreshold = Math.min(metrics.vw(22), 120);

  const resolveInviteUnreadCount = useCallback((payload = {}) => {
    const directCandidates = [
      payload?.unread_count,
      payload?.unread,
      payload?.pending,
      payload?.pending_count,
      payload?.pending_invites,
      payload?.received_pending,
      payload?.invitations_unread,
      payload?.invitations_pending,
      payload?.invites_unread,
      payload?.total,
    ];

    for (const candidate of directCandidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }

    if (payload && typeof payload === 'object') {
      const nested = payload?.counts && typeof payload.counts === 'object' ? payload.counts : null;
      const fromNested = nested
        ? [
          nested?.unread,
          nested?.pending,
          nested?.invitations,
          nested?.received_pending,
        ]
        : [];

      for (const candidate of fromNested) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed) && parsed >= 0) {
          return Math.floor(parsed);
        }
      }
    }

    return 0;
  }, []);

  const fetchUnreadBadges = useCallback(async () => {
    try {
      const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
      const inviteResult = await getInviteCounts({ firebaseToken: token }).catch(() => ({}));
      setInviteUnreadCount(resolveInviteUnreadCount(inviteResult));

      let totalChatUnread = 0;
      let cursor = null;
      let hasMore = true;
      let pageGuard = 0;

      while (hasMore && pageGuard < 5) {
        pageGuard += 1;
        const chatPage = await listChats({
          firebaseToken: token,
          limit: 100,
          cursor,
        });

        totalChatUnread += (chatPage?.items || []).reduce((sum, item) => {
          const unread = Number(item?.unreadCount || 0);
          return sum + (Number.isFinite(unread) && unread > 0 ? unread : 0);
        }, 0);

        hasMore = Boolean(chatPage?.hasMore);
        cursor = chatPage?.nextCursor || null;
        if (!cursor) {
          break;
        }
      }

      setChatUnreadCount(Math.max(0, Math.floor(totalChatUnread)));
    } catch (error) {
      const isAuthError =
        error?.status === 401 ||
        /invalid firebase token|unauthori[sz]ed|token/i.test(String(error?.message || ''));

      if (isAuthError) {
        onAuthExpired?.();
      }
    }
  }, [firebaseToken, onAuthExpired, resolveInviteUnreadCount]);

  const loadMatches = useCallback(
    async ({ requestedMode = mode, cursor = null, refresh = false, append = false } = {}) => {
      if (append) {
        setIsPaging(true);
      } else {
        setIsInitialLoading(true);
      }

      if (!append) {
        setErrorMessage('');
      }

      try {
        const payload = await getMyMatches({
          firebaseToken,
          getFirebaseToken: (forceRefresh) => getCurrentFirebaseIdToken(forceRefresh),
          mode: requestedMode,
          limit: PAGE_LIMIT,
          cursor,
          refresh,
        });

        const normalizedItems = (payload?.items || []).map(toMatchCardModel);

        setCards((prev) => {
          if (!append) {
            return dedupeByCandidateId(normalizedItems);
          }

          return dedupeByCandidateId([...prev, ...normalizedItems]);
        });

        setNextCursor(payload?.nextCursor || null);
        if (!append) {
          setActiveIndex(0);
        }
      } catch (error) {
        const isAuthError =
          error?.status === 401 ||
          error?.code === 'no_current_user' ||
          /invalid firebase token|unauthori[sz]ed|token/i.test(String(error?.message || ''));

        if (isAuthError) {
          onAuthExpired?.();
          return;
        }

        setErrorMessage(error?.message || 'Could not load matches. Please try again.');
      } finally {
        setIsInitialLoading(false);
        setIsPaging(false);
      }
    },
    [firebaseToken, mode, onAuthExpired],
  );

  useEffect(() => {
    loadMatches({ requestedMode: mode, refresh: true, append: false });
  }, [loadMatches, mode]);

  useEffect(() => {
    if (mode !== MODE_DISCOVER) {
      setSelectedDiscoverCard(null);
    }
  }, [mode]);

  useEffect(() => {
    if (remainingCards > 3) {
      return;
    }

    if (!nextCursor || isPaging || isInitialLoading) {
      return;
    }

    loadMatches({ requestedMode: mode, cursor: nextCursor, append: true });
  }, [isInitialLoading, isPaging, loadMatches, mode, nextCursor, remainingCards]);

  const goToNextCard = useCallback(() => {
    setActiveIndex((prev) => prev + 1);
    swipePosition.setValue({ x: 0, y: 0 });
  }, [swipePosition]);

  const animateCardOut = useCallback(
    (direction) => {
      const toValueX = direction === 'right' ? metrics.vw(120) : -metrics.vw(120);
      Animated.timing(swipePosition, {
        toValue: { x: toValueX, y: 0 },
        duration: 180,
        useNativeDriver: false,
      }).start(() => {
        goToNextCard();
      });
    },
    [goToNextCard, metrics, swipePosition],
  );

  const springCardBack = useCallback(() => {
    Animated.spring(swipePosition, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [swipePosition]);

  const openLikeModal = useCallback((card) => {
    springCardBack();
    setConnectionMessage('');
    setLikeError('');
    setLikeModal({ visible: true, card });
  }, [springCardBack]);

  const closeLikeModal = useCallback(() => {
    setLikeModal({ visible: false, card: null });
    setConnectionMessage('');
    setLikeError('');
  }, []);

  // ---------------------------------------------------------------------------
  // Entitlements — fetched on mount and on app foreground resume.
  // Server response from the action endpoint is the source of truth for
  // paywall/ad triggers; entitlements are advisory for UI indicators only.
  // ---------------------------------------------------------------------------
  const fetchEntitlements = useCallback(async () => {
    try {
      const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
      const data = await getEntitlements(token);
      setEntitlements(data);
      const nextTier = String(data?.tier || data?.plan_tier || '').trim().toLowerCase();
      if (invitesUpgradeRequestedRef.current && nextTier === 'premium') {
        invitesUpgradeRequestedRef.current = false;
        setInvitesUpgradeSignal((prev) => prev + 1);
      }
      if (data?.matchmaking_swipe_limit != null) {
        setSwipesRemaining(data.matchmaking_swipe_limit);
      }
    } catch {
      // Entitlements are advisory — silently ignore errors
    }
  }, [firebaseToken]);

  const fetchPricingPlans = useCallback(async () => {
    try {
      const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
      const plans = await getPricingPlans(token);
      setPricingPlans(Array.isArray(plans) ? plans : []);
    } catch {
      setPricingPlans([]);
    }
  }, [firebaseToken]);

  useEffect(() => {
    fetchEntitlements();
    fetchPricingPlans();
    fetchUnreadBadges();
  }, [fetchEntitlements, fetchPricingPlans, fetchUnreadBadges]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchEntitlements();
        fetchPricingPlans();
        fetchUnreadBadges();
      }
    });
    return () => subscription.remove();
  }, [fetchEntitlements, fetchPricingPlans, fetchUnreadBadges]);

  useEffect(() => {
    if (activeBottomTab === TAB_SYNC) {
      fetchUnreadBadges();
    }
  }, [activeBottomTab, fetchUnreadBadges]);

  useEffect(() => {
    const conversationId = String(chatNotificationLaunch?.conversationId || '').trim();
    if (!conversationId) {
      return;
    }

    setChatLaunchContext({
      conversationId,
      initialMessageId: String(chatNotificationLaunch?.initialMessageId || '').trim(),
    });
    setActiveBottomTab(TAB_CHAT);
  }, [chatNotificationLaunch]);

  useEffect(() => {
    const unsubscribe = subscribeToChatPushEvents((event) => {
      if (!event?.type) {
        return;
      }

      if (event.type === 'chat.message.created' || event.type === 'chat.message.read') {
        void fetchUnreadBadges();
      }
    });

    return unsubscribe;
  }, [fetchUnreadBadges]);

  const premiumPlan = useMemo(
    () => pricingPlans.find((plan) => String(plan?.tier || '').toLowerCase() === 'premium') || null,
    [pricingPlans],
  );

  const premiumPriceAmount = useMemo(() => {
    const priceMinor = Number(premiumPlan?.price_minor);
    if (!Number.isFinite(priceMinor)) {
      return '9.99';
    }

    return (priceMinor / 100).toFixed(2);
  }, [premiumPlan]);

  const premiumCurrencySymbol = useMemo(() => {
    const currencyCode = String(premiumPlan?.currency_code || 'USD').toUpperCase();
    return currencyCode === 'USD' ? '$' : currencyCode;
  }, [premiumPlan]);

  // ---------------------------------------------------------------------------
  // Unified swipe action handler — used by all four entry points:
  //   left-swipe gesture, right-swipe gesture, pass button, like button.
  //
  // Handles backend response flags:
  //   swipe_allowed=false + paywall_required=true → open paywall, keep card
  //   ad_due_now=true                             → show interstitial, then advance
  //   mutual_match=true                           → analytics + advance normally
  //
  // Backend caveat: free users hit a 10-swipe daily cap. After "Maybe Later"
  // dismissal, subsequent calls may STILL return paywall_required=true. The
  // frontend handles this gracefully by just re-showing the paywall modal.
  // ---------------------------------------------------------------------------
  const swipeAction = useCallback(
    async ({ card, action, connectionMessage: msgOverride = '', onClose } = {}) => {
      if (!card || isSubmittingCardAction) {
        return;
      }

      setIsSubmittingCardAction(true);
      if (action === 'like') {
        setIsSendingLike(true);
        setLikeError('');
      }

      const requestId = generateRequestId();
      logAnalyticsEvent('matches_action_submitted', { action, candidateId: card.candidateId });

      try {
        const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
        const rawResult = await postMatchAction({
          firebaseToken: token,
          candidateId: card.candidateId,
          action,
          connectionMessage: msgOverride,
          requestId,
        });

        const result = processActionResponse(rawResult);

        if (rawResult?.swipes_used != null) {
          setSwipesUsed(rawResult.swipes_used);
        }
        if (rawResult?.swipes_remaining != null) {
          setSwipesRemaining(rawResult.swipes_remaining);
        }

        // --- Paywall required: keep card, show paywall, do not advance ---
        if (result.isPaywallRequired) {
          logAnalyticsEvent('matches_action_paywall_required', { candidateId: card.candidateId });
          onClose?.();
          setPaywallVisible(true);
          return;
        }

        // --- Mutual match: log analytics, then advance normally ---
        if (result.isMutualMatch) {
          logAnalyticsEvent('matches_mutual_match', { candidateId: card.candidateId });
          // Existing UX: no dedicated mutual match modal — advance card as normal
        }

        onClose?.();

        // Build the advance callback based on action type and current mode
        const advanceCard = () => {
          if (mode === MODE_DISCOVER) {
            setCards((prev) => prev.filter((item) => item.candidateId !== card.candidateId));
            setSelectedDiscoverCard(null);
            return;
          }
          if (action === 'pass') {
            animateCardOut('left');
          } else if (action === 'like') {
            animateCardOut('right');
          } else {
            // save and other non-directional actions
            goToNextCard();
          }
        };

        // --- Backend-triggered interstitial ---
        if (result.isAdDueNow) {
          logAnalyticsEvent('matches_interstitial_shown', { trigger: 'backend' });
          pendingAdvanceRef.current = advanceCard;
          setInterstitialVisible(true);
          return;
        }

        // --- Local fallback interstitial (active only after "Maybe Later") ---
        if (resumedAfterPaywall) {
          resumeActionCountRef.current += 1;
          if (shouldShowFallbackAd(resumeActionCountRef.current)) {
            resumeActionCountRef.current = 0;
            logAnalyticsEvent('matches_interstitial_shown', { trigger: 'local_fallback' });
            pendingAdvanceRef.current = advanceCard;
            setInterstitialVisible(true);
            return;
          }
        }

        advanceCard();
      } catch (error) {
        const isAuthError =
          error?.status === 401 ||
          /invalid firebase token|unauthori[sz]ed|token/i.test(String(error?.message || ''));

        if (isAuthError) {
          onAuthExpired?.();
          return;
        }

        if (action === 'like') {
          setLikeError(error?.message || 'Could not send like. Please try again.');
        }
      } finally {
        setIsSubmittingCardAction(false);
        if (action === 'like') {
          setIsSendingLike(false);
        }
      }
    },
    [
      animateCardOut,
      firebaseToken,
      goToNextCard,
      isSubmittingCardAction,
      mode,
      onAuthExpired,
      resumedAfterPaywall,
    ],
  );

  const handlePassAction = useCallback(() => {
    if (!actionTargetCard) {
      return;
    }
    void swipeAction({ card: actionTargetCard, action: 'pass' });
  }, [actionTargetCard, swipeAction]);

  const handleDiscoverEndReached = useCallback(() => {
    if (!nextCursor || isPaging || isInitialLoading) {
      return;
    }

    loadMatches({ requestedMode: MODE_DISCOVER, cursor: nextCursor, append: true });
  }, [isInitialLoading, isPaging, loadMatches, nextCursor]);

  const handleSaveAction = useCallback(() => {
    if (!actionTargetCard) {
      return;
    }
    void swipeAction({ card: actionTargetCard, action: 'save' });
  }, [actionTargetCard, swipeAction]);

  const handleSelectDiscoverCard = useCallback((card) => {
    setSelectedDiscoverCard(card || null);
  }, []);

  const handleBackToDiscoverList = useCallback(() => {
    setSelectedDiscoverCard(null);
  }, []);

  const handleSendLike = useCallback(() => {
    if (!likeModal.card || isSendLikeDisabled) {
      return;
    }
    void swipeAction({
      card: likeModal.card,
      action: 'like',
      connectionMessage: trimmedConnectionMessage,
      onClose: closeLikeModal,
    });
  }, [closeLikeModal, isSendLikeDisabled, likeModal.card, swipeAction, trimmedConnectionMessage]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const horizontalDistance = Math.abs(gestureState.dx);
          const verticalDistance = Math.abs(gestureState.dy);
          return horizontalDistance > 8 && horizontalDistance > verticalDistance;
        },
        onPanResponderMove: Animated.event([
          null,
          {
            dx: swipePosition.x,
            dy: swipePosition.y,
          },
        ], { useNativeDriver: false }),
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > swipeThreshold) {
            if (currentCard) {
              openLikeModal(currentCard);
            }
            return;
          }

          if (gestureState.dx < -swipeThreshold) {
            handlePassAction();
            return;
          }

          Animated.spring(swipePosition, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 80,
            useNativeDriver: false,
          }).start();
        },
      }),
    [handlePassAction, openLikeModal, currentCard, swipePosition, swipeThreshold],
  );

  const cardRotation = swipePosition.x.interpolate({
    inputRange: [-metrics.vw(60), 0, metrics.vw(60)],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const cardTransformStyle = {
    transform: [
      { translateX: swipePosition.x },
      { translateY: swipePosition.y },
      { rotate: cardRotation },
    ],
  };

  const handleNavigateBottomTab = useCallback((tabOrPayload) => {
    const payload = typeof tabOrPayload === 'string'
      ? { tab: tabOrPayload }
      : (tabOrPayload || {});

    const normalized = String(payload?.tab || payload?.key || '').trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (payload?.openPaywall) {
      if (payload?.source === 'invites') {
        invitesUpgradeRequestedRef.current = true;
      }

      setActiveBottomTab(TAB_SYNC);
      setPaywallVisible(true);
      return;
    }

    if (normalized === TAB_CHAT) {
      setChatLaunchContext({
        conversationId: String(payload?.conversationId || '').trim(),
        initialMessageId: String(payload?.initialMessageId || '').trim(),
      });
    }

    setActiveBottomTab(normalized);
  }, []);

  const handleDismissPaywall = useCallback(() => {
    logAnalyticsEvent('matches_paywall_maybe_later');
    setResumedAfterPaywall(true);
    resumeActionCountRef.current = 0;
    setPaywallVisible(false);
  }, []);

  if (activeBottomTab === TAB_INVITES) {
    return (
      <InvitesScreen
        firebaseToken={firebaseToken}
        onAuthExpired={onAuthExpired}
        onNavigate={handleNavigateBottomTab}
        upgradeUnlockSignal={invitesUpgradeSignal}
      />
    );
  }

  if (activeBottomTab === TAB_CHAT) {
    return (
      <ChatScreen
        onNavigate={handleNavigateBottomTab}
        firebaseToken={firebaseToken}
        onAuthExpired={onAuthExpired}
        launchConversationId={chatLaunchContext.conversationId}
        launchInitialMessageId={chatLaunchContext.initialMessageId}
        currentUserId={String(backendUserId || '')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrap}>
        <Pressable style={styles.iconButton}>
          <Image source={require('../assets/filter.png')} style={styles.headerIcon} />
        </Pressable>

        <Image source={require('../assets/syncfound_text_logo_black.png')} style={styles.wordmarkImage} />

        <Pressable style={styles.iconButton}>
          <Image source={require('../assets/search.png')} style={styles.headerIcon} />
        </Pressable>
      </View>

      <View style={styles.modeSwitch}>
        <Pressable
          style={[styles.modeButton, mode === MODE_MATCHMAKING && styles.modeButtonActive]}
          onPress={() => setMode(MODE_MATCHMAKING)}
        >
          <Text style={[styles.modeButtonText, mode === MODE_MATCHMAKING && styles.modeButtonTextActive]}>
            Matchmaking
          </Text>
        </Pressable>

        <Pressable
          style={[styles.modeButton, mode === MODE_DISCOVER && styles.modeButtonActive]}
          onPress={() => setMode(MODE_DISCOVER)}
        >
          <Text style={[styles.modeButtonText, mode === MODE_DISCOVER && styles.modeButtonTextActive]}>
            Discover Founders
          </Text>
        </Pressable>
      </View>

      <View style={styles.deckWrap}>
        {isInitialLoading ? (
          <View style={styles.placeholderWrap}>
            <ActivityIndicator size="large" color="#31c6d5" />
          </View>
        ) : errorMessage ? (
          <View style={styles.placeholderWrap}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => loadMatches({ requestedMode: mode, refresh: true, append: false })}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : !currentCard ? (
          <View style={styles.placeholderWrap}>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySubtitle}>Invite more founders and check back soon.</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => loadMatches({ requestedMode: mode, refresh: true, append: false })}
            >
              <Text style={styles.retryButtonText}>Refresh</Text>
            </Pressable>
          </View>
        ) : mode === MODE_DISCOVER ? (
          selectedDiscoverCard ? (
            <View style={styles.discoverDetailWrap}>
              <Pressable style={styles.discoverBackButton} onPress={handleBackToDiscoverList}>
                <Text style={styles.discoverBackButtonText}>Back to Discover</Text>
              </Pressable>
              <MatchCard card={selectedDiscoverCard} styles={styles} />
            </View>
          ) : (
            <FlatList
              data={cards}
              keyExtractor={(item) => String(item.candidateId ?? item.displayName)}
              renderItem={({ item }) => (
                <DiscoverListItem card={item} styles={styles} onPress={handleSelectDiscoverCard} />
              )}
              contentContainerStyle={styles.discoverListContent}
              showsVerticalScrollIndicator={false}
              onEndReached={handleDiscoverEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                isPaging ? (
                  <View style={styles.discoverPagingRow}>
                    <ActivityIndicator size="small" color="#31c6d5" />
                  </View>
                ) : null
              }
            />
          )
        ) : (
          <Animated.View style={[styles.swipeCard, cardTransformStyle]} {...panResponder.panHandlers}>
            <MatchCard card={currentCard} styles={styles} />
          </Animated.View>
        )}
      </View>

      {!isInitialLoading && !!actionTargetCard && (mode !== MODE_DISCOVER || !!selectedDiscoverCard) ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={handlePassAction} disabled={isSubmittingCardAction}>
            <Image source={require('../assets/pass.png')} style={styles.actionIcon} />
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleSaveAction} disabled={isSubmittingCardAction}>
            <Image source={require('../assets/save.png')} style={styles.actionIcon} />
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => actionTargetCard && openLikeModal(actionTargetCard)}>
            <Image source={require('../assets/heart.png')} style={styles.actionIcon} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomTabBar}>
        <Pressable style={styles.tabItem} onPress={() => handleNavigateBottomTab(TAB_INVITES)}>
          <View style={styles.tabIconWrap}>
            <Image source={require('../assets/invites-inactive.png')} style={styles.tabIcon} />
            {inviteUnreadCount > 0 ? (
              <View style={styles.tabBadgeWrap}>
                <Text style={styles.tabBadgeText}>{inviteUnreadCount > 99 ? '99+' : String(inviteUnreadCount)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tabLabel}>Invites</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => handleNavigateBottomTab(TAB_SYNC)}>
          <Image source={require('../assets/sync-active.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabelActive}>Sync</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => handleNavigateBottomTab(TAB_CHAT)}>
          <View style={styles.tabIconWrap}>
            <Image source={require('../assets/chat-inactive.png')} style={styles.tabIcon} />
            {chatUnreadCount > 0 ? (
              <View style={styles.tabBadgeWrap}>
                <Text style={styles.tabBadgeText}>{chatUnreadCount > 99 ? '99+' : String(chatUnreadCount)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tabLabel}>Chat</Text>
        </Pressable>

        <Pressable style={styles.tabItem} onPress={() => handleNavigateBottomTab(TAB_PROFILE)}>
          <Image source={require('../assets/profile-inactive.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Profile</Text>
        </Pressable>
      </View>

      {isPaging ? (
        <View style={styles.pagingIndicatorWrap}>
          <ActivityIndicator size="small" color="#31c6d5" />
        </View>
      ) : null}

      <Modal
        visible={likeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeLikeModal}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <BlurView intensity={28} tint="dark" style={styles.modalBlur} />
          <View style={styles.modalTint} />
          <Pressable style={styles.modalBackdropPressable} onPress={closeLikeModal} />

          <View style={styles.modalCardContainer}>
            <View style={styles.modalCard}>
            {likeModal.card?.profilePhotoUrl ? (
              <Image
                source={{ uri: likeModal.card.profilePhotoUrl }}
                style={styles.modalPhoto}
              />
            ) : (
              <Image
                source={require('../assets/cofounders.jpg')}
                style={styles.modalPhoto}
              />
            )}

            <Text style={styles.modalName} numberOfLines={1}>
              {likeModal.card?.displayName || ''}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Write a connection message…"
              placeholderTextColor="#a0a0a0"
              value={connectionMessage}
              onChangeText={(text) => {
                setConnectionMessage(text.slice(0, CONNECTION_MESSAGE_LIMIT));
                if (likeError) {
                  setLikeError('');
                }
              }}
              multiline
              textAlignVertical="top"
              maxLength={CONNECTION_MESSAGE_LIMIT}
            />

            <Text style={styles.modalCharCounter}>
              {connectionMessage.length}/{CONNECTION_MESSAGE_LIMIT}
            </Text>

            {!!likeError && (
              <Text style={styles.modalErrorText}>{likeError}</Text>
            )}

            <Pressable
              style={[styles.modalSendButton, isSendLikeDisabled && styles.modalSendButtonDisabled]}
              onPress={handleSendLike}
              disabled={isSendLikeDisabled}
            >
              {isSendingLike ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Image source={require('../assets/heart-white.png')} style={styles.modalSendIcon} />
                  <Text style={styles.modalSendButtonText}>Send Like</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={closeLikeModal} hitSlop={10}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Paywall modal — shown when backend returns paywall_required=true    */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={paywallVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={handleDismissPaywall}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <LinearGradient
          colors={['#f8fcfb', '#eef8f6', '#e7f5f3']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.paywallContainer}
        >
          <View style={styles.paywallTopBar}>
            <View style={styles.paywallLogoRow}>
              <Pressable hitSlop={12} onPress={handleDismissPaywall} accessibilityRole="button" accessibilityLabel="Close paywall">
                <Text style={styles.paywallCloseText}>✕</Text>
              </Pressable>
              <Image
                source={require('../assets/syncfound_text_logo_green.png')}
                style={styles.paywallWordmark}
              />
            </View>

            <Pressable hitSlop={12}>
              <Text style={styles.paywallHelpText}>Help</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.paywallScroll}
            contentContainerStyle={styles.paywallScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.paywallHeroSection}>
              <View style={styles.paywallMembershipPill}>
                <Text style={styles.paywallMembershipPillText}>PREMIUM MEMBERSHIP</Text>
              </View>

              <Text style={styles.paywallTitle}>
                {'Get\nSyncFound\n'}
                <Text style={styles.paywallTitleAccent}>Premium</Text>
              </Text>

              <Text style={styles.paywallSubtitle}>
                Supercharge your founder journey with exclusive tools and high-tier networking.
              </Text>

              <View style={styles.paywallHeroImageWrap}>
                <Image
                  source={require('../assets/syncfound-premium-screen-hero-image.png')}
                  style={styles.paywallHeroImage}
                />

                <View style={styles.paywallEliteCard}>
                  <Image source={require('../assets/elite-status.png')} style={styles.paywallEliteIcon} />
                  <View style={styles.paywallEliteContent}>
                    <Text style={styles.paywallEliteTitle}>Elite Status</Text>
                    <Text style={styles.paywallEliteBody}>Join the top 5% of ambitious builders globally.</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.paywallFeatureCard}>
              <Image source={require('../assets/unlimited-swipes.png')} style={styles.paywallFeatureIcon} />
              <Text style={styles.paywallFeatureTitle}>Unlimited Swipes</Text>
              <Text style={styles.paywallFeatureBody}>Match without limits. Keep exploring until you find the perfect synergy.</Text>
            </View>

            <View style={styles.paywallFeatureCard}>
              <Image source={require('../assets/ad-free.png')} style={styles.paywallFeatureIcon} />
              <Text style={styles.paywallFeatureTitle}>Ad-Free Experience</Text>
              <Text style={styles.paywallFeatureBody}>No interruptions. Focus purely on building meaningful connections.</Text>
            </View>

            <View style={styles.paywallFeatureCard}>
              <Image source={require('../assets/access-vc-investors.png')} style={styles.paywallFeatureIcon} />
              <Text style={styles.paywallFeatureTitle}>VC & Investor Access</Text>
              <Text style={styles.paywallFeatureBody}>Direct introductions to top-tier investors and venture partners.</Text>
            </View>

            <View style={styles.paywallFeatureCard}>
              <Image source={require('../assets/curated-events.png')} style={styles.paywallFeatureIcon} />
              <Text style={styles.paywallFeatureTitle}>Curated Events</Text>
              <Text style={styles.paywallFeatureBody}>Exclusive access to invite-only founder networking dinners.</Text>
            </View>

            <View style={styles.paywallBottomSheet}>
              <View style={styles.paywallBottomDecor} />
              <Text style={styles.paywallBottomTitle}>Premium Membership</Text>

              <View style={styles.paywallPriceRow}>
                <Text style={styles.paywallCurrencyText}>{premiumCurrencySymbol}</Text>
                <Text style={styles.paywallPriceValue}>{premiumPriceAmount}</Text>
                <Text style={styles.paywallPriceUnit}>/ month</Text>
              </View>

              <Text style={styles.paywallBillingText}>Billed monthly. Cancel anytime with one click.</Text>

              <View style={styles.paywallUpgradeWrap}>
                <Pressable style={styles.paywallUpgradeButton}>
                  <Text style={styles.paywallUpgradeText}>Upgrade Now</Text>
                </Pressable>
              </View>

              <Pressable
                hitSlop={12}
                onPress={handleDismissPaywall}
              >
                <Text style={styles.paywallMaybeLaterText}>Maybe Later</Text>
              </Pressable>

              <View style={styles.paywallSecurityRow}>
                <Image source={require('../assets/verified.png')} style={styles.paywallSecurityIcon} />
                <Image source={require('../assets/padlock.png')} style={styles.paywallSecurityIcon} />
                <Image source={require('../assets/card.png')} style={styles.paywallSecurityIcon} />
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </Modal>

      {/* ------------------------------------------------------------------ */}
      {/* Interstitial ad placeholder                                         */}
      {/* Replace inner content with your ad SDK (e.g. react-native-google-  */}
      {/* mobile-ads InterstitialAd) when available.                          */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        visible={interstitialVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          const advance = pendingAdvanceRef.current;
          pendingAdvanceRef.current = null;
          setInterstitialVisible(false);
          advance?.();
        }}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <View style={styles.interstitialBackdrop}>
          <View style={styles.interstitialCard}>
            <Text style={styles.interstitialLabel}>Advertisement</Text>
            {/* Ad SDK component goes here */}
            <View style={styles.interstitialAdPlaceholder}>
              <Text style={styles.interstitialAdPlaceholderText}>Ad</Text>
            </View>
            <Pressable
              style={styles.interstitialContinueButton}
              onPress={() => {
                const advance = pendingAdvanceRef.current;
                pendingAdvanceRef.current = null;
                setInterstitialVisible(false);
                advance?.();
              }}
            >
              <Text style={styles.interstitialContinueText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, insets = {}) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;
  const topInset = insets?.top || 0;
  const bottomInset = insets?.bottom || 0;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#dfddd5',
      paddingTop: topInset + (isShortScreen ? vh(1.2) : vh(1.8)),
      paddingBottom: moderateScale(96) + bottomInset,
    },
    headerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(4),
    },
    iconButton: {
      width: moderateScale(36),
      height: moderateScale(36),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      width: moderateScale(24),
      height: moderateScale(24),
      resizeMode: 'contain',
      tintColor: '#181818',
    },
    wordmarkImage: {
      width: vw(isNarrowScreen ? 42 : 45),
      height: vh(5),
      resizeMode: 'contain',
      tintColor: '#3d556e',
    },
    modeSwitch: {
      marginTop: vh(1.8),
      marginHorizontal: vw(4),
      backgroundColor: '#585858',
      borderRadius: moderateScale(28),
      padding: moderateScale(4),
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: '#9e9e9e',
    },
    modeButton: {
      flex: 1,
      minHeight: moderateScale(48),
      borderRadius: moderateScale(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeButtonActive: {
      backgroundColor: '#f5f5f5',
    },
    modeButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 15, 13, 17),
      lineHeight: responsiveFont(isShortScreen ? 22 : 20, 16, 24),
      fontWeight: '500',
    },
    modeButtonTextActive: {
      color: '#4f4f4f',
    },
    deckWrap: {
      flex: 1,
      marginTop: vh(1.4),
    },
    swipeCard: {
      flex: 1,
    },
    cardScroll: {
      flex: 1,
      width: '100%',
    },
    cardScrollContent: {
      paddingBottom: vh(3),
    },
    topSummaryCard: {
      marginTop: vh(1.8),
      marginHorizontal: vw(4.2),
      borderRadius: moderateScale(20),
      backgroundColor: '#ffffff',
      paddingHorizontal: vw(4.4),
      paddingTop: vh(1.6),
      paddingBottom: vh(1.5),
    },
    cardPhotoWrap: {
      borderRadius: moderateScale(24),
      overflow: 'hidden',
      backgroundColor: '#d7d7d7',
    },
    cardPhoto: {
      width: '100%',
      height: vh(isShortScreen ? 28 : 30),
      resizeMode: 'cover',
    },
    identityRow: {
      marginTop: vh(1.8),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rolePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2eb8c6',
      borderRadius: 999,
      paddingHorizontal: vw(3.4),
      minHeight: moderateScale(46),
      gap: moderateScale(8),
    },
    rolePillIcon: {
      width: moderateScale(20),
      height: moderateScale(20),
      resizeMode: 'contain',
      tintColor: '#ffffff',
    },
    rolePillText: {
      color: '#ffffff',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '500',
    },
    locationWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: vw(2),
      flex: 1,
      justifyContent: 'flex-end',
    },
    flagImage: {
      width: moderateScale(34),
      height: moderateScale(24),
      resizeMode: 'contain',
      marginRight: moderateScale(7),
    },
    locationText: {
      maxWidth: '68%',
      color: '#515151',
      fontSize: responsiveFont(17, 13, 18),
      lineHeight: responsiveFont(21, 16, 22),
      fontWeight: '400',
      textAlign: 'right',
    },
    nameText: {
      marginTop: vh(1.2),
      color: '#161616',
      fontSize: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      lineHeight: responsiveFont(isShortScreen ? 30 : 32, 24, 34),
      fontWeight: '500',
    },
    intentWrap: {
      marginTop: vh(1.4),
      marginLeft: -vw(4.4),
      width: '50%',
      alignSelf: 'flex-start',
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      borderTopRightRadius: moderateScale(20),
      borderBottomRightRadius: moderateScale(20),
      backgroundColor: '#2eb8c6',
      minHeight: moderateScale(52),
      justifyContent: 'center',
      paddingLeft: vw(7),
      position: 'relative',
      overflow: 'hidden',
    },
    intentAccent: {
      position: 'absolute',
      left: moderateScale(3),
      top: moderateScale(7),
      bottom: moderateScale(7),
      width: moderateScale(8),
      backgroundColor: '#f0ece3',
      borderRadius: moderateScale(6),
    },
    intentText: {
      color: '#ffffff',
      fontSize: responsiveFont(18, 14, 20),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
    },
    industryText: {
      marginTop: vh(1.3),
      color: '#9a9a9a',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '400',
    },
    sectionCard: {
      marginTop: vh(1.8),
      marginHorizontal: vw(4.2),
      borderRadius: moderateScale(20),
      backgroundColor: '#ffffff',
      paddingHorizontal: vw(5),
      paddingVertical: vh(1.5),
    },
    sectionTitle: {
      color: '#151515',
      fontSize: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 24, 32),
      fontWeight: '500',
    },
    sectionBody: {
      marginTop: vh(0.6),
      color: '#a0a0a0',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '400',
    },
    chipsWrap: {
      marginTop: vh(1.2),
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(10),
    },
    skillChip: {
      backgroundColor: '#0f99b5',
      minHeight: moderateScale(44),
      borderRadius: 999,
      paddingHorizontal: vw(4),
      justifyContent: 'center',
      marginRight: moderateScale(8),
      marginBottom: moderateScale(8),
    },
    skillChipText: {
      color: '#ffffff',
      fontSize: responsiveFont(17, 13, 18),
      lineHeight: responsiveFont(21, 17, 22),
      fontWeight: '500',
    },
    experienceRow: {
      marginTop: vh(1.2),
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    experienceRowSpaced: {
      marginTop: vh(1.6),
    },
    experienceRowWithDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#a5a5a5',
      paddingBottom: vh(1.4),
    },
    experienceIcon: {
      width: moderateScale(38),
      height: moderateScale(38),
      resizeMode: 'contain',
      tintColor: '#2eb8c6',
      marginTop: moderateScale(2),
    },
    experienceCopy: {
      marginLeft: moderateScale(10),
      flex: 1,
    },
    experienceCompany: {
      color: '#151515',
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(23, 19, 25),
      fontWeight: '500',
    },
    experienceRole: {
      color: '#151515',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '400',
      marginTop: vh(0.2),
    },
    experienceDate: {
      marginTop: vh(0.2),
      color: '#a0a0a0',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '400',
    },
    placeholderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(8),
    },
    errorText: {
      color: '#555555',
      textAlign: 'center',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    emptyTitle: {
      color: '#212121',
      textAlign: 'center',
      fontSize: responsiveFont(24, 20, 27),
      lineHeight: responsiveFont(30, 24, 33),
      fontWeight: '600',
    },
    emptySubtitle: {
      marginTop: vh(0.8),
      color: '#666666',
      textAlign: 'center',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    retryButton: {
      marginTop: vh(2),
      backgroundColor: '#31c6d5',
      borderRadius: 999,
      minHeight: moderateScale(44),
      paddingHorizontal: vw(7),
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 18, 22),
      fontWeight: '500',
    },
    actionRow: {
      marginTop: -vh(5),
      marginBottom: -vh(2.2),
      flexDirection: 'row',
      justifyContent: 'center',
      gap: moderateScale(22),
      zIndex: 10,
      elevation: 10,
    },
    actionButton: {
      width: moderateScale(66),
      height: moderateScale(66),
      borderRadius: 999,
      backgroundColor: '#f8f8f8',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    actionIcon: {
      width: moderateScale(36),
      height: moderateScale(36),
      resizeMode: 'contain',
    },
    bottomTabBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: bottomInset + vh(0.6),
      width: '100%',
      minHeight: moderateScale(66),
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e0e0e0',
      paddingTop: vh(0.8),
      paddingBottom: Math.min(bottomInset, moderateScale(6)) + vh(0.35),
      paddingHorizontal: vw(2),
      backgroundColor: '#ffffff',
      zIndex: 4,
      elevation: 4,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabIcon: {
      width: moderateScale(32),
      height: moderateScale(32),
      resizeMode: 'contain',
    },
    tabIconWrap: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBadgeWrap: {
      position: 'absolute',
      top: -moderateScale(4),
      right: -moderateScale(10),
      minWidth: moderateScale(18),
      height: moderateScale(18),
      borderRadius: 999,
      backgroundColor: '#2cbbc1',
      paddingHorizontal: moderateScale(4),
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(10, 9, 11),
      lineHeight: responsiveFont(12, 11, 13),
      fontWeight: '600',
    },
    tabLabel: {
      marginTop: vh(0.2),
      color: '#9e9e9e',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '400',
    },
    tabLabelActive: {
      marginTop: vh(0.2),
      color: '#2eb8c6',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '500',
    },
    pagingIndicatorWrap: {
      position: 'absolute',
      bottom: vh(11),
      alignSelf: 'center',
      backgroundColor: '#ffffffcc',
      borderRadius: 999,
      paddingHorizontal: vw(3),
      paddingVertical: vh(0.5),
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalBlur: {
      ...StyleSheet.absoluteFillObject,
    },
    modalTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.34)',
    },
    modalBackdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },
    modalCardContainer: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
    },
    modalCard: {
      width: vw(88),
      maxWidth: 380,
      backgroundColor: '#ffffff',
      borderRadius: moderateScale(24),
      paddingHorizontal: vw(6),
      paddingTop: vh(3),
      paddingBottom: vh(2.8),
      alignItems: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    modalPhoto: {
      width: moderateScale(96),
      height: moderateScale(96),
      borderRadius: moderateScale(48),
      resizeMode: 'cover',
      backgroundColor: '#d7d7d7',
      marginBottom: vh(1.4),
    },
    modalName: {
      color: '#161616',
      fontSize: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      fontWeight: '600',
      marginBottom: vh(1.8),
      textAlign: 'center',
    },
    modalInput: {
      width: '100%',
      minHeight: moderateScale(110),
      maxHeight: moderateScale(160),
      borderBottomWidth: 1,
      borderBottomColor: '#c8c8c8',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      color: '#2a2a2a',
      fontStyle: 'italic',
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: vh(0.8),
      textAlignVertical: 'top',
    },
    modalCharCounter: {
      alignSelf: 'flex-end',
      marginTop: vh(0.5),
      color: '#a0a0a0',
      fontSize: responsiveFont(13, 11, 15),
      lineHeight: responsiveFont(17, 14, 20),
      fontWeight: '400',
      marginBottom: vh(1.4),
    },
    modalErrorText: {
      color: '#c44f4f',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(19, 16, 22),
      fontWeight: '400',
      textAlign: 'center',
      marginBottom: vh(1),
    },
    modalSendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(10),
      backgroundColor: '#31c6d5',
      borderRadius: 999,
      minHeight: moderateScale(52),
      paddingHorizontal: vw(8),
      width: '80%',
      marginBottom: vh(1.8),
    },
    modalSendButtonDisabled: {
      opacity: 0.65,
    },
    modalSendIcon: {
      width: moderateScale(22),
      height: moderateScale(22),
      resizeMode: 'contain',
    },
    modalSendButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
    },
    modalCancelText: {
      color: '#3d3d3d',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 17, 22),
      fontWeight: '400',
      textDecorationLine: 'underline',
    },
    discoverListContent: {
      paddingTop: vh(1.4),
      paddingBottom: vh(3),
      paddingHorizontal: vw(4.2),
      gap: moderateScale(14),
    },
    discoverDetailWrap: {
      flex: 1,
    },
    discoverBackButton: {
      alignSelf: 'flex-start',
      marginTop: vh(1.2),
      marginLeft: vw(4.2),
      marginBottom: vh(0.4),
      backgroundColor: '#ffffff',
      borderRadius: 999,
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(6),
    },
    discoverBackButtonText: {
      color: '#3d556e',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '500',
    },
    discoverItem: {
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: moderateScale(18),
      padding: moderateScale(14),
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    discoverPhotoWrap: {
      width: moderateScale(76),
      height: moderateScale(82),
      borderRadius: moderateScale(12),
      overflow: 'hidden',
      backgroundColor: '#d7d7d7',
      flexShrink: 0,
    },
    discoverPhoto: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    discoverContent: {
      flex: 1,
      marginLeft: moderateScale(12),
      justifyContent: 'flex-start',
    },
    discoverHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: moderateScale(6),
    },
    discoverName: {
      flex: 1,
      color: '#161616',
      fontSize: responsiveFont(17, 14, 19),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '600',
    },
    discoverLocationWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
      gap: moderateScale(4),
    },
    discoverFlag: {
      width: moderateScale(20),
      height: moderateScale(14),
      resizeMode: 'contain',
    },
    discoverLocation: {
      color: '#777777',
      fontSize: responsiveFont(13, 11, 15),
      lineHeight: responsiveFont(17, 14, 19),
      fontWeight: '400',
      maxWidth: vw(24),
    },
    discoverBio: {
      marginTop: vh(0.5),
      color: '#666666',
      fontSize: responsiveFont(13, 11, 15),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '400',
      fontStyle: 'italic',
    },
    discoverBadgePill: {
      marginTop: vh(0.8),
      alignSelf: 'flex-start',
      backgroundColor: '#2eb8c6',
      borderRadius: 999,
      paddingHorizontal: moderateScale(14),
      paddingVertical: moderateScale(6),
    },
    discoverBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(13, 11, 15),
      lineHeight: responsiveFont(17, 14, 19),
      fontWeight: '500',
    },
    discoverPagingRow: {
      paddingVertical: vh(2),
      alignItems: 'center',
    },

    // -------------------------------------------------------------------------
    // Paywall modal styles
    // -------------------------------------------------------------------------
    paywallContainer: {
      flex: 1,
      paddingTop: topInset + vh(1.2),
      backgroundColor: '#f5fbfa',
    },
    paywallTopBar: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(4.5),
      paddingBottom: vh(1.6),
      backgroundColor: '#ffffff',
    },
    paywallLogoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: moderateScale(12),
    },
    paywallWordmark: {
      width: vw(40),
      height: moderateScale(32),
      resizeMode: 'contain',
    },
    paywallCloseText: {
      fontSize: responsiveFont(30, 26, 32),
      color: '#7a8298',
      fontWeight: '400',
    },
    paywallHelpText: {
      color: '#2cbbc1',
      fontSize: responsiveFont(18, 15, 19),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    paywallScroll: {
      flex: 1,
      width: '100%',
    },
    paywallScrollContent: {
      paddingBottom: vh(4),
    },
    paywallHeroSection: {
      alignItems: 'center',
      paddingHorizontal: vw(5),
      paddingTop: vh(3),
    },
    paywallMembershipPill: {
      minHeight: moderateScale(44),
      borderRadius: 999,
      backgroundColor: '#2cbbc1',
      paddingHorizontal: moderateScale(30),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: vh(2.2),
    },
    paywallMembershipPillText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 13, 17),
      lineHeight: responsiveFont(20, 16, 22),
      fontWeight: '500',
    },
    paywallTitle: {
      color: '#000000',
      fontSize: responsiveFont(isShortScreen ? 30 : 34, 28, 40),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 34, 48),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: vh(1.8),
    },
    paywallTitleAccent: {
      color: '#2cbbc1',
    },
    paywallSubtitle: {
      color: '#3e4a50',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(26, 21, 27),
      fontWeight: '400',
      textAlign: 'center',
      paddingHorizontal: vw(5),
    },
    paywallHeroImageWrap: {
      width: '100%',
      marginTop: vh(2.6),
      position: 'relative',
      alignItems: 'center',
    },
    paywallHeroImage: {
      width: '92%',
      height: moderateScale(250),
      borderRadius: moderateScale(32),
      resizeMode: 'cover',
    },
    paywallEliteCard: {
      position: 'absolute',
      left: moderateScale(0),
      top: moderateScale(-8),
      width: moderateScale(170),
      backgroundColor: '#ffffff',
      borderRadius: moderateScale(20),
      paddingHorizontal: moderateScale(12),
      paddingVertical: moderateScale(12),
      transform: [{ rotate: '-9deg' }],
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },
    paywallEliteIcon: {
      width: moderateScale(22),
      height: moderateScale(22),
      resizeMode: 'contain',
      marginBottom: moderateScale(6),
    },
    paywallEliteContent: {
      gap: moderateScale(2),
    },
    paywallEliteTitle: {
      color: '#374248',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '600',
    },
    paywallEliteBody: {
      color: '#49565c',
      fontSize: responsiveFont(12, 10, 13),
      lineHeight: responsiveFont(17, 14, 18),
      fontWeight: '400',
    },
    paywallFeatureCard: {
      marginTop: vh(2.2),
      marginHorizontal: vw(5),
      backgroundColor: '#f7f6fb',
      borderRadius: moderateScale(22),
      paddingHorizontal: moderateScale(22),
      paddingVertical: moderateScale(24),
    },
    paywallFeatureIcon: {
      width: moderateScale(52),
      height: moderateScale(52),
      resizeMode: 'contain',
      marginBottom: moderateScale(16),
      tintColor: '#2cbbc1',
    },
    paywallFeatureTitle: {
      color: '#050505',
      fontSize: responsiveFont(22, 18, 24),
      lineHeight: responsiveFont(28, 23, 30),
      fontWeight: '700',
    },
    paywallFeatureBody: {
      marginTop: moderateScale(12),
      color: '#445157',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(27, 21, 28),
      fontWeight: '400',
    },
    paywallBottomSheet: {
      marginTop: vh(2.4),
      backgroundColor: '#ffffff',
      borderTopLeftRadius: moderateScale(28),
      borderTopRightRadius: moderateScale(28),
      borderBottomLeftRadius: moderateScale(24),
      borderBottomRightRadius: moderateScale(24),
      paddingTop: vh(4),
      paddingBottom: vh(3.2),
      paddingHorizontal: vw(8),
      alignItems: 'center',
      overflow: 'hidden',
    },
    paywallBottomDecor: {
      position: 'absolute',
      right: -moderateScale(22),
      top: -moderateScale(8),
      width: moderateScale(96),
      height: moderateScale(96),
      borderRadius: 999,
      backgroundColor: '#e6f4f4',
    },
    paywallBottomTitle: {
      color: '#060606',
      fontSize: responsiveFont(22, 18, 24),
      lineHeight: responsiveFont(28, 23, 30),
      fontWeight: '700',
    },
    paywallPriceRow: {
      marginTop: vh(2),
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    paywallCurrencyText: {
      color: '#000000',
      fontSize: responsiveFont(22, 18, 24),
      lineHeight: responsiveFont(28, 22, 30),
      fontWeight: '600',
      marginRight: moderateScale(8),
      marginBottom: moderateScale(10),
    },
    paywallPriceValue: {
      color: '#000000',
      fontSize: responsiveFont(54, 42, 60),
      lineHeight: responsiveFont(60, 48, 66),
      fontWeight: '700',
    },
    paywallPriceUnit: {
      color: '#202020',
      fontSize: responsiveFont(24, 18, 26),
      lineHeight: responsiveFont(30, 22, 32),
      fontWeight: '400',
      marginLeft: moderateScale(8),
      marginBottom: moderateScale(10),
    },
    paywallBillingText: {
      marginTop: vh(2),
      color: '#465157',
      textAlign: 'center',
      fontSize: responsiveFont(16, 13, 17),
      lineHeight: responsiveFont(23, 18, 24),
      fontWeight: '400',
      paddingHorizontal: vw(6),
    },
    paywallUpgradeButton: {
      backgroundColor: '#2cbbc1',
      borderRadius: 999,
      minHeight: moderateScale(62),
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 0,
      marginBottom: 0,
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    paywallUpgradeWrap: {
      width: '100%',
      alignItems: 'center',
      marginTop: vh(2.6),
      marginBottom: vh(2),
    },
    paywallUpgradeText: {
      color: '#ffffff',
      fontSize: responsiveFont(19, 15, 20),
      lineHeight: responsiveFont(24, 18, 25),
      fontWeight: '500',
    },
    paywallMaybeLaterText: {
      color: '#40454b',
      fontSize: responsiveFont(17, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '400',
    },
    paywallSecurityRow: {
      marginTop: vh(2.6),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: moderateScale(24),
    },
    paywallSecurityIcon: {
      width: moderateScale(34),
      height: moderateScale(34),
      resizeMode: 'contain',
      tintColor: '#a3a3a3',
    },

    // -------------------------------------------------------------------------
    // Interstitial ad placeholder styles
    // -------------------------------------------------------------------------
    interstitialBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.80)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    interstitialCard: {
      width: vw(88),
      maxWidth: 380,
      backgroundColor: '#ffffff',
      borderRadius: moderateScale(20),
      paddingHorizontal: vw(6),
      paddingTop: vh(2.5),
      paddingBottom: vh(2.5),
      alignItems: 'center',
    },
    interstitialLabel: {
      color: '#888888',
      fontSize: responsiveFont(12, 10, 14),
      lineHeight: responsiveFont(16, 13, 18),
      fontWeight: '400',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: vh(1.2),
    },
    interstitialAdPlaceholder: {
      width: '100%',
      height: moderateScale(200),
      backgroundColor: '#e8e8e8',
      borderRadius: moderateScale(12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: vh(2),
    },
    interstitialAdPlaceholderText: {
      color: '#aaaaaa',
      fontSize: responsiveFont(14, 12, 16),
      fontWeight: '400',
    },
    interstitialContinueButton: {
      backgroundColor: '#2eb8c6',
      borderRadius: 999,
      minHeight: moderateScale(48),
      paddingHorizontal: vw(10),
      alignItems: 'center',
      justifyContent: 'center',
    },
    interstitialContinueText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 17, 22),
      fontWeight: '500',
    },
  }));
}
