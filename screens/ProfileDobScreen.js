import React, { useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useResponsiveMetrics } from '../utils/responsive';
import { getPlatformBaseFontFamily, withPlatformFontStyles } from '../utils/typography';

function normalizeDate(value) {
  const normalized = new Date(value);
  normalized.setHours(12, 0, 0, 0);
  return normalized;
}

function parseInitialDob(initialDob) {
  if (!initialDob) return null;

  if (initialDob instanceof Date && !Number.isNaN(initialDob.getTime())) {
    return normalizeDate(initialDob);
  }

  if (typeof initialDob === 'string') {
    const parsed = new Date(initialDob);
    if (!Number.isNaN(parsed.getTime())) {
      return normalizeDate(parsed);
    }
  }

  return null;
}

function toStorageDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseWebDateValue(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDisplayDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function calculateAge(dateOfBirth) {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();

  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  const dayDiff = today.getDate() - dateOfBirth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(age, 0);
}

export default function ProfileDobScreen({ onBack, onContinue, initialDob = '' }) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const isShortScreen = metrics.height < 760;

  const [dob, setDob] = useState(() => parseInitialDob(initialDob));
  const [showPicker, setShowPicker] = useState(false);

  const webDateInputStyle = useMemo(
    () => ({
      width: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      color: '#3d3d3d',
      fontFamily: getPlatformBaseFontFamily(),
      fontSize: `${Math.round(metrics.responsiveFont(isShortScreen ? 19 : 22, 16, 24))}px`,
      lineHeight: `${Math.round(metrics.responsiveFont(isShortScreen ? 24 : 27, 20, 30))}px`,
      padding: '0px',
      minHeight: `${Math.round(metrics.moderateScale(isShortScreen ? 48 : 54))}px`,
      boxSizing: 'border-box',
    }),
    [isShortScreen, metrics],
  );

  const age = dob ? calculateAge(dob) : 0;
  const canContinue = Boolean(dob);

  const handlePickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }

    if (event?.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      setDob(normalizeDate(selectedDate));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.subheading}>Let’s build your general profile</Text>
        <Text style={styles.heading}>What is your DOB?</Text>

        <View style={styles.dateInputBlock}>
          {Platform.OS === 'web' ? (
            <View style={styles.dateInputRow}>
              <input
                type="date"
                value={dob ? toStorageDate(dob) : ''}
                max={toStorageDate(new Date())}
                onChange={(event) => {
                  const nextDate = parseWebDateValue(event.target.value);
                  if (nextDate) {
                    setDob(nextDate);
                  }
                }}
                style={webDateInputStyle}
                aria-label="Date of birth"
              />
            </View>
          ) : (
            <>
              <Pressable style={styles.dateInputRow} onPress={() => setShowPicker(true)}>
                <Text style={[styles.dateInputText, !dob && styles.datePlaceholderText]}>
                  {dob ? toDisplayDate(dob) : 'DD/MM/YY'}
                </Text>

                <View style={styles.calendarIconOuter}>
                  <View style={styles.calendarHeader} />
                  <View style={styles.calendarGridRow}>
                    <View style={styles.calendarDot} />
                    <View style={styles.calendarDot} />
                    <View style={styles.calendarDot} />
                  </View>
                </View>
              </Pressable>

              {showPicker && (
                <DateTimePicker
                  value={dob ?? new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={handlePickerChange}
                />
              )}
            </>
          )}
        </View>

        <Text style={styles.noteText}>Your full date of birth will never be shown publicly.</Text>

        <Text style={styles.ageText}>Age: {age}</Text>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            if (!dob) return;
            onContinue?.({
              dateOfBirth: toStorageDate(dob),
              age,
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
      width: vw(15),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: isShortScreen ? vh(3.2) : vh(4.2),
      paddingBottom: vh(4),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(3.2) : vh(4),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
    },
    subheading: {
      color: '#616161',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      marginBottom: isShortScreen ? vh(4.6) : vh(5.6),
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginBottom: isShortScreen ? vh(8) : vh(9),
    },
    dateInputBlock: {
      marginBottom: isShortScreen ? vh(6) : vh(7.2),
    },
    dateInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 2,
      borderBottomColor: '#9f9fa1',
      minHeight: moderateScale(isShortScreen ? 48 : 54),
      paddingBottom: vh(0.6),
    },
    dateInputText: {
      color: '#3d3d3d',
      fontSize: responsiveFont(isShortScreen ? 19 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 27, 20, 30),
      fontWeight: '400',
      letterSpacing: 0.8,
    },
    datePlaceholderText: {
      color: '#80879d',
    },
    calendarIconOuter: {
      width: moderateScale(isShortScreen ? 30 : 34),
      height: moderateScale(isShortScreen ? 28 : 32),
      borderRadius: moderateScale(5),
      borderWidth: 2,
      borderColor: '#25c0cb',
      alignItems: 'center',
      paddingTop: moderateScale(3),
    },
    calendarHeader: {
      width: '80%',
      height: moderateScale(4),
      borderRadius: moderateScale(2),
      backgroundColor: '#25c0cb',
      marginBottom: moderateScale(4),
    },
    calendarGridRow: {
      width: '80%',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    calendarDot: {
      width: moderateScale(4),
      height: moderateScale(4),
      borderRadius: moderateScale(2),
      backgroundColor: '#25c0cb',
    },
    noteText: {
      color: '#565656',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 15, 22),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 34),
      fontWeight: '400',
      marginBottom: isShortScreen ? vh(10) : vh(12),
      maxWidth: '88%',
    },
    ageText: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: vh(3),
    },
    continueButton: {
      marginTop: 'auto',
      width: isNarrowScreen ? '86%' : '84%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginBottom: vh(0.8),
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
