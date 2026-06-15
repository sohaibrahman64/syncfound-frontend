import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

function isValidEmail(value) {
  const email = value.trim();
  if (!email) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function EmailScreen({
  initialEmail = '',
  isSubmitting = false,
  errorMessage = '',
  onEmailChange,
  onBack,
  onContinue,
}) {
  const [email, setEmail] = useState(initialEmail);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const emailInputRef = useRef(null);

  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics, isInputFocused), [metrics, isInputFocused]);

  const normalizedEmail = email.trim();
  const isEmailValid = isValidEmail(email);

  const handleEdit = () => {
    setShowConfirmation(false);
    requestAnimationFrame(() => {
      emailInputRef.current?.focus();
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerWrap}>
          <Text style={styles.heading}>What is your email?</Text>
        </View>

        <View style={styles.formWrap}>
          <TextInput
            ref={emailInputRef}
            style={styles.emailInput}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              onEmailChange?.(value);
            }}
            placeholder="Email"
            placeholderTextColor="#555555"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!showConfirmation && !isSubmitting}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (!isEmailValid || showConfirmation || isSubmitting) && styles.continueButtonDisabled,
          ]}
          onPress={() => {
            if (isEmailValid && !isSubmitting) {
              setShowConfirmation(true);
            }
          }}
          disabled={!isEmailValid || showConfirmation || isSubmitting}
        >
          <Text
            style={[
              styles.continueButtonText,
              (!isEmailValid || showConfirmation || isSubmitting) && styles.continueButtonTextDisabled,
            ]}
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Text>
        </Pressable>
      </View>

      {showConfirmation ? (
        <View style={styles.confirmationOverlay} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={handleEdit} />
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Please confirm your email</Text>
            <Text style={styles.confirmationEmail}>{normalizedEmail}</Text>

            <View style={styles.confirmationActions}>
              <Pressable onPress={handleEdit} hitSlop={8} style={styles.editAction}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>

              <Pressable
                style={styles.confirmButton}
                disabled={isSubmitting}
                onPress={() => {
                  setShowConfirmation(false);
                  onContinue?.({ email: normalizedEmail });
                }}
              >
                <Text style={styles.confirmButtonText}>Yes, it’s correct</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }, isInputFocused) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#f3f3f3',
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: isShortScreen ? vh(7.2) : vh(8.6),
      paddingBottom: vh(4.8),
    },
    headerWrap: {
      marginBottom: isShortScreen ? vh(10) : vh(11.5),
    },
    heading: {
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      color: '#000000',
      fontWeight: '700',
      maxWidth: vw(isNarrowScreen ? 96 : 88),
    },
    formWrap: {
      marginBottom: vh(2),
    },
    emailInput: {
      width: '100%',
      borderBottomWidth: 2,
      borderBottomColor: isInputFocused ? '#31c6d5' : '#9f9fa1',
      fontSize: responsiveFont(isShortScreen ? 19 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 27, 20, 30),
      color: '#171717',
      fontWeight: '400',
      paddingHorizontal: 0,
      paddingVertical: vh(1.15),
    },
    errorText: {
      marginTop: vh(1.2),
      color: '#dc2626',
      fontSize: responsiveFont(isShortScreen ? 14 : 15, 12, 17),
      lineHeight: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      fontWeight: '400',
    },
    continueButton: {
      marginTop: 'auto',
      alignSelf: 'center',
      width: isNarrowScreen ? '84%' : '82%',
      borderRadius: 999,
      backgroundColor: '#31b8c1',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(6),
    },
    continueButtonDisabled: {
      backgroundColor: '#d3d3d6',
    },
    continueButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 19, 28),
      fontWeight: '700',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#738099',
    },
    confirmationOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      paddingHorizontal: vw(6),
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(84, 96, 91, 0.74)',
    },
    confirmationCard: {
      borderRadius: moderateScale(20),
      backgroundColor: '#f4f4f4',
      paddingHorizontal: vw(5),
      paddingTop: vh(2.6),
      paddingBottom: vh(1.8),
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    confirmationTitle: {
      color: '#121212',
      fontSize: responsiveFont(isShortScreen ? 25 : 28, 19, 28),
      lineHeight: responsiveFont(isShortScreen ? 30 : 32, 25, 34),
      fontWeight: '400',
      marginBottom: vh(1.2),
    },
    confirmationEmail: {
      color: '#141414',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 17, 24),
      lineHeight: responsiveFont(isShortScreen ? 26 : 28, 21, 30),
      fontWeight: '400',
      marginBottom: vh(2.4),
    },
    confirmationActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: vw(3),
    },
    editAction: {
      minWidth: vw(20),
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: vh(1),
    },
    editText: {
      color: '#111111',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 19, 28),
      fontWeight: '400',
    },
    confirmButton: {
      flex: 1,
      borderRadius: 999,
      backgroundColor: '#31b8c1',
      minHeight: moderateScale(isShortScreen ? 48 : 54),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
    },
    confirmButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 19 : 21, 15, 23),
      lineHeight: responsiveFont(isShortScreen ? 26 : 28, 21, 30),
      fontWeight: '400',
      textAlign: 'center',
    },
  }));
}
