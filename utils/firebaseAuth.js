// Web implementation — used by Expo Web (webpack/Metro web target).
// @react-native-firebase/auth is NOT imported here so it never enters the web bundle.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, signOut } from 'firebase/auth';
import firebaseWebConfig from './firebaseWebConfig';

let webAuth = null;
let recaptchaVerifier = null;

function getWebAuth() {
  if (!webAuth) {
    const app = getApps().length === 0 ? initializeApp(firebaseWebConfig) : getApp();
    webAuth = getAuth(app);
  }
  return webAuth;
}

/**
 * Send an OTP to the given phone number.
 * Returns a confirmation object with a `.confirm(code)` method — same API as the native side.
 * @param {string} phoneNumber  E.164 format, e.g. "+14155552671"
 * @param {string} [containerId="recaptcha-container"]  DOM id of the invisible reCAPTCHA div
 */
export async function sendOtp(phoneNumber, containerId = 'recaptcha-container') {
  const auth = getWebAuth();

  // RecaptchaVerifier can only be used once — clear the previous one before creating a new one.
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: 'invisible' });

  const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);

  // Normalise shape to match the native confirmation object.
  return {
    confirm: (code) => result.confirm(code),
    verificationId: result.verificationId,
  };
}

export async function getCurrentFirebaseIdToken(forceRefresh = false) {
  const auth = getWebAuth();
  const user = auth.currentUser;

  if (!user) {
    const error = new Error('No active Firebase user session.');
    error.code = 'no_current_user';
    throw error;
  }

  return user.getIdToken(Boolean(forceRefresh));
}

export async function signOutFirebaseSession() {
  const auth = getWebAuth();
  await signOut(auth);
}
