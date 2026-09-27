import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getPayUCheckoutStatus } from '../utils/backendAuth';
import { getCurrentFirebaseIdToken } from '../utils/firebaseAuth';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';
import { formatPaymentStatusLabel } from '../utils/paymentCallback';

function delayMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveTier(payload) {
  return String(payload?.tier || payload?.plan_tier || '').trim().toLowerCase();
}

function resolveRetryDelayMs(attemptIndex) {
  const scheduleMs = [900, 1600, 2600, 3800, 5200, 7000, 9000];
  return scheduleMs[Math.min(attemptIndex, scheduleMs.length - 1)];
}

export default function PaymentSuccessScreen({
  firebaseToken = '',
  callbackParams = null,
  onContinue,
  onTryAgain,
  onAuthExpired,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const [phase, setPhase] = useState('verifying');
  const [message, setMessage] = useState('Verifying your payment entitlement...');
  const [isVerifying, setIsVerifying] = useState(true);

  const checkoutSessionId = String(callbackParams?.checkoutSessionId || '').trim();
  const txnid = String(callbackParams?.txnid || '').trim();
  const status = String(callbackParams?.status || '').trim().toLowerCase();
  const mihpayid = String(callbackParams?.mihpayid || '').trim();
  const mode = String(callbackParams?.mode || '').trim();
  const amount = String(callbackParams?.amount || '').trim();
  const productinfo = String(callbackParams?.productinfo || '').trim();
  const email = String(callbackParams?.email || '').trim();
  const phone = String(callbackParams?.phone || '').trim();

  const verifyEntitlements = async ({ maxAttempts = 6 } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
        const payload = await getPayUCheckoutStatus({
          firebaseToken: token,
          checkoutSessionId,
        });

        if (resolveTier(payload) === 'premium') {
          return { isPremium: true };
        }
      } catch (error) {
        const isAuthError =
          error?.status === 401 ||
          /invalid firebase token|unauthori[sz]ed|token/i.test(String(error?.message || ''));

        if (isAuthError) {
          onAuthExpired?.();
          return { aborted: true, isPremium: false };
        }
      }

      if (attempt < maxAttempts - 1) {
        await delayMs(resolveRetryDelayMs(attempt));
      }
    }

    return { isPremium: false };
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsVerifying(true);
      setPhase('verifying');
      setMessage('Verifying your payment entitlement...');

      const isPendingStatus = status === 'pending' || status === 'processing';
      const result = await verifyEntitlements({
        maxAttempts: isPendingStatus ? 7 : 6,
      });

      if (!isMounted || result?.aborted) {
        return;
      }

      if (result?.isPremium) {
        setPhase('unlocked');
        setMessage('Payment verified. Premium access is active now.');
      } else if (isPendingStatus || status === 'success') {
        setPhase('pending');
        setMessage('Payment is still syncing with your account. Please wait a moment or return to plans and retry verification.');
      } else {
        setPhase('failed');
        setMessage('We could not confirm premium access from backend entitlement yet. Please retry from plans.');
      }

      setIsVerifying(false);
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [checkoutSessionId, firebaseToken, onAuthExpired, status]);

  const statusChipStyle =
    phase === 'unlocked'
      ? styles.statusChipSuccess
      : phase === 'pending' || phase === 'verifying'
        ? styles.statusChipPending
        : styles.statusChipFailed;

  const statusText = phase === 'unlocked'
    ? 'Premium Active'
    : phase === 'pending' || phase === 'verifying'
      ? 'Pending Verification'
      : 'Verification Needed';

  return (
    <LinearGradient
      colors={['#f7fcff', '#eef8f3', '#e5f5ef']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <View style={styles.heroIconWrap}>
            <Image source={require('../assets/payment_success.png')} style={styles.heroIcon} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Payment Received</Text>
          <Text style={styles.subtitle}>Finalizing your premium access</Text>

          <View style={[styles.statusChip, statusChipStyle]}>
            {isVerifying ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            {!isVerifying ? (
              <Image source={require('../assets/completed_status.png')} style={styles.statusChipIcon} resizeMode="contain" />
            ) : null}
            <Text style={styles.statusChipText}>{statusText}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Transaction Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Checkout Session</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{checkoutSessionId || 'Unavailable'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Transaction Id</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{txnid || 'Unavailable'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Gateway Status</Text>
              <Text style={styles.summaryValue}>{formatPaymentStatusLabel(status || 'pending')}</Text>
            </View>

            {!!mihpayid && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>PayU Payment Id</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{mihpayid}</Text>
              </View>
            )}

            {!!mode && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Mode</Text>
                <Text style={styles.summaryValue}>{mode}</Text>
              </View>
            )}

            {!!amount && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>{amount}</Text>
              </View>
            )}

            {!!productinfo && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Product</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{productinfo}</Text>
              </View>
            )}

            {!!email && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Email</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{email}</Text>
              </View>
            )}

            {!!phone && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phone</Text>
                <Text style={styles.summaryValue}>{phone}</Text>
              </View>
            )}
          </View>

          <Text style={styles.message}>{message}</Text>

          <Pressable style={styles.primaryButton} onPress={() => onContinue?.()}>
            <Text style={styles.primaryButtonText}>Continue to App</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => onTryAgain?.()}>
            <Text style={styles.secondaryButtonText}>Back to Plans</Text>
          </Pressable>

          <Text style={styles.supportText}>
            If this takes longer than expected, retry checkout or contact support.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function createStyles({ width, height, vw, vh, moderateScale, responsiveFont }) {
  const isNarrow = width < 360;
  const isShort = height < 760;

  return StyleSheet.create(withPlatformFontStyles({
    container: {
      flex: 1,
      backgroundColor: '#eef8f3',
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: isNarrow ? vw(5.5) : vw(6.2),
      paddingTop: isShort ? vh(1.2) : vh(2.2),
      paddingBottom: isShort ? vh(2.2) : vh(3.5),
    },
    centerWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIconWrap: {
      width: moderateScale(isShort ? 92 : 108),
      height: moderateScale(isShort ? 92 : 108),
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#d7f0e6',
      marginBottom: vh(1.5),
    },
    heroIcon: {
      width: moderateScale(isShort ? 60 : 72),
      height: moderateScale(isShort ? 60 : 72),
    },
    title: {
      color: '#123b2f',
      fontSize: responsiveFont(isShort ? 26 : 30, 22, 34),
      lineHeight: responsiveFont(isShort ? 30 : 34, 24, 38),
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      marginTop: vh(0.5),
      color: '#2f6252',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(20, 18, 22),
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: vh(1.4),
    },
    statusChip: {
      minHeight: moderateScale(38),
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: moderateScale(16),
      marginBottom: vh(1.8),
    },
    statusChipSuccess: {
      backgroundColor: '#0f8b5f',
    },
    statusChipPending: {
      backgroundColor: '#658d22',
    },
    statusChipFailed: {
      backgroundColor: '#b24b2f',
    },
    statusChipText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 16, 20),
      fontWeight: '600',
    },
    statusChipIcon: {
      width: moderateScale(16),
      height: moderateScale(16),
    },
    summaryCard: {
      width: '100%',
      borderRadius: moderateScale(16),
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#d6e8df',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(14),
      shadowColor: '#1a3b2f',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      marginBottom: vh(1.8),
    },
    summaryTitle: {
      color: '#1f4638',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(21, 18, 24),
      fontWeight: '700',
      marginBottom: vh(0.8),
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: vh(0.55),
    },
    summaryLabel: {
      color: '#547366',
      fontSize: responsiveFont(13, 12, 15),
      lineHeight: responsiveFont(18, 16, 20),
      fontWeight: '500',
      flexShrink: 0,
    },
    summaryValue: {
      color: '#234438',
      fontSize: responsiveFont(13, 12, 15),
      lineHeight: responsiveFont(18, 16, 20),
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
    },
    message: {
      color: '#2d5144',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 18, 23),
      textAlign: 'center',
      marginBottom: vh(1.8),
    },
    primaryButton: {
      width: '100%',
      minHeight: moderateScale(48),
      borderRadius: 999,
      backgroundColor: '#179468',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: vh(1.2),
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 19, 24),
      fontWeight: '700',
    },
    secondaryButton: {
      width: '100%',
      minHeight: moderateScale(46),
      borderRadius: 999,
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#b8d8c8',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: vh(1.3),
    },
    secondaryButtonText: {
      color: '#205746',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '600',
    },
    supportText: {
      color: '#5e7f73',
      fontSize: responsiveFont(12, 11, 14),
      lineHeight: responsiveFont(17, 15, 20),
      textAlign: 'center',
      maxWidth: 360,
    },
  }));
}
