import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getMyMatches } from '../utils/backendAuth';
import { FLAG_ASSET_MAP } from '../utils/flagAssetMap';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const PAGE_LIMIT = 20;
const MODE_MATCHMAKING = 'matchmaking';
const MODE_DISCOVER = 'discover';

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
  const primaryExperience = card.linkedinExperiences?.[0] || null;

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

      {(primaryExperience || card.linkedinCurrentCompany || card.linkedinHeadline || card.experienceSummary) && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Experience</Text>
          <View style={styles.experienceRow}>
            <Image source={require('../assets/internship_green.png')} style={styles.experienceIcon} />
            <View style={styles.experienceCopy}>
              {!!(primaryExperience?.company_name || card.linkedinCurrentCompany) && (
                <Text style={styles.experienceCompany}>
                  {primaryExperience?.company_name || card.linkedinCurrentCompany}
                </Text>
              )}
              {!!(primaryExperience?.title || card.linkedinHeadline) && (
                <Text style={styles.experienceRole}>
                  {primaryExperience?.title || card.linkedinHeadline}
                </Text>
              )}
              {!!(primaryExperience?.date_range || card.experienceSummary) && (
                <Text style={styles.experienceDate}>
                  {primaryExperience?.date_range || card.experienceSummary}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

export default function HomeScreen({ firebaseToken = '' }) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const swipePosition = useRef(new Animated.ValueXY()).current;

  const [mode, setMode] = useState(MODE_MATCHMAKING);
  const [cards, setCards] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaging, setIsPaging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentCard = cards[activeIndex] || null;
  const nextCard = cards[activeIndex + 1] || null;
  const remainingCards = Math.max(cards.length - activeIndex, 0);

  const swipeThreshold = Math.min(metrics.vw(22), 120);

  const loadMatches = useCallback(
    async ({ requestedMode = mode, cursor = null, refresh = false, append = false } = {}) => {
      if (!firebaseToken) {
        setCards([]);
        setNextCursor(null);
        setErrorMessage('You are signed out. Please login again.');
        setIsInitialLoading(false);
        return;
      }

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
        setErrorMessage(error?.message || 'Could not load matches. Please try again.');
      } finally {
        setIsInitialLoading(false);
        setIsPaging(false);
      }
    },
    [firebaseToken, mode],
  );

  useEffect(() => {
    loadMatches({ requestedMode: mode, refresh: true, append: false });
  }, [loadMatches, mode]);

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
            animateCardOut('right');
            return;
          }

          if (gestureState.dx < -swipeThreshold) {
            animateCardOut('left');
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
    [animateCardOut, swipePosition, swipeThreshold],
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
        ) : (
          <Animated.View style={[styles.swipeCard, cardTransformStyle]} {...panResponder.panHandlers}>
            <MatchCard card={currentCard} styles={styles} />
          </Animated.View>
        )}
      </View>

      {!isInitialLoading && !!currentCard ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={() => animateCardOut('left')}>
            <Image source={require('../assets/pass.png')} style={styles.actionIcon} />
          </Pressable>

          <Pressable style={styles.actionButton} onPress={goToNextCard}>
            <Image source={require('../assets/save.png')} style={styles.actionIcon} />
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => animateCardOut('right')}>
            <Image source={require('../assets/heart.png')} style={styles.actionIcon} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomTabBar}>
        <View style={styles.tabItem}>
          <Image source={require('../assets/invites-inactive.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Invites</Text>
        </View>

        <View style={styles.tabItem}>
          <Image source={require('../assets/sync-active.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabelActive}>Sync</Text>
        </View>

        <View style={styles.tabItem}>
          <Image source={require('../assets/chat-inactive.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Chat</Text>
        </View>

        <View style={styles.tabItem}>
          <Image source={require('../assets/profile-inactive.png')} style={styles.tabIcon} />
          <Text style={styles.tabLabel}>Profile</Text>
        </View>
      </View>

      {isPaging ? (
        <View style={styles.pagingIndicatorWrap}>
          <ActivityIndicator size="small" color="#31c6d5" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#dfddd5',
      paddingTop: isShortScreen ? vh(1.4) : vh(2.2),
      paddingBottom: moderateScale(96),
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
      fontSize: responsiveFont(isShortScreen ? 34 : 37, 28, 40),
      lineHeight: responsiveFont(isShortScreen ? 40 : 43, 33, 46),
      fontWeight: '500',
    },
    intentWrap: {
      marginTop: vh(1.4),
      borderRadius: moderateScale(20),
      backgroundColor: '#2eb8c6',
      minHeight: moderateScale(52),
      justifyContent: 'center',
      paddingLeft: vw(7),
      position: 'relative',
      overflow: 'hidden',
    },
    intentAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: moderateScale(8),
      backgroundColor: '#f4f4f4',
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
      fontSize: responsiveFont(17, 13, 18),
      lineHeight: responsiveFont(21, 16, 22),
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
      fontSize: responsiveFont(isShortScreen ? 28 : 32, 24, 38),
      lineHeight: responsiveFont(isShortScreen ? 34 : 40, 29, 46),
      fontWeight: '400',
    },
    sectionBody: {
      marginTop: vh(0.6),
      color: '#a0a0a0',
      fontSize: responsiveFont(18, 14, 19),
      lineHeight: responsiveFont(22, 18, 24),
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
      fontSize: responsiveFont(20, 15, 22),
      lineHeight: responsiveFont(24, 19, 26),
      fontWeight: '500',
    },
    experienceRole: {
      color: '#151515',
      fontSize: responsiveFont(18, 14, 20),
      lineHeight: responsiveFont(22, 18, 24),
      fontWeight: '500',
      marginTop: vh(0.2),
    },
    experienceDate: {
      marginTop: vh(0.2),
      color: '#a0a0a0',
      fontSize: responsiveFont(17, 13, 18),
      lineHeight: responsiveFont(21, 16, 22),
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
      bottom: 0,
      width: '100%',
      minHeight: moderateScale(78),
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e0e0e0',
      paddingTop: vh(0.8),
      paddingBottom: vh(1.4),
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
  }));
}
