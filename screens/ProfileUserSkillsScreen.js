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
import { BASE_URL } from '../utils/Constants';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const USER_SKILLS_ENDPOINT = '/api/v1/user-skills';

function buildUserSkillsEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return `http://127.0.0.1:8000${USER_SKILLS_ENDPOINT}`;
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/user-skills`;
  }

  return `${normalized}${USER_SKILLS_ENDPOINT}`;
}

function toSkillModel(item) {
  const skillName = String(item?.skill_name || item?.skillName || item?.label || '').trim();
  return {
    value: item?.id ?? skillName,
    label: skillName,
  };
}

function normalizeInitialSkills(initialUserSkills) {
  if (Array.isArray(initialUserSkills)) {
    return initialUserSkills
      .map((value) => {
        if (typeof value === 'number') {
          return value;
        }
        return String(value || '').trim();
      })
      .filter(Boolean);
  }

  const single = typeof initialUserSkills === 'number'
    ? initialUserSkills
    : String(initialUserSkills || '').trim();
  return single ? [single] : [];
}

function SkillPill({ label, selected, onPress, styles }) {
  return (
    <Pressable style={[styles.skillPill, selected && styles.skillPillSelected]} onPress={onPress}>
      <Text style={[styles.skillPillText, selected && styles.skillPillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileUserSkillsScreen({ onBack, onContinue, initialUserSkills = [] }) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const [selectedSkills, setSelectedSkills] = useState(() => normalizeInitialSkills(initialUserSkills));
  const [skillOptions, setSkillOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionMessage, setSelectionMessage] = useState('');

  const canContinue = selectedSkills.length > 0;

  function toggleSkill(value) {
    setSelectedSkills((prev) => {
      if (prev.includes(value)) {
        setSelectionMessage('');
        return prev.filter((skill) => skill !== value);
      }

      if (prev.length >= 5) {
        setSelectionMessage('Sorry. You can select upto 5 skills');
        return prev;
      }

      setSelectionMessage('');
      return [...prev, value];
    });
  }

  React.useEffect(() => {
    let isMounted = true;

    const fetchUserSkills = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const endpoint = buildUserSkillsEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load user skills: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map(toSkillModel)
          .filter((item) => Boolean(item?.label));

        if (isMounted) {
          setSkillOptions(mapped);
          setSelectedSkills((prev) => prev.map((selectedSkill) => {
            const matchedSkill = mapped.find((item) => (
              item.value === selectedSkill || item.label === selectedSkill
            ));
            return matchedSkill ? matchedSkill.value : selectedSkill;
          }));
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load user skills. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchUserSkills();

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
          <Text style={styles.heading}>Select Your Skills</Text>

          {selectionMessage ? <Text style={styles.selectionMessage}>{selectionMessage}</Text> : null}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2cbbc1" />
            </View>
          ) : errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : (
            <View style={styles.skillsWrap}>
              {skillOptions.map((option) => (
                <View key={option.value} style={styles.skillPillWrap}>
                  <SkillPill
                    label={option.label}
                    selected={selectedSkills.includes(option.value)}
                    onPress={() => toggleSkill(option.value)}
                    styles={styles}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => onContinue?.({ userSkills: selectedSkills })}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue
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
      width: vw(65),
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
    selectionMessage: {
      color: '#c44f4f',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(21, 18, 24),
      textAlign: 'center',
      marginTop: vh(1.6),
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
      marginTop: vh(2.2),
      marginBottom: vh(2.2),
    },
    skillsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingTop: vh(0.2),
    },
    skillPillWrap: {
      width: '48%',
      marginBottom: vh(1.6),
    },
    skillPill: {
      borderWidth: 2,
      borderColor: '#d6d2cd',
      borderRadius: 999,
      minHeight: moderateScale(46),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(3),
      backgroundColor: '#f3f3f3',
    },
    skillPillSelected: {
      borderColor: '#2cbbc1',
      backgroundColor: '#eaf8f9',
    },
    skillPillText: {
      color: '#3e3e3e',
      fontSize: responsiveFont(isShortScreen ? 16 : 17, 14, 18),
      lineHeight: responsiveFont(isShortScreen ? 22 : 23, 18, 24),
      fontWeight: '400',
      textAlign: 'center',
    },
    skillPillTextSelected: {
      color: '#2cbbc1',
    },
    continueButton: {
      width: isNarrowScreen ? '72%' : '68%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginTop: vh(1.2),
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