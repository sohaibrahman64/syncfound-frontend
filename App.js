import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { sendOtp } from './utils/firebaseAuth';
import { sendFirebaseIdTokenToBackend, updateUserEmailInBackend } from './utils/backendAuth';
import SyncFoundSplashScreen from './screens/SyncFoundSplashScreen';
import PhoneNumberScreen from './screens/PhoneNumberScreen';
import CountryPickerScreen from './screens/CountryPickerScreen';
import OtpScreen from './screens/OtpScreen';
import EmailScreen from './screens/EmailScreen';
import CofoundersIntroScreen from './screens/CofoundersIntroScreen';
import ProfileWizardScreen from './screens/ProfileWizardScreen';
import { ProfileWizardProvider } from './context/ProfileWizardContext';
import { getPlatformBaseFontFamily } from './utils/typography';

let hasAppliedGlobalPlatformFontDefaults = false;

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

  // Resume wizard if the user had an in-progress profile and comes back to the app
  useEffect(() => {
    if (!fontsLoaded) return;

    AsyncStorage.getItem('@syncfound/profile_wizard')
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw);
          // Only auto-resume if they had actually started (stepIndex > 0 or draft not empty)
          const hasProgress =
            (saved.stepIndex != null && saved.stepIndex > 0) ||
            (saved.draft && Object.keys(saved.draft).length > 0);
          if (hasProgress) {
            setFirebaseToken(saved.firebaseToken ?? '');
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
              try {
                const backendResponse = await sendFirebaseIdTokenToBackend(idToken, verifiedPhoneNumber || otpPhoneDisplay);
                console.log('FastAPI token handoff success:', backendResponse);
                console.log('Verified phone:', verifiedPhoneNumber);
                setVerifiedPhoneNumber(verifiedPhoneNumber || otpPhoneDisplay);
                setFirebaseToken(idToken);
                setBackendUserId(backendResponse?.user?.id ?? null);
                setEmailUpdateError('');
                setCurrentScreen('email');
              } catch (error) {
                console.error('Failed to send Firebase idToken to backend:', error);
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
            onComplete={() => {
              // TODO: navigate to the main app home screen once it exists
              console.log('Profile wizard complete — navigate to home');
            }}
          />
        </ProfileWizardProvider>
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
        onCreateAccount={() => setCurrentScreen('phoneNumber')}
        onSignIn={() => {}}
      />
      <StatusBar style="light" />
    </>
  );
}
