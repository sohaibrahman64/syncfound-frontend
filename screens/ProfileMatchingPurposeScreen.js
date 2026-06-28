import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BASE_URL } from '../utils/Constants';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const MATCHING_PURPOSE_ENDPOINT = '/api/v1/matching-purpose';

const PURPOSE_ICON_MAP = {
  '../assets/group.png': require('../assets/group.png'),
  '../assets/group_green.png': require('../assets/group_green.png'),
  '../assets/user.png': require('../assets/user.png'),
  '../assets/user_green.png': require('../assets/user_green.png'),
  '../assets/investors.png': require('../assets/investors.png'),
  '../assets/investors_green.png': require('../assets/investors_green.png'),
  '../assets/teamwork.png': require('../assets/teamwork.png'),
  '../assets/teamwork_green.png': require('../assets/teamwork_green.png'),
};

function buildMatchingPurposeEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return `http://127.0.0.1:8000${MATCHING_PURPOSE_ENDPOINT}`;
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/matching-purpose`;
  }

  return `${normalized}${MATCHING_PURPOSE_ENDPOINT}`;
}

function resolvePurposeIcon(iconPath) {
  return PURPOSE_ICON_MAP[String(iconPath || '').trim()] || null;
}

function toPurposeModel(item) {
  const label = item?.matching_purpose || item?.label || '';
  return {
    value: item?.id ?? label,
    label,
    description: item?.description || '',
    icon: resolvePurposeIcon(item?.icon),
    selectedIcon: resolvePurposeIcon(item?.selected_icon),
  };
}

function PurposeCard({ option, selected, onPress, styles }) {
  const iconSource = selected ? (option.selectedIcon || option.icon) : option.icon;

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
    >
      <Image
        key={`${option.value}-${selected ? 'selected' : 'default'}`}
        source={iconSource}
        style={styles.cardIcon}
        resizeMode="contain"
      />
      <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{option.label}</Text>
      <Text style={[styles.cardDescription, selected && styles.cardDescriptionSelected]}>{option.description}</Text>
    </Pressable>
  );
}

export default function ProfileMatchingPurposeScreen({
  onBack,
  onContinue,
  initialMatchingPurpose = '',
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);
  const [matchingPurpose, setMatchingPurpose] = useState(initialMatchingPurpose);
  const [purposeOptions, setPurposeOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const canContinue = Boolean(matchingPurpose);

  React.useEffect(() => {
    let isMounted = true;

    const fetchMatchingPurposes = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const endpoint = buildMatchingPurposeEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load matching purposes: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map(toPurposeModel)
          .filter((item) => Boolean(item?.label) && Boolean(item?.icon));

        if (isMounted) {
          const selectedOption = mapped.find((item) => (
            item.value === initialMatchingPurpose || item.label === initialMatchingPurpose
          ));
          setPurposeOptions(mapped);
          if (selectedOption) {
            setMatchingPurpose(selectedOption.value);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load matching purposes. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMatchingPurposes();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subheading}>Let's build your founder profile</Text>
          <Text style={styles.heading}>Matching Purpose</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2cbbc1" />
            </View>
          ) : errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : (
            purposeOptions.map((option) => (
              <PurposeCard
                key={option.value}
                option={option}
                selected={matchingPurpose === option.value}
                onPress={() => setMatchingPurpose(option.value)}
                styles={styles}
              />
            ))
          )}
        </ScrollView>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => onContinue?.({ matchingPurpose })}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue
          </Text>
        </Pressable>
      </View>
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
      backgroundColor: '#f3f3f3',
    },
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: vw(35),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: topInset + (isShortScreen ? vh(1.4) : vh(2)),
      paddingBottom: vh(3.2),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(2.5) : vh(3.2),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: vh(2),
    },
    loadingWrap: {
      minHeight: vh(28),
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorMessage: {
      color: '#6b6b6b',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      textAlign: 'center',
      marginTop: vh(3),
    },
    subheading: {
      color: '#616161',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginTop: vh(2.8),
      marginBottom: vh(2.8),
    },
    card: {
      borderWidth: 2,
      borderColor: '#d6d2cd',
      borderRadius: moderateScale(22),
      backgroundColor: '#fbfbfb',
      paddingHorizontal: vw(6),
      paddingVertical: vh(2.2),
      alignItems: 'center',
      marginBottom: vh(2.6),
    },
    cardSelected: {
      borderColor: '#2cbbc1',
      backgroundColor: '#f3fbfc',
    },
    cardIcon: {
      width: moderateScale(isShortScreen ? 34 : 38),
      height: moderateScale(isShortScreen ? 34 : 38),
      marginBottom: vh(1.1),
    },
    cardTitle: {
      color: '#151515',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 18, 24),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: vh(0.7),
    },
    cardTitleSelected: {
      color: '#2cbbc1',
    },
    cardDescription: {
      color: '#2b2b2b',
      fontSize: responsiveFont(isShortScreen ? 14 : 15, 13, 16),
      lineHeight: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      fontWeight: '400',
      textAlign: 'center',
    },
    cardDescriptionSelected: {
      color: '#2cbbc1',
    },
    continueButton: {
      width: isNarrowScreen ? '86%' : '84%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginTop: vh(1.4),
      marginBottom: bottomInset + vh(0.6),
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