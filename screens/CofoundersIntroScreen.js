import React, { useMemo } from 'react';
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

export default function CofoundersIntroScreen({
  onNext,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/cofounders.jpg')}
        resizeMode="cover"
        style={styles.background}
      >
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.brandBlock}>
              <Image
                source={require('../assets/splash_screen_syncfound_image_logo_green.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.welcomeText}>Welcome To</Text>

              <Image
                source={require('../assets/syncfound_text_logo_white.png')}
                style={styles.wordmark}
                resizeMode="contain"
              />

              <Text style={styles.subtitleBase}>
                Build your startup team
                <Text style={styles.subtitleHighlight}> cofounders,</Text>
                {'\n'}
                <Text style={styles.subtitleHighlight}>early hires, and everything in between.</Text>
              </Text>
            </View>

            <Pressable style={styles.nextButton} onPress={onNext}>
              <Text style={styles.nextButtonText}>Next</Text>
            </Pressable>
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
      backgroundColor: '#33403a',
    },
    background: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(18, 29, 28, 0.45)',
    },
    safeArea: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: isNarrowScreen ? vw(6) : vw(7),
      paddingTop: isShortScreen ? vh(6) : vh(8.8),
      paddingBottom: isShortScreen ? vh(3.4) : vh(4.8),
    },
    brandBlock: {
      alignItems: 'center',
      marginTop: isShortScreen ? vh(12) : vh(14),
    },
    logo: {
      width: moderateScale(isShortScreen ? 72 : 82),
      height: moderateScale(isShortScreen ? 72 : 82),
      marginBottom: vh(1.8),
    },
    welcomeText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 26 : 30, 22, 32),
      lineHeight: responsiveFont(isShortScreen ? 32 : 36, 27, 38),
      fontWeight: '400',
      marginBottom: vh(0.8),
    },
    wordmark: {
      width: isNarrowScreen ? vw(78) : vw(82),
      maxWidth: 340,
      height: moderateScale(isShortScreen ? 64 : 74),
      marginBottom: vh(2),
    },
    subtitleBase: {
      color: '#ffffff',
      textAlign: 'center',
      fontSize: responsiveFont(isShortScreen ? 17 : 19, 14, 20),
      lineHeight: responsiveFont(isShortScreen ? 26 : 29, 20, 31),
      fontWeight: '400',
      maxWidth: isNarrowScreen ? vw(88) : vw(84),
    },
    subtitleHighlight: {
      color: '#39d4e5',
      fontWeight: '500',
    },
    nextButton: {
      width: isNarrowScreen ? '86%' : '84%',
      maxWidth: 360,
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginBottom: isShortScreen ? vh(0.6) : vh(1.4),
    },
    nextButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 18 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 22 : 26, 19, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
  }));
}
