import React, { useEffect, useMemo, useState } from 'react';
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
import { getIndustries } from '../utils/backendAuth';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const MAX_SELECTION = 1;

function toIndustryModel(item) {
  const id = item?.id;
  const label = String(item?.industry_name || item?.industryName || item?.name || '').trim();

  if (!label) {
    return null;
  }

  return {
    value: id ?? label,
    label,
  };
}

function normalizeInitialIndustries(initialIndustries) {
  if (Array.isArray(initialIndustries)) {
    return initialIndustries
      .map((value) => {
        if (typeof value === 'number') {
          return value;
        }
        return String(value || '').trim();
      })
      .filter(Boolean);
  }

  const single = typeof initialIndustries === 'number'
    ? initialIndustries
    : String(initialIndustries || '').trim();

  return single ? [single] : [];
}

function shouldCenterIndustryPill(label) {
  const normalizedLabel = String(label || '').trim().toLowerCase();
  const centeredLabels = new Set([
    'generative tech/ai',
    'cloud tech & devops',
    'climate tech',
    'construction tech',
  ]);

  return centeredLabels.has(normalizedLabel) || normalizedLabel.length > 16;
}

function IndustryPill({ item, selected, onPress, styles }) {
  const isWide = shouldCenterIndustryPill(item.label);

  return (
    <View style={[styles.pillWrap, isWide && styles.pillWrapWide]}>
      <Pressable
        style={[styles.pill, isWide && styles.pillWide, selected && styles.pillSelected]}
        onPress={onPress}
      >
        <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
          {item.label}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ProfileIndustriesScreen({
  firebaseToken = '',
  onBack,
  onContinue,
  initialIndustries = [],
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(metrics, insets), [metrics, insets.top, insets.bottom]);

  const [industryOptions, setIndustryOptions] = useState([]);
  const [selectedIndustries, setSelectedIndustries] = useState(() => normalizeInitialIndustries(initialIndustries));
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionMessage, setSelectionMessage] = useState('');

  const canContinue = selectedIndustries.length > 0;

  function toggleIndustry(value) {
    setSelectedIndustries((prev) => {
      if (prev.includes(value)) {
        setSelectionMessage('');
        return prev.filter((item) => item !== value);
      }

      if (prev.length >= MAX_SELECTION) {
        setSelectionMessage(`Sorry. You can select upto ${MAX_SELECTION} industries`);
        return prev;
      }

      setSelectionMessage('');
      return [...prev, value];
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function fetchIndustries() {
      try {
        setLoading(true);
        setErrorMessage('');

        const payload = await getIndustries(firebaseToken);
        const mapped = payload
          .map(toIndustryModel)
          .filter(Boolean);

        if (!isMounted) {
          return;
        }

        setIndustryOptions(mapped);
        setSelectedIndustries((prev) => prev.map((selectedValue) => {
          const matched = mapped.find((item) => (
            item.value === selectedValue || item.label === selectedValue
          ));
          return matched ? matched.value : selectedValue;
        }));
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load industries. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchIndustries();

    return () => {
      isMounted = false;
    };
  }, [firebaseToken]);

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
          <Text style={styles.heading}>Select Industry</Text>
          <Text style={styles.helperText}>Upto {MAX_SELECTION} industries</Text>

          {selectionMessage ? <Text style={styles.selectionMessage}>{selectionMessage}</Text> : null}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#31c6d5" />
            </View>
          ) : errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : (
            <View style={styles.pillsWrap}>
              {industryOptions.map((item) => (
                <IndustryPill
                  key={String(item.value)}
                  item={item}
                  selected={selectedIndustries.includes(item.value)}
                  onPress={() => toggleIndustry(item.value)}
                  styles={styles}
                />
              ))}
            </View>
          )}
        </ScrollView>

        <Pressable
          style={[styles.finishButton, !canContinue && styles.finishButtonDisabled]}
          disabled={!canContinue}
          onPress={() => onContinue?.({ industries: selectedIndustries })}
        >
          <Text style={[styles.finishButtonText, !canContinue && styles.finishButtonTextDisabled]}>
            Finish
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
      width: vw(100),
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
      marginBottom: isShortScreen ? vh(1.6) : vh(2),
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
    subheading: {
      color: '#565656',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginTop: vh(0.6),
    },
    helperText: {
      color: '#5a5a5a',
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 20 : 22, 18, 24),
      fontWeight: '400',
      marginTop: vh(0.2),
      marginBottom: vh(2.2),
    },
    loadingWrap: {
      minHeight: vh(30),
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorMessage: {
      color: '#6b6b6b',
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      textAlign: 'center',
      marginTop: vh(3),
    },
    selectionMessage: {
      color: '#c44f4f',
      fontSize: responsiveFont(isShortScreen ? 15 : 17, 13, 19),
      lineHeight: responsiveFont(isShortScreen ? 21 : 23, 18, 26),
      textAlign: 'center',
      marginBottom: vh(1.4),
    },
    pillsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingTop: vh(0.3),
    },
    pillWrap: {
      width: '48%',
      marginBottom: vh(1.8),
    },
    pillWrapWide: {
      width: '100%',
      alignItems: 'center',
    },
    pillWide: {
      width: '84%',
    },
    pill: {
      borderWidth: 2,
      borderColor: '#cbc7c3',
      borderRadius: 999,
      minHeight: moderateScale(46),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f3f3',
      paddingHorizontal: vw(3),
    },
    pillSelected: {
      borderColor: '#31c6d5',
      backgroundColor: '#eaf9fb',
    },
    pillText: {
      color: '#404040',
      fontSize: responsiveFont(isShortScreen ? 16 : 17, 14, 18),
      lineHeight: responsiveFont(isShortScreen ? 22 : 23, 18, 24),
      fontWeight: '400',
      textAlign: 'center',
    },
    pillTextSelected: {
      color: '#138c99',
      fontWeight: '600',
    },
    finishButton: {
      width: isNarrowScreen ? '72%' : '68%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginTop: vh(1.2),
      marginBottom: bottomInset + vh(0.6),
    },
    finishButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    finishButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    finishButtonTextDisabled: {
      color: '#707c96',
    },
  }));
}
