import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { sendOtp, signOutFirebaseSession } from './utils/firebaseAuth';
import {
  sendFirebaseIdTokenToBackend,
  signInWithFirebaseToken,
  updateUserEmailInBackend,
} from './utils/backendAuth';
import {
  deactivateCurrentDevicePushToken,
  initializeChatNotifications,
} from './utils/chatNotifications';
import SyncFoundSplashScreen from './screens/SyncFoundSplashScreen';
import PhoneNumberScreen from './screens/PhoneNumberScreen';
import CountryPickerScreen from './screens/CountryPickerScreen';
import OtpScreen from './screens/OtpScreen';
import EmailScreen from './screens/EmailScreen';
import CofoundersIntroScreen from './screens/CofoundersIntroScreen';
import ProfileWizardScreen from './screens/ProfileWizardScreen';
import HomeScreen from './screens/HomeScreen';
import { ProfileWizardProvider } from './context/ProfileWizardContext';
import { getPlatformBaseFontFamily } from './utils/typography';

let hasAppliedGlobalPlatformFontDefaults = false;
const SESSION_STORAGE_KEY = '@syncfound/session';
const PROFILE_COMPLETE_STORAGE_KEY = '@syncfound/profile_complete';

function parseChatLaunchFromUrl(url) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedUrl);
    const conversationId = String(
      parsed.searchParams.get('chat_conversation_id') ||
      parsed.searchParams.get('conversation_id') ||
      '',
    ).trim();
    const initialMessageId = String(
      parsed.searchParams.get('chat_message_id') ||
      parsed.searchParams.get('message_id') ||
      '',
    ).trim();

    if (!conversationId) {
      return null;
    }

    return {
      conversationId,
      initialMessageId,
    };
  } catch {
    return null;
  }
}

function applyGlobalPlatformFontDefaults() {
  if (hasAppliedGlobalPlatformFontDefaults) {
    return;
  }

  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.style = [
    { fontFamily: getPlatformBaseFontFamily() },
    Text.defaultProps.style,
  ].filter(Boolean);

  TextInput.defaultProps = TextInput.defaultProps || {};
  TextInput.defaultProps.style = [
    { fontFamily: getPlatformBaseFontFamily() },
    TextInput.defaultProps.style,
  ].filter(Boolean);

  hasAppliedGlobalPlatformFontDefaults = true;
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [authMode, setAuthMode] = useState('signup');
  const [selectedCountry, setSelectedCountry] = useState({
    code: 'US',
    iso3: 'USA',
    phoneCode: '1',
    dial: '+1',
    name: 'United States',
  });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpPhoneDisplay, setOtpPhoneDisplay] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState('');
  const [firebaseToken, setFirebaseToken] = useState('');
  const [backendUserId, setBackendUserId] = useState(null);
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailUpdateError, setEmailUpdateError] = useState('');
  const [chatNotificationLaunch, setChatNotificationLaunch] = useState({
    conversationId: '',
    initialMessageId: '',
    nonce: 0,
  });

  const handleAuthExpired = useCallback(async () => {
    await deactivateCurrentDevicePushToken({
      firebaseToken,
    }).catch(() => {});

    await signOutFirebaseSession().catch(() => {});
    await Promise.all([
      AsyncStorage.removeItem(SESSION_STORAGE_KEY),
      AsyncStorage.removeItem(PROFILE_COMPLETE_STORAGE_KEY),
    ]).catch(() => {});

    setFirebaseToken('');
    setBackendUserId(null);
    setVerifiedPhoneNumber('');
    setChatNotificationLaunch({
      conversationId: '',
      initialMessageId: '',
      nonce: 0,
    });
    setCurrentScreen('splash');
  }, [firebaseToken]);

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      applyGlobalPlatformFontDefaults();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search || '');
    const conversationId = String(params.get('chat_conversation_id') || '').trim();
    const initialMessageId = String(params.get('chat_message_id') || '').trim();
    if (!conversationId) {
      return;
    }

    setChatNotificationLaunch({
      conversationId,
      initialMessageId,
      nonce: Date.now(),
    });

    params.delete('chat_conversation_id');
    params.delete('chat_message_id');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  useEffect(() => {
    const consumeUrl = (url) => {
      const launch = parseChatLaunchFromUrl(url);
      if (!launch) {
        return;
      }

      setCurrentScreen('home');
      setChatNotificationLaunch({
        conversationId: launch.conversationId,
        initialMessageId: launch.initialMessageId,
        nonce: Date.now(),
      });
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        consumeUrl(initialUrl);
      }
    }).catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      consumeUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!String(firebaseToken || '').trim()) {
      return;
    }

    let cleanup = () => {};
    let isMounted = true;

    const init = async () => {
      const release = await initializeChatNotifications({
        firebaseToken,
        onAuthExpired: handleAuthExpired,
        onChatNotificationOpen: ({ conversationId, initialMessageId }) => {
          if (!isMounted) {
            return;
          }

          setCurrentScreen('home');
          setChatNotificationLaunch({
            conversationId: String(conversationId || '').trim(),
            initialMessageId: String(initialMessageId || '').trim(),
            nonce: Date.now(),
          });
        },
      });

      if (!isMounted) {
        release?.();
        return;
      }

      cleanup = typeof release === 'function' ? release : () => {};
    };

    void init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [firebaseToken, handleAuthExpired]);

  // Resume wizard if the user had an in-progress profile and comes back to the app
  useEffect(() => {
    if (!fontsLoaded) return;

    Promise.all([
      AsyncStorage.getItem('@syncfound/profile_wizard'),
      AsyncStorage.getItem(SESSION_STORAGE_KEY),
      AsyncStorage.getItem(PROFILE_COMPLETE_STORAGE_KEY),
    ])
      .then(([wizardRaw, sessionRaw, profileCompleteRaw]) => {
        let restoredToken = '';
        if (sessionRaw) {
          try {
            const session = JSON.parse(sessionRaw);
            restoredToken = String(session?.firebaseToken || '').trim();
          } catch {
            restoredToken = '';
          }
        }

        if (restoredToken) {
          setFirebaseToken(restoredToken);
        }

        const isProfileComplete = profileCompleteRaw === 'true';
        if (isProfileComplete && restoredToken) {
          setCurrentScreen('home');
          return;
        }

        if (!wizardRaw) return;
        try {
          const saved = JSON.parse(wizardRaw);
          // Only auto-resume if they had actually started (stepIndex > 0 or draft not empty)
          const hasProgress =
            (saved.stepIndex != null && saved.stepIndex > 0) ||
            (saved.draft && Object.keys(saved.draft).length > 0);
          if (hasProgress) {
            setCurrentScreen('profileWizard');
          }
        } catch {
          // ignore malformed storage
        }
      })
      .catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  if (currentScreen === 'phoneNumber') {
    return (
      <>
        {/* Invisible reCAPTCHA anchor required by Firebase web phone auth */}
        {Platform.OS === 'web' && (
          <View
            nativeID="recaptcha-container"
            style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
          />
        )}
        <PhoneNumberScreen
          selectedCountry={selectedCountry}
          phoneNumber={phoneNumber}
          isSubmitting={isSendingOtp}
          onPhoneNumberChange={setPhoneNumber}
          onBack={() => setCurrentScreen('splash')}
          onOpenCountryPicker={() => setCurrentScreen('countryPicker')}
          onContinue={async (phoneData) => {
            const fullPhone = `${phoneData.dialCode}${phoneData.phoneNumber}`;
            console.log(fullPhone);
            setIsSendingOtp(true);
            try {
              const result = await sendOtp(fullPhone);
              setConfirmation(result);
              setOtpPhoneDisplay(fullPhone);
              setCurrentScreen('otp');
            } catch (error) {
              console.error('Error sending OTP:', error);
            } finally {
              setIsSendingOtp(false);
            }
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

    if (currentScreen === 'otp') {
      return (
        <>
          <OtpScreen
            phoneNumber={otpPhoneDisplay}
            initialConfirmation={confirmation}
            onBack={() => setCurrentScreen('phoneNumber')}
            onResend={() => {
              console.log('Resend OTP:', otpPhoneDisplay);
            }}
            onContinue={async ({ otpCode, idToken, phoneNumber: verifiedPhoneNumber }) => {
              if (authMode === 'signin') {
                try {
                  const backendResponse = await signInWithFirebaseToken(idToken, verifiedPhoneNumber || otpPhoneDisplay);
                  console.log('Sign in success:', backendResponse);
                  setVerifiedPhoneNumber(verifiedPhoneNumber || otpPhoneDisplay);
                  setFirebaseToken(idToken);
                  setBackendUserId(backendResponse?.user?.id ?? null);
                  AsyncStorage.setItem(
                    SESSION_STORAGE_KEY,
                    JSON.stringify({
                      firebaseToken: idToken,
                      userId: backendResponse?.user?.id ?? null,
                    }),
                  ).catch(() => {});
                  await AsyncStorage.setItem(PROFILE_COMPLETE_STORAGE_KEY, 'true').catch(() => {});
                  setCurrentScreen('home');
                } catch (error) {
                  console.error('Sign in failed:', error);
                  const isNotFound =
                    error?.status === 404 ||
                    /not found|does not exist|no user/i.test(String(error?.message || ''));
                  Alert.alert(
                    'Sign In Failed',
                    isNotFound
                      ? 'User not found or does not exist.'
                      : (error?.message || 'Sign in failed. Please try again.'),
                    [{ text: 'OK', onPress: () => setCurrentScreen('splash') }],
                  );
                }
              } else {
                try {
                  const backendResponse = await sendFirebaseIdTokenToBackend(idToken, verifiedPhoneNumber || otpPhoneDisplay);
                  console.log('FastAPI token handoff success:', backendResponse);
                  console.log('Verified phone:', verifiedPhoneNumber);
                  setVerifiedPhoneNumber(verifiedPhoneNumber || otpPhoneDisplay);
                  setFirebaseToken(idToken);
                  setBackendUserId(backendResponse?.user?.id ?? null);
                  AsyncStorage.setItem(
                    SESSION_STORAGE_KEY,
                    JSON.stringify({
                      firebaseToken: idToken,
                      userId: backendResponse?.user?.id ?? null,
                    }),
                  ).catch(() => {});
                  setEmailUpdateError('');
                  setCurrentScreen('email');
                } catch (error) {
                  console.error('Failed to send Firebase idToken to backend:', error);
                }
              }
            }}
          />
          <StatusBar style="dark" />
        </>
      );
    }

  if (currentScreen === 'email') {
    return (
      <>
        <EmailScreen
          onBack={() => setCurrentScreen('otp')}
          isSubmitting={isUpdatingEmail}
          errorMessage={emailUpdateError}
          onEmailChange={() => {
            if (emailUpdateError) {
              setEmailUpdateError('');
            }
          }}
          onContinue={async ({ email }) => {
            setIsUpdatingEmail(true);
            setEmailUpdateError('');
            try {
              const backendResponse = await updateUserEmailInBackend(email, firebaseToken);
              console.log('Email update success:', backendResponse);
              console.log('Email confirmed:', email, 'for phone:', verifiedPhoneNumber);
              setCurrentScreen('cofoundersIntro');
            } catch (error) {
              console.error('Failed to update user email:', error);
              const isEmailConflict =
                error?.status === 409 || /already\s+registered|already\s+exists|409/i.test(String(error?.message || ''));
              setEmailUpdateError(
                isEmailConflict
                  ? 'This email is already registered.'
                  : (error?.message || 'Could not update your email. Please try again.'),
              );
            } finally {
              setIsUpdatingEmail(false);
            }
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'cofoundersIntro') {
    return (
      <>
        <CofoundersIntroScreen
          onNext={() => {
            setCurrentScreen('profileWizard');
          }}
        />
        <StatusBar style="light" />
      </>
    );
  }

  if (currentScreen === 'profileWizard') {
    return (
      <>
        <ProfileWizardProvider>
          <ProfileWizardScreen
            firebaseToken={firebaseToken}
            backendUserId={backendUserId}
            selectedCountry={selectedCountry}
            onBack={() => setCurrentScreen('cofoundersIntro')}
            onComplete={async () => {
              await AsyncStorage.setItem(PROFILE_COMPLETE_STORAGE_KEY, 'true').catch(() => {});
              setCurrentScreen('home');
            }}
          />
        </ProfileWizardProvider>
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'home') {
    return (
      <>
        <HomeScreen
          firebaseToken={firebaseToken}
          onAuthExpired={handleAuthExpired}
          backendUserId={backendUserId}
          chatNotificationLaunch={chatNotificationLaunch}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  if (currentScreen === 'countryPicker') {
    return (
      <>
        <CountryPickerScreen
          onBack={() => setCurrentScreen('phoneNumber')}
          onSelectCountry={(country) => {
            setSelectedCountry(country);
          }}
        />
        <StatusBar style="dark" />
      </>
    );
  }

  return (
    <>
      <SyncFoundSplashScreen
        backgroundSource={require('./assets/splash_screen_bg_image.png')}
        logoSource={require('./assets/splash_screen_syncfound_image_logo_green.png')}
        wordmarkSource={require('./assets/syncfound_text_logo_white.png')}
        onCreateAccount={() => { setAuthMode('signup'); setCurrentScreen('phoneNumber'); }}
        onSignIn={() => { setAuthMode('signin'); setCurrentScreen('phoneNumber'); }}
      />
      <StatusBar style="light" />
    </>
  );
}
