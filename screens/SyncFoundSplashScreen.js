import React from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

export default function SyncFoundSplashScreen({
  backgroundSource,
  logoSource,
  wordmarkSource,
  onCreateAccount,
  onSignIn,
}) {
  const metrics = useResponsiveMetrics();
  const styles = React.useMemo(() => createStyles(metrics), [metrics]);

  return (
    <View style={styles.container}>
      <ImageBackground source={backgroundSource} resizeMode="cover" style={styles.background}>
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.brandWrap}>
              {logoSource ? <Image source={logoSource} style={styles.logo} resizeMode="contain" /> : null}

              {wordmarkSource ? (
                <Image source={wordmarkSource} style={styles.wordmark} resizeMode="contain" />
              ) : (
                <Text style={styles.wordmarkText}>SyncFound</Text>
              )}
            </View>

            <View style={styles.bottomWrap}>
              <Text style={styles.termsText}>
                By tapping 'Create Account' or 'Sign In',{"\n"}
                you agree to our{' '}
                <Text style={styles.termsLink}>Privacy Policy and{"\n"}Terms of Service</Text>
              </Text>

              <Pressable style={styles.primaryButton} onPress={onCreateAccount}>
                <Text style={styles.primaryButtonText}>Create Account</Text>
              </Pressable>

              <Pressable hitSlop={10} onPress={onSignIn}>
                <Text style={styles.signInText}>Sign In</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isShortScreen = height < 760;
  const isNarrowScreen = width < 360;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#5f6f67',
    },
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(35, 47, 44, 0.40)',
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: isNarrowScreen ? vw(5.2) : vw(6.2),
      paddingTop: isShortScreen ? vh(6.5) : vh(10.5),
      paddingBottom: isShortScreen ? vh(2.2) : vh(4),
    },
    brandWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      flex: 1,
    },
    logo: {
      width: moderateScale(isShortScreen ? 74 : 90),
      height: moderateScale(isShortScreen ? 74 : 90),
      marginBottom: isShortScreen ? vh(1.1) : vh(1.8),
      alignSelf: 'center',
    },
    wordmark: {
      width: isNarrowScreen ? vw(78) : vw(80),
      maxWidth: 350,
      height: moderateScale(isShortScreen ? 48 : 56),
      alignSelf: 'center',
    },
    wordmarkText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 50 : 58, 38, 66),
      lineHeight: responsiveFont(isShortScreen ? 55 : 64, 44, 72),
      fontWeight: '700',
      letterSpacing: -1.2,
      textAlign: 'center',
      alignSelf: 'center',
    },
    bottomWrap: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: isShortScreen ? vh(0.6) : vh(1.1),
      transform: [{ translateY: -50 }],
    },
    termsText: {
      color: '#ffffff',
      textAlign: 'center',
      fontSize: responsiveFont(isShortScreen ? 14 : 16, 13, 18),
      lineHeight: responsiveFont(isShortScreen ? 21 : 24, 18, 27),
      marginBottom: isShortScreen ? vh(2.2) : vh(3.6),
      maxWidth: isNarrowScreen ? vw(90) : vw(86),
      alignSelf: 'center',
    },
    termsLink: {
      textDecorationLine: 'underline',
    },
    primaryButton: {
      width: isNarrowScreen ? '86%' : '84%',
      maxWidth: 360,
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 44 : 50),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isShortScreen ? vh(1.3) : vh(2.4),
      paddingHorizontal: vw(4.2),
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      alignSelf: 'center',
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 18 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 22 : 26, 19, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    signInText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 18 : 24, 16, 28),
      lineHeight: responsiveFont(isShortScreen ? 22 : 28, 19, 32),
      fontWeight: '400',
      textDecorationLine: 'underline',
      textAlign: 'center',
      alignSelf: 'center',
    },
  }));
}
