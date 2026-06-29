import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const COUNTRY_CODES = [
  { code: 'US', dial: '+1' },
  { code: 'CA', dial: '+1' },
  { code: 'GB', dial: '+44' },
  { code: 'AU', dial: '+61' },
  { code: 'IN', dial: '+91' },
];
export default function PhoneNumberScreen({
  selectedCountry = COUNTRY_CODES[0],
  phoneNumber = '',
  isSubmitting = false,
  onPhoneNumberChange,
  onOpenCountryPicker,
  onContinue,
}) {
  const [phoneInputFocused, setPhoneInputFocused] = useState(false);

  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(
    () => createStyles(metrics, insets.top, insets.bottom, phoneInputFocused),
    [metrics, insets.top, insets.bottom, phoneInputFocused],
  );

  const normalizedPhone = phoneNumber.replace(/\D/g, '');
  const isPhoneValid = normalizedPhone.length >= 7 && normalizedPhone.length <= 15;

  const handleContinue = () => {
    if (isPhoneValid) {
      onContinue?.({
        countryCode: selectedCountry.code,
        dialCode: selectedCountry.dial,
        phoneNumber,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerWrap}>
          <Text style={styles.heading}>Can we get your{"\n"}number?</Text>
        </View>

        <View style={styles.formWrap}>
          <View style={styles.inputGroupWrap}>
            <View style={styles.countryFieldWrap}>
              <Pressable
                style={styles.countryCodeButton}
                onPress={onOpenCountryPicker}
                disabled={isSubmitting}
              >
                <Text style={styles.countryCodeText}>
                  {selectedCountry.code}
                  {selectedCountry.dial}
                </Text>
                <Text style={styles.dropdownArrow}>▼</Text>
              </Pressable>
            </View>

            <TextInput
              style={[styles.phoneInput, phoneInputFocused && styles.phoneInputFocused]}
              placeholder=""
              placeholderTextColor="#888"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={onPhoneNumberChange}
              underlineColorAndroid="transparent"
              editable={!isSubmitting}
              onFocus={() => setPhoneInputFocused(true)}
              onBlur={() => setPhoneInputFocused(false)}
            />
          </View>

          <Text style={styles.infoText}>
            We will send you a text with verification code
          </Text>
        </View>

        <Pressable
          style={[styles.continueButton, !isPhoneValid && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!isPhoneValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={[styles.continueButtonText, !isPhoneValid && styles.continueButtonTextDisabled]}>
              Continue
            </Text>
          )}
        </Pressable>

        {isSubmitting ? (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#31c6d5" />
              <Text style={styles.loadingText}>Sending verification code...</Text>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(
  { width, height, vw, vh, moderateScale, responsiveFont },
  topInset = 0,
  bottomInset = 0,
  phoneInputFocused = false,
) {
  const isShortScreen = height < 760;

  // Only show bottom border when focused, hide others
  const phoneInputBorderStyles = phoneInputFocused
    ? {
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 2,
        borderBottomColor: '#31c6d5', // highlight color when focused
      }
    : {
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 2,
        borderBottomColor: '#a5a5a5',
      };

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#ffffff',
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5.2),
      paddingTop: topInset + (isShortScreen ? vh(2.8) : vh(3.6)),
      paddingBottom: vh(4),
      justifyContent: 'flex-start',
    },
    headerWrap: {
      marginTop: vh(1.2),
      marginBottom: isShortScreen ? vh(10.2) : vh(12.2),
    },
    heading: {
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      color: '#000000',
    },
    formWrap: {
      marginBottom: 0,
    },
    inputGroupWrap: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: isShortScreen ? vh(3.5) : vh(5),
    },
    countryFieldWrap: {
      width: isShortScreen ? '38%' : '36%',
      marginRight: vw(6),
      position: 'relative',
    },
    countryCodeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: vw(1.5),
      paddingVertical: vh(1.5),
      borderBottomWidth: 2,
      borderBottomColor: '#a5a5a5',
      marginBottom: 0,
    },
    countryCodeText: {
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 20 : 24, 17, 26),
      fontWeight: '400',
      color: '#333333',
    },
    dropdownArrow: {
      fontSize: responsiveFont(12, 10, 14),
      color: '#999999',
    },
    phoneInput: {
      flex: 1,
      fontSize: responsiveFont(isShortScreen ? 16 : 18, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 20 : 24, 17, 26),
      fontWeight: '400',
      paddingHorizontal: 0,
      paddingVertical: vh(1.5),
      color: '#333333',
      ...phoneInputBorderStyles,
    },
    phoneInputFocused: {
      borderBottomColor: '#31c6d5',
    },
    infoText: {
      fontSize: responsiveFont(isShortScreen ? 14 : 15, 12, 17),
      lineHeight: responsiveFont(isShortScreen ? 20 : 22, 16, 25),
      fontWeight: '400',
      color: '#666666',
      marginTop: isShortScreen ? vh(1.5) : vh(2.5),
    },
    continueButton: {
      marginTop: 'auto',
      marginBottom: bottomInset + vh(1.2),
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
      backgroundColor: '#9edce3',
      shadowOpacity: 0,
      elevation: 0,
    },
    continueButtonText: {
      fontSize: responsiveFont(isShortScreen ? 18 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 22 : 26, 19, 28),
      fontWeight: '400',
      color: '#ffffff',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#e9f6f8',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 255, 255, 0.78)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(8),
    },
    loadingCard: {
      minWidth: vw(58),
      paddingHorizontal: vw(7),
      paddingVertical: vh(2.8),
      borderRadius: moderateScale(22),
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    loadingText: {
      marginTop: vh(1.6),
      fontSize: responsiveFont(isShortScreen ? 15 : 16, 13, 18),
      lineHeight: responsiveFont(isShortScreen ? 20 : 22, 17, 24),
      fontWeight: '400',
      color: '#4f5768',
      textAlign: 'center',
    },
  }));
}
