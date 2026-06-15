import React, { useMemo, useState } from 'react';
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
import { withPlatformFontStyles } from '../utils/typography';

export default function ProfileNameScreen({
  onBack,
  onContinue,
  initialFirstName = '',
  initialLastName = '',
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [isFirstNameFocused, setIsFirstNameFocused] = useState(false);
  const [isLastNameFocused, setIsLastNameFocused] = useState(false);

  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const canContinue = firstName.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <Text style={styles.subheading}>Let’s build your general profile</Text>
        <Text style={styles.heading}>What is your name?</Text>

        <View style={styles.inputBlock}>
          <TextInput
            style={[
              styles.input,
              styles.firstInput,
              isFirstNameFocused && styles.inputFocused,
            ]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First Name"
            placeholderTextColor="#606060"
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="givenName"
            returnKeyType="next"
            onFocus={() => setIsFirstNameFocused(true)}
            onBlur={() => setIsFirstNameFocused(false)}
          />

          <TextInput
            style={[
              styles.input,
              isLastNameFocused && styles.inputFocused,
            ]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last Name (Optional)"
            placeholderTextColor="#606060"
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="familyName"
            returnKeyType="done"
            onFocus={() => setIsLastNameFocused(true)}
            onBlur={() => setIsLastNameFocused(false)}
          />
        </View>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => {
            onContinue?.({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
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
      width: vw(10),
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
      marginBottom: isShortScreen ? vh(6.8) : vh(8),
    },
    inputBlock: {
      gap: vh(4.2),
    },
    input: {
      borderBottomWidth: 2,
      borderBottomColor: '#9f9fa1',
      color: '#171717',
      fontSize: responsiveFont(isShortScreen ? 19 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 27, 20, 30),
      fontWeight: '400',
      paddingHorizontal: 0,
      paddingVertical: vh(1.15),
    },
    firstInput: {
      marginTop: vh(0.8),
    },
    inputFocused: {
      borderBottomColor: '#31b8c1',
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
