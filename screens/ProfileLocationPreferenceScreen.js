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

const LOCATION_PREFERENCE_ENDPOINT = '/api/v1/location-preference';

function buildLocationPreferenceEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return `http://127.0.0.1:8000${LOCATION_PREFERENCE_ENDPOINT}`;
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/location-preference`;
  }

  return `${normalized}${LOCATION_PREFERENCE_ENDPOINT}`;
}

function toQuestionModel(item) {
  const questionId = item?.question_id ?? item?.id;
  const question = String(item?.question || item?.label || '').trim();

  const answers = Array.isArray(item?.answers)
    ? item.answers
        .map((answer) => ({
          answerId: answer?.answer_id ?? answer?.id,
          answer: String(answer?.answer || answer?.label || '').trim(),
        }))
        .filter((answer) => answer.answerId != null && Boolean(answer.answer))
    : [];

  return {
    questionId,
    question,
    answers,
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toLocationPreferenceList(selectedAnswersByQuestionId) {
  return Object.entries(selectedAnswersByQuestionId)
    .map(([questionId, selectedAnswerId]) => ({
      question_id: Number(questionId),
      selected_answer_id: selectedAnswerId,
    }))
    .filter((entry) => Number.isFinite(entry.question_id) && entry.selected_answer_id != null)
    .sort((a, b) => a.question_id - b.question_id);
}

function normalizeInitialLocationPreference(initialLocationPreference) {
  if (!Array.isArray(initialLocationPreference)) {
    return {};
  }

  return initialLocationPreference.reduce((acc, entry) => {
    const questionId = entry?.question_id;
    const selectedAnswerId = entry?.selected_answer_id;
    if (questionId != null && selectedAnswerId != null) {
      acc[questionId] = selectedAnswerId;
    }
    return acc;
  }, {});
}

function derivePrefillAnswerId(question, initialValues) {
  const label = normalizeText(question.question);

  if (!Array.isArray(question.answers) || !question.answers.length) {
    return null;
  }

  if (label.includes('open to work remotely')) {
    const target = initialValues.initialOpenToRemoteWork === true
      ? 'yes'
      : initialValues.initialOpenToRemoteWork === false
        ? 'no'
        : '';

    const found = question.answers.find((answer) => normalizeText(answer.answer) === target);
    return found?.answerId ?? null;
  }

  if (label.includes('preference in working remotely')) {
    const preferenceMap = {
      hybrid: 'hybrid (onsite or remote)',
      onsitepreferred: 'onsite preferred',
      remotepreferred: 'remote preferred',
    };

    const target = preferenceMap[normalizeText(initialValues.initialRemoteWorkPreference).replace(/\s+/g, '')] || '';
    const found = question.answers.find((answer) => normalizeText(answer.answer) === target);
    return found?.answerId ?? null;
  }

  if (label.includes('willing to relocate')) {
    const target = initialValues.initialWillingToRelocate === true
      ? 'yes'
      : initialValues.initialWillingToRelocate === false
        ? 'no'
        : '';

    const found = question.answers.find((answer) => normalizeText(answer.answer) === target);
    return found?.answerId ?? null;
  }

  return null;
}

function RadioOption({ label, selected, onPress, styles }) {
  return (
    <Pressable style={styles.optionRow} onPress={onPress}>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileLocationPreferenceScreen({
  onBack,
  onContinue,
  initialLocationPreference = [],
  initialOpenToRemoteWork = null,
  initialRemoteWorkPreference = '',
  initialWillingToRelocate = null,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const [questions, setQuestions] = useState([]);
  const [selectedAnswersByQuestionId, setSelectedAnswersByQuestionId] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const canContinue = useMemo(() => {
    if (!questions.length) return false;
    return questions.every((question) => selectedAnswersByQuestionId[question.questionId] != null);
  }, [questions, selectedAnswersByQuestionId]);

  React.useEffect(() => {
    let isMounted = true;

    const fetchLocationPreference = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const endpoint = buildLocationPreferenceEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load location preferences: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mappedQuestions = list
          .map(toQuestionModel)
          .filter((question) => question.questionId != null && Boolean(question.question) && question.answers.length > 0);

        if (isMounted) {
          const initialValues = {
            initialOpenToRemoteWork,
            initialRemoteWorkPreference,
            initialWillingToRelocate,
          };

          const normalizedLocationPreference = normalizeInitialLocationPreference(initialLocationPreference);

          const prefilledSelections = mappedQuestions.reduce((acc, question) => {
            const prefilledAnswerId = normalizedLocationPreference[question.questionId];
            if (prefilledAnswerId != null) {
              acc[question.questionId] = prefilledAnswerId;
              return acc;
            }

            const answerId = derivePrefillAnswerId(question, initialValues);
            if (answerId != null) {
              acc[question.questionId] = answerId;
            }
            return acc;
          }, {});

          setQuestions(mappedQuestions);
          setSelectedAnswersByQuestionId(prefilledSelections);
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load location preference options. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLocationPreference();

    return () => {
      isMounted = false;
    };
  }, [
    initialLocationPreference,
    initialOpenToRemoteWork,
    initialRemoteWorkPreference,
    initialWillingToRelocate,
  ]);

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
          <Text style={styles.subheading}>Let's build your general profile</Text>
          <Text style={styles.heading}>Location Preference</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2cbbc1" />
            </View>
          ) : errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : (
            questions.map((question) => (
              <View key={question.questionId} style={styles.questionBlock}>
                <Text style={styles.questionText}>{question.question}</Text>

                {question.answers.map((answer) => (
                  <RadioOption
                    key={answer.answerId}
                    label={answer.answer}
                    selected={selectedAnswersByQuestionId[question.questionId] === answer.answerId}
                    onPress={() => {
                      setSelectedAnswersByQuestionId((prev) => ({
                        ...prev,
                        [question.questionId]: answer.answerId,
                      }));
                    }}
                    styles={styles}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            onContinue?.({
              locationPreference: toLocationPreferenceList(selectedAnswersByQuestionId),
            });
          }}
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
      width: vw(30),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
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
      marginBottom: vh(6),
    },
    questionBlock: {
      marginBottom: vh(5),
    },
    questionText: {
      color: '#141414',
      fontSize: responsiveFont(isShortScreen ? 17 : 18, 16, 20),
      lineHeight: responsiveFont(isShortScreen ? 26 : 28, 22, 30),
      fontWeight: '400',
      marginBottom: vh(1),
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: moderateScale(44),
      marginTop: vh(1.2),
    },
    radioOuter: {
      width: moderateScale(30),
      height: moderateScale(30),
      borderRadius: 999,
      borderWidth: 3,
      borderColor: '#9297a6',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: vw(5),
      backgroundColor: 'transparent',
    },
    radioOuterSelected: {
      borderColor: '#0097b2',
    },
    radioInner: {
      width: moderateScale(15),
      height: moderateScale(15),
      borderRadius: 999,
      backgroundColor: '#0097b2',
    },
    optionLabel: {
      color: '#111111',
      fontSize: responsiveFont(isShortScreen ? 17 : 18, 16, 20),
      lineHeight: responsiveFont(isShortScreen ? 26 : 28, 22, 30),
      fontWeight: '400',
      flexShrink: 1,
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
