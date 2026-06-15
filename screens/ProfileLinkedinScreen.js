import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useResponsiveMetrics } from '../utils/responsive';
import { ingestLinkedinProfile } from '../utils/backendAuth';
import { withPlatformFontStyles } from '../utils/typography';

const LINKEDIN_PREFIX = 'linkedin.com/in/';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const LINKEDIN_PROFILE_PATH = '/linkedin-profile';

function buildLinkedinProfilePreview(payload) {
  const basicInfo = payload?.basic_info ?? {};
  const firstExperience = payload?.experience?.[0] ?? {};
  const firstEducation = payload?.education?.[0] ?? {};

  const connectionsCount =
    typeof basicInfo.connection_count === 'number'
      ? basicInfo.connection_count
      : Number(basicInfo.connection_count);

  const preview = {
    headline: basicInfo.headline ?? '',
    firstOrganization: firstExperience.company ?? '',
    firstEducationInstitution: firstEducation.school ?? '',
    firstLocation: basicInfo.location?.full || basicInfo.location?.city || '',
    connections:
      Number.isFinite(connectionsCount) && connectionsCount >= 0
        ? `${connectionsCount} connections on LinkedIn`
        : '',
  };

  const isComplete =
    Boolean(preview.headline) &&
    Boolean(preview.firstOrganization) &&
    Boolean(preview.firstEducationInstitution) &&
    Boolean(preview.firstLocation) &&
    Boolean(preview.connections);

  return isComplete ? preview : null;
}

function normalizeLinkedinUsername(value) {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue) {
    return '';
  }

  const normalizedValue = trimmedValue
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '');

  if (normalizedValue.toLowerCase().startsWith(LINKEDIN_PREFIX)) {
    return normalizedValue.slice(LINKEDIN_PREFIX.length).replace(/\/?$/, '');
  }

  const inProfileIndex = normalizedValue.toLowerCase().indexOf('linkedin.com/in/');

  if (inProfileIndex >= 0) {
    return normalizedValue.slice(inProfileIndex + LINKEDIN_PREFIX.length).replace(/\/?$/, '');
  }

  return normalizedValue.replace(/^\/+/, '').replace(/\/?$/, '');
}

export default function ProfileLinkedinScreen({
  onBack,
  onContinue,
  backendUserId = null,
  firebaseToken = '',
  initialLinkedinUsername = '',
  initialLinkedinUrl = '',
  initialLinkedinProfilePreview = null,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const [linkedinUsername, setLinkedinUsername] = useState(() => {
    const usernameFromDraft = normalizeLinkedinUsername(initialLinkedinUsername);

    if (usernameFromDraft) {
      return usernameFromDraft;
    }

    return normalizeLinkedinUsername(initialLinkedinUrl);
  });
  const [isLinkedinFocused, setIsLinkedinFocused] = useState(false);
  const [linkedinPreview, setLinkedinPreview] = useState(initialLinkedinProfilePreview);
  const [linkedinProfilePayload, setLinkedinProfilePayload] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isIngestLoading, setIsIngestLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const linkedinInputRef = useRef(null);

  const trimmedUsername = linkedinUsername.trim();
  const linkedinUrl = trimmedUsername ? `${LINKEDIN_PREFIX}${trimmedUsername}` : '';
  const hasTypedUsername = Boolean(trimmedUsername);

  const isLinkedinPreviewFilled = Boolean(linkedinPreview && linkedinProfilePayload);
  const canContinue = isLinkedinPreviewFilled && !isIngestLoading;

  function handleLinkedinUsernameChange(text) {
    setLinkedinUsername(normalizeLinkedinUsername(text));
    setLinkedinPreview(null);
    setLinkedinProfilePayload(null);
    setPreviewError('');
  }

  async function handleArrowPress() {
    if (!hasTypedUsername || isPreviewLoading) {
      return;
    }

    const requestBase = API_BASE_URL.replace(/\/$/, '');
    const requestUrl = `${requestBase}${LINKEDIN_PROFILE_PATH}?username=${encodeURIComponent(trimmedUsername)}`;

    setIsPreviewLoading(true);
    setPreviewError('');

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || 'Failed to fetch LinkedIn profile');
      }

      const preview = buildLinkedinProfilePreview(payload);

      if (!preview) {
        setLinkedinPreview(null);
        setLinkedinProfilePayload(null);
        setPreviewError('Could not build profile preview. Please try another LinkedIn username.');
        return;
      }

      setLinkedinPreview(preview);
      setLinkedinProfilePayload(payload);
    } catch (error) {
      setLinkedinPreview(null);
      setLinkedinProfilePayload(null);
      setPreviewError(error?.message || 'Failed to fetch LinkedIn profile preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleContinuePress() {
    if (!isLinkedinPreviewFilled || isIngestLoading) {
      return;
    }

    const numericUserId = Number(backendUserId);
    if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
      setPreviewError('Could not determine your account id. Please login again and retry.');
      return;
    }

    setIsIngestLoading(true);
    setPreviewError('');

    try {
      const ingestResponse = await ingestLinkedinProfile(linkedinProfilePayload, numericUserId, firebaseToken);
      const linkedinProfileId = Number(ingestResponse?.profile_id);

      const pictureUrl =
        String(linkedinProfilePayload?.basic_info?.profile_picture_url ?? '').trim();

      onContinue?.({
        linkedinUrl,
        linkedinUsername: trimmedUsername,
        linkedinProfilePreview: linkedinPreview,
        linkedinProfilePictureUrl: pictureUrl,
        linkedin_profile_id: Number.isFinite(linkedinProfileId) && linkedinProfileId > 0
          ? linkedinProfileId
          : undefined,
      });
    } catch (error) {
      setPreviewError(error?.message || 'Failed to save LinkedIn profile. Please try again.');
    } finally {
      setIsIngestLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.heading}>What's your LinkedIn profile?</Text>

        <View style={[styles.inputShell, isLinkedinFocused && styles.inputFocused]}>
          <Text style={styles.prefixText}>{LINKEDIN_PREFIX}</Text>

          <TextInput
            ref={linkedinInputRef}
            style={styles.input}
            value={linkedinUsername}
            onChangeText={handleLinkedinUsernameChange}
            placeholder="username"
            placeholderTextColor="#a2a2a2"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable
            onFocus={() => setIsLinkedinFocused(true)}
            onBlur={() => setIsLinkedinFocused(false)}
          />

          <Pressable
            style={[styles.arrowButton, !hasTypedUsername && styles.arrowButtonDisabled]}
            onPress={handleArrowPress}
            disabled={!hasTypedUsername || isPreviewLoading}
            hitSlop={8}
          >
            <Image
              source={require('../assets/right-arrow.png')}
              style={[
                styles.arrowIcon,
                hasTypedUsername && styles.arrowIconActive,
                isPreviewLoading && styles.arrowIconLoading,
              ]}
            />
          </Pressable>
        </View>

        <View style={[styles.previewCard, linkedinPreview && styles.previewCardFilled]}>
          {isPreviewLoading ? <Text style={styles.previewText}>Loading LinkedIn Profile...</Text> : null}

          {!isPreviewLoading && linkedinPreview ? (
            <View style={styles.previewDetailsWrap}>
              <Text style={styles.previewHeadline}>{linkedinPreview.headline}</Text>
              <Text style={styles.previewMeta}>
                {`${linkedinPreview.firstOrganization} • ${linkedinPreview.firstEducationInstitution} • ${linkedinPreview.firstLocation} • ${linkedinPreview.connections}`}
              </Text>
            </View>
          ) : null}

          {!isPreviewLoading && !linkedinPreview ? (
            <Text style={styles.previewText}>LinkedIn Profile Preview</Text>
          ) : null}
        </View>

        {previewError ? <Text style={styles.previewErrorText}>{previewError}</Text> : null}

        <Text style={styles.helperText}>
          Your LinkedIn profile must be public for preview to appear.
        </Text>

        <Pressable
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
          ]}
          disabled={!canContinue}
          onPress={handleContinuePress}
        >
          <Text
            style={[
              styles.continueButtonText,
              !canContinue && styles.continueButtonTextDisabled,
            ]}
          >
            {isIngestLoading ? 'Saving...' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#f3f3f3',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: vw(85),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: isShortScreen ? vh(3.2) : vh(4.2),
      paddingBottom: vh(3.2),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(2.8) : vh(3.5),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginBottom: vh(3.2),
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: '#c8c8c8',
      marginBottom: vh(4.2),
      paddingHorizontal: vw(0.4),
      paddingVertical: vh(1.05),
    },
    inputFocused: {
      borderBottomColor: '#31b8c1',
    },
    prefixText: {
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 21, 29),
      fontWeight: '400',
    },
    input: {
      flex: 1,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      color: '#242424',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 21, 29),
      fontWeight: '400',
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginLeft: vw(0.8),
    },
    arrowButton: {
      marginLeft: vw(1.4),
      paddingVertical: vh(0.2),
      paddingHorizontal: vw(0.6),
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowButtonDisabled: {
      opacity: 0.45,
    },
    arrowIcon: {
      width: responsiveFont(isNarrowScreen ? 23 : 26, 20, 30),
      height: responsiveFont(isNarrowScreen ? 23 : 26, 20, 30),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    arrowIconActive: {
      tintColor: '#26c6d0',
    },
    arrowIconLoading: {
      opacity: 0.55,
    },
    previewCard: {
      minHeight: moderateScale(isShortScreen ? 160 : 182),
      borderWidth: 3,
      borderColor: '#c7c7c7',
      borderRadius: moderateScale(18),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f3f3',
      paddingHorizontal: vw(4),
      marginBottom: vh(2.2),
    },
    previewCardFilled: {
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      paddingVertical: vh(1.8),
    },
    previewDetailsWrap: {
      width: '100%',
      gap: vh(0.65),
    },
    previewTitle: {
      color: '#0f0f0f',
      fontSize: responsiveFont(18, 15, 21),
      lineHeight: responsiveFont(24, 20, 27),
      fontWeight: '700',
      marginBottom: vh(0.3),
    },
    previewHeadline: {
      color: '#262626',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 16, 23),
      fontWeight: '700',
    },
    previewMeta: {
      color: '#262626',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 16, 23),
      fontWeight: '400',
    },
    previewText: {
      color: '#a0a0a0',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(20, 16, 23),
      fontWeight: '400',
      textAlign: 'center',
    },
    previewErrorText: {
      color: '#dc2626',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 16, 23),
      fontWeight: '400',
      marginBottom: vh(1.4),
    },
    helperText: {
      color: '#9a9a9a',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 19, 25),
      fontWeight: '400',
      marginBottom: vh(2.4),
    },
    continueButton: {
      marginTop: 'auto',
      width: isNarrowScreen ? '84%' : '80%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginBottom: vh(0.6),
    },
    continueButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    continueButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#707c96',
    },
  }));
}
