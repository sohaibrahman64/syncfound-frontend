import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { sendOtp } from '../utils/firebaseAuth';
import { withPlatformFontStyles } from '../utils/typography';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 120;

function formatSecondsToClock(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function OtpScreen({
  phoneNumber = '',
  initialConfirmation = null,
  onBack,
  onContinue,
  onResend,
}) {
  const [otpCode, setOtpCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [confirmation, setConfirmation] = useState(initialConfirmation);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusVariant, setStatusVariant] = useState('info');
  const inputRef = useRef(null);
  const hasAutoSubmittedRef = useRef(false);

  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timerId = setInterval(() => {
      setSecondsLeft((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, [secondsLeft]);

  const isResendEnabled = secondsLeft === 0;

  const handleOtpChange = (value) => {
    const normalized = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtpCode(normalized);
    hasAutoSubmittedRef.current = false;
    if (statusMessage) {
      setStatusMessage('');
      setStatusVariant('info');
    }
  };

  const handleResend = async () => {
    if (!isResendEnabled || isResending) {  
      return;
    }

    setIsResending(true);
    try {
      console.log(phoneNumber);
      const newConfirmation = await sendOtp(phoneNumber);
      console.log(phoneNumber, newConfirmation);
      setConfirmation(newConfirmation);
      setSecondsLeft(RESEND_SECONDS);
      setOtpCode('');
      setStatusMessage('A new verification code has been sent.');
      setStatusVariant('info');
      onResend?.();
    } catch (error) {
      console.error('Error resending OTP:', error);
      setStatusMessage('Could not resend the code. Please try again.');
      setStatusVariant('error');
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = useCallback(async () => {
    if (!confirmation) {
      console.error('No confirmation object — OTP was not sent yet.');
      setStatusMessage('Verification is not ready yet. Please wait and try again.');
      setStatusVariant('error');
      hasAutoSubmittedRef.current = false;
      return;
    }

    if (otpCode.length !== OTP_LENGTH) {
      setStatusMessage(`Please enter the full ${OTP_LENGTH}-digit code.`);
      setStatusVariant('error');
      hasAutoSubmittedRef.current = false;
      return;
    }

    setIsVerifying(true);
    try {
      const userCredential = await confirmation.confirm(otpCode);
      const idToken = await userCredential.user.getIdToken();
      setStatusMessage('Phone number verified successfully.');
      setStatusVariant('info');
      await onContinue?.({
        otpCode,
        idToken,
        phoneNumber: userCredential.user.phoneNumber || phoneNumber,
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setStatusMessage('Incorrect code. Please check the SMS and try again.');
      setStatusVariant('error');
      setOtpCode('');
      hasAutoSubmittedRef.current = false;
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [confirmation, onContinue, otpCode, phoneNumber]);

  useEffect(() => {
    if (otpCode.length !== OTP_LENGTH) {
      return;
    }

    if (!confirmation || isVerifying || isResending || hasAutoSubmittedRef.current) {
      return;
    }

    hasAutoSubmittedRef.current = true;
    handleContinue();
  }, [confirmation, handleContinue, isResending, isVerifying, otpCode]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image
            source={require('../assets/back_arrow.png')}
            style={styles.backArrowImage}
          />
        </Pressable>

        <Text style={styles.heading}>Enter your code</Text>
        <Text style={styles.phoneText}>{phoneNumber}</Text>

        <Pressable
          style={styles.otpRow}
          onPress={() => {
            inputRef.current?.focus();
          }}
        >
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={otpCode}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            importantForAutofill="yes"
            autoCorrect={false}
            autoCapitalize="none"
            maxLength={OTP_LENGTH}
            autoFocus
            editable={!isVerifying && !isResending}
          />

          {Array.from({ length: OTP_LENGTH }).map((_, index) => (
            <View key={`otp-slot-${index}`} style={styles.otpSlot}>
              <Text style={styles.otpDigit}>{otpCode[index] || ''}</Text>
              <View style={styles.otpUnderline} />
            </View>
          ))}
        </Pressable>

        <Text style={styles.infoText}>Didn't get anything? No worries, let's try again.</Text>

        {statusMessage ? (
          <Text
            style={[
              styles.statusText,
              statusVariant === 'error' && styles.statusTextError,
            ]}
          >
            {statusMessage}
          </Text>
        ) : null}

        <View style={styles.resendRow}>
          <Pressable onPress={handleResend} disabled={!isResendEnabled || isResending} hitSlop={8}>
            <Text
              style={[
                styles.resendText,
                (isResendEnabled && !isResending) && styles.resendTextEnabled,
                (isResending || !isResendEnabled) && styles.resendTextDisabled,
              ]}
            >
              Resend
            </Text>
          </Pressable>
          <Text style={[styles.timerText, isResendEnabled && styles.timerTextDisabled]}>
            {formatSecondsToClock(secondsLeft)}
          </Text>
        </View>

        <Pressable
          style={[
            styles.continueButton,
            (isVerifying || isResending) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={isVerifying || isResending}
        >
          <Text style={styles.continueButtonText}>
            {isVerifying ? 'Verifying...' : 'Continue'}
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
    content: {
      flex: 1,
      paddingHorizontal: vw(6),
      paddingTop: isShortScreen ? vh(1.6) : vh(2.2),
      paddingBottom: vh(4),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.6),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(3) : vh(4),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      height: responsiveFont(isNarrowScreen ? 28 : 32, 24, 36),
      resizeMode: 'contain',
    },
    heading: {
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      color: '#000000',
      marginBottom: vh(1),
    },
    phoneText: {
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 15, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 19, 30),
      color: '#6f778a',
      fontWeight: '400',
      marginBottom: isShortScreen ? vh(5.2) : vh(6),
    },
    otpRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: isShortScreen ? vh(4.2) : vh(5),
      position: 'relative',
    },
    hiddenInput: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1,
    },
    otpSlot: {
      width: isNarrowScreen ? vw(13) : vw(14.5),
      alignItems: 'center',
    },
    otpDigit: {
      fontSize: responsiveFont(isShortScreen ? 26 : 30, 22, 34),
      lineHeight: responsiveFont(isShortScreen ? 30 : 34, 26, 38),
      color: '#4f5768',
      minHeight: moderateScale(36),
      fontWeight: '600',
    },
    otpUnderline: {
      width: '70%',
      borderBottomWidth: 2,
      borderBottomColor: '#7d8294',
      marginTop: vh(0.8),
    },
    infoText: {
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 18, 30),
      color: '#4f4f4f',
      fontWeight: '400',
      maxWidth: vw(82),
      marginBottom: isShortScreen ? vh(4.2) : vh(5),
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: vw(7),
    },
    resendText: {
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      color: '#7b8396',
      fontWeight: '700',
    },
    resendTextEnabled: {
      color: '#24b9c6',
    },
    timerText: {
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      color: '#24b9c6',
      fontWeight: '400',
    },
    timerTextDisabled: {
      color: '#7b8396',
    },
    continueButton: {
      marginTop: 'auto',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 54 : 62),
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    continueButtonDisabled: {
      opacity: 0.7,
      shadowOpacity: 0,
      elevation: 0,
    },
    continueButtonText: {
      fontSize: responsiveFont(isShortScreen ? 18 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 22 : 26, 19, 28),
      color: '#ffffff',
      textAlign: 'center',
      fontWeight: '400',
    },
    resendTextDisabled: {
      color: '#9ca3af',
    },
    statusText: {
      fontSize: responsiveFont(isShortScreen ? 14 : 16, 12, 18),
      lineHeight: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      color: '#374151',
      fontWeight: '400',
      marginBottom: vh(1.8),
    },
    statusTextError: {
      color: '#dc2626',
    },
  }));
}
