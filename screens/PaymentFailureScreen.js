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

function resolveTier(payload) {
  return String(payload?.tier || payload?.plan_tier || '').trim().toLowerCase();
}

function resolveFriendlyFailureMessage({ status, errorCode, errorMessage }) {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const normalizedCode = String(errorCode || '').trim().toUpperCase();
  const normalizedMessage = String(errorMessage || '').trim();

  if (normalizedStatus === 'cancelled') {
    return 'Payment was cancelled before completion. You can safely try again.';
  }

  if (normalizedCode === 'TXN_CANCELLED' || normalizedCode === 'CANCELLED') {
    return 'The payment was cancelled. Please try again when ready.';
  }

  if (normalizedCode === 'PAYMENT_DECLINED' || normalizedCode === 'BANK_DECLINED') {
    return 'Your payment was declined by the bank or provider. Please use another method and try again.';
  }

  if (normalizedMessage) {
    return normalizedMessage;
  }

  return 'Payment was not completed. Please try checkout again from plans.';
}

export default function PaymentFailureScreen({
  firebaseToken = '',
  callbackParams = null,
  onContinue,
  onTryAgain,
  onAuthExpired,
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);

  const [phase, setPhase] = useState('checking');
  const [message, setMessage] = useState('Checking account entitlement before finalizing status...');

  const checkoutSessionId = String(callbackParams?.checkoutSessionId || '').trim();
  const txnid = String(callbackParams?.txnid || '').trim();
  const status = String(callbackParams?.status || '').trim().toLowerCase();
  const errorCode = String(callbackParams?.errorCode || '').trim();
  const errorMessage = String(callbackParams?.errorMessage || '').trim();
  const mihpayid = String(callbackParams?.mihpayid || '').trim();
  const mode = String(callbackParams?.mode || '').trim();
  const amount = String(callbackParams?.amount || '').trim();
  const productinfo = String(callbackParams?.productinfo || '').trim();
  const email = String(callbackParams?.email || '').trim();
  const phone = String(callbackParams?.phone || '').trim();

  useEffect(() => {
    let isMounted = true;

    const runSingleCheck = async () => {
      try {
        const token = await getCurrentFirebaseIdToken(false).catch(() => firebaseToken);
        const payload = await getPayUCheckoutStatus({
          firebaseToken: token,
          checkoutSessionId,
        });

        if (!isMounted) {
          return;
        }

        if (resolveTier(payload) === 'premium') {
          setPhase('premium');
          setMessage('Premium is already active. You can continue to the app.');
          return;
        }
      } catch (error) {
        const isAuthError =
          error?.status === 401 ||
          /invalid firebase token|unauthori[sz]ed|token/i.test(String(error?.message || ''));

        if (isAuthError) {
          onAuthExpired?.();
          return;
        }
      }

      if (!isMounted) {
        return;
      }

      setPhase('failed');
      setMessage(resolveFriendlyFailureMessage({
        status,
        errorCode,
        errorMessage,
      }));
    };

    void runSingleCheck();

    return () => {
      isMounted = false;
    };
  }, [checkoutSessionId, errorCode, errorMessage, firebaseToken, onAuthExpired, status]);

  const statusChipStyle = phase === 'premium' ? styles.statusChipPremium : styles.statusChipFailed;

  return (
    <LinearGradient
      colors={['#fff7f5', '#fdf2ef', '#f8ece8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerWrap}>
          <View style={styles.heroIconWrap}>
            <Image source={require('../assets/payment_failure.png')} style={styles.heroIcon} resizeMode="contain" />
          </View>

          <Text style={styles.title}>Payment Not Completed</Text>
          <Text style={styles.subtitle}>You can retry safely from plans</Text>

          <View style={[styles.statusChip, statusChipStyle]}>
            {phase === 'checking' ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text style={styles.statusChipText}>
              {phase === 'premium' ? 'Premium Active' : phase === 'checking' ? 'Checking Entitlement' : 'Checkout Failed'}
            </Text>
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
              <Text style={styles.summaryValue}>{formatPaymentStatusLabel(status || 'failed')}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Error Code</Text>
              <Text style={styles.summaryValue}>{errorCode || 'Unavailable'}</Text>
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

          <Pressable style={styles.primaryButton} onPress={() => onTryAgain?.()}>
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => onContinue?.()}>
            <Text style={styles.secondaryButtonText}>Back to Plans</Text>
          </Pressable>

          <Text style={styles.supportText}>
            If payment was deducted but status is failed, contact support with the session id above.
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
      backgroundColor: '#fdf2ef',
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
      backgroundColor: '#f5ddd6',
      marginBottom: vh(1.5),
    },
    heroIcon: {
      width: moderateScale(isShort ? 60 : 72),
      height: moderateScale(isShort ? 60 : 72),
    },
    title: {
      color: '#592e27',
      fontSize: responsiveFont(isShort ? 26 : 30, 22, 34),
      lineHeight: responsiveFont(isShort ? 30 : 34, 24, 38),
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      marginTop: vh(0.5),
      color: '#7a4a40',
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
    statusChipPremium: {
      backgroundColor: '#0f8b5f',
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
    summaryCard: {
      width: '100%',
      borderRadius: moderateScale(16),
      backgroundColor: '#ffffff',
      borderWidth: 1,
      borderColor: '#efdbd4',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(14),
      shadowColor: '#4f2016',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      marginBottom: vh(1.8),
    },
    summaryTitle: {
      color: '#5a3128',
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
      color: '#8f6155',
      fontSize: responsiveFont(13, 12, 15),
      lineHeight: responsiveFont(18, 16, 20),
      fontWeight: '500',
      flexShrink: 0,
    },
    summaryValue: {
      color: '#542b21',
      fontSize: responsiveFont(13, 12, 15),
      lineHeight: responsiveFont(18, 16, 20),
      fontWeight: '600',
      textAlign: 'right',
      flex: 1,
    },
    message: {
      color: '#6d4036',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(20, 18, 23),
      textAlign: 'center',
      marginBottom: vh(1.8),
    },
    primaryButton: {
      width: '100%',
      minHeight: moderateScale(48),
      borderRadius: 999,
      backgroundColor: '#b55237',
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
      borderColor: '#e7c6bd',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: vh(1.3),
    },
    secondaryButtonText: {
      color: '#6a3a2f',
      fontSize: responsiveFont(15, 13, 17),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '600',
    },
    supportText: {
      color: '#8e6258',
      fontSize: responsiveFont(12, 11, 14),
      lineHeight: responsiveFont(17, 15, 20),
      textAlign: 'center',
      maxWidth: 360,
    },
  }));
}
