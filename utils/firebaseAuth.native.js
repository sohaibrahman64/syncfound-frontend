// Native implementation (Android / iOS) — Metro picks this file over firebaseAuth.js
// on native platforms because of the .native.js extension.
import auth from '@react-native-firebase/auth';

/**
 * Send an OTP to the given phone number using @react-native-firebase/auth.
 * Returns the native confirmation object which already has a `.confirm(code)` method.
 * @param {string} phoneNumber  E.164 format, e.g. "+14155552671"
 */
export async function sendOtp(phoneNumber) {
  return auth().signInWithPhoneNumber(phoneNumber);
}

export async function getCurrentFirebaseIdToken(forceRefresh = false) {
  const user = auth().currentUser;

  if (!user) {
    const error = new Error('No active Firebase user session.');
    error.code = 'no_current_user';
    throw error;
  }

  return user.getIdToken(Boolean(forceRefresh));
}

export async function signOutFirebaseSession() {
  await auth().signOut();
}
