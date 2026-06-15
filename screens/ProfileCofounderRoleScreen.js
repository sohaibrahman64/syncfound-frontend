import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BASE_URL } from '../utils/Constants';
import { useResponsiveMetrics } from '../utils/responsive';
import { withPlatformFontStyles } from '../utils/typography';

const COFOUNDER_ROLES_ENDPOINT = '/api/v1/cofounder-roles';

const COFOUNDER_ROLE_ICON_MAP = {
  '../assets/cofounder.png': require('../assets/cofounder.png'),
  '../assets/cofounder_green.png': require('../assets/cofounder_green.png'),
  '../assets/team_member.png': require('../assets/team_member.png'),
  '../assets/team_member_green.png': require('../assets/team_member_green.png'),
  '../assets/investor.png': require('../assets/investor.png'),
  '../assets/investor_green.png': require('../assets/investor_green.png'),
  '../assets/mentor.png': require('../assets/mentor.png'),
  '../assets/mentor_green.png': require('../assets/mentor_green.png'),
  '../assets/group.png': require('../assets/group.png'),
  '../assets/group_green.png': require('../assets/group_green.png'),
  '../assets/user.png': require('../assets/user.png'),
  '../assets/user_green.png': require('../assets/user_green.png'),
  '../assets/investors.png': require('../assets/investors.png'),
  '../assets/investors_green.png': require('../assets/investors_green.png'),
  '../assets/teamwork.png': require('../assets/teamwork.png'),
  '../assets/teamwork_green.png': require('../assets/teamwork_green.png'),
  '../assets/internship.png': require('../assets/internship.png'),
  '../assets/internship_green.png': require('../assets/internship_green.png'),
};

function buildCofounderRolesEndpoint(base) {
  const normalized = String(base || '').replace(/\/$/, '');
  if (!normalized) {
    return `http://127.0.0.1:8000${COFOUNDER_ROLES_ENDPOINT}`;
  }

  if (normalized.endsWith('/api/v1')) {
    return `${normalized}/cofounder-roles`;
  }

  return `${normalized}${COFOUNDER_ROLES_ENDPOINT}`;
}

function resolveCofounderRoleIcon(iconPath) {
  return COFOUNDER_ROLE_ICON_MAP[String(iconPath || '').trim()] || null;
}

function toCofounderRoleModel(item) {
  const roleName = String(item?.role_name || item?.roleName || item?.label || '').trim();

  return {
    value: item?.id ?? roleName,
    roleName,
    equityOffer: String(item?.equity_offer || item?.['equity-offer'] || item?.equityOffer || '').trim(),
    description: String(item?.description || '').trim(),
    icon: resolveCofounderRoleIcon(item?.icon),
    selectedIcon: resolveCofounderRoleIcon(item?.selected_icon || item?.selectedIcon),
  };
}

function CofounderRoleCard({ option, selected, onPress, styles }) {
  const iconSource = selected ? (option.selectedIcon || option.icon) : option.icon;

  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
      <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{option.roleName}</Text>
      {option.equityOffer ? (
        <View style={[styles.equityPill, selected && styles.equityPillSelected]}>
          <Text style={[styles.equityPillText, selected && styles.equityPillTextSelected]}>
            {option.equityOffer}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardBodyRow}>
        <Image
          key={`${option.value}-${selected ? 'selected' : 'default'}`}
          source={iconSource}
          style={styles.cardIcon}
          resizeMode="contain"
        />
        <Text style={[styles.cardDescription, selected && styles.cardDescriptionSelected]}>
          {option.description}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProfileCofounderRoleScreen({
  onBack,
  onContinue,
  initialCofounderRole = '',
}) {
  const metrics = useResponsiveMetrics();
  const styles = useMemo(() => createStyles(metrics), [metrics]);
  const [cofounderRole, setCofounderRole] = useState(initialCofounderRole);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const canContinue = Boolean(cofounderRole);

  React.useEffect(() => {
    let isMounted = true;

    const fetchCofounderRoles = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const endpoint = buildCofounderRolesEndpoint(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load cofounder roles: ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        const mapped = list
          .map(toCofounderRoleModel)
          .filter((item) => Boolean(item?.roleName) && Boolean(item?.icon));

        if (isMounted) {
          const selectedOption = mapped.find((item) => (
            item.value === initialCofounderRole || item.roleName === initialCofounderRole
          ));
          setRoleOptions(mapped);
          if (selectedOption) {
            setCofounderRole(selectedOption.value);
          }
        }
      } catch {
        if (isMounted) {
          setErrorMessage('Could not load cofounder roles. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCofounderRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAccent} />

      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={onBack} hitSlop={10}>
          <Image source={require('../assets/back_arrow.png')} style={styles.backArrowImage} />
        </Pressable>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subheading}>Let's build your founder profile</Text>
          <Text style={styles.heading}>Cofounder's Role</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#2cbbc1" />
            </View>
          ) : errorMessage ? (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          ) : (
            roleOptions.map((option) => (
              <CofounderRoleCard
                key={option.value}
                option={option}
                selected={cofounderRole === option.value}
                onPress={() => setCofounderRole(option.value)}
                styles={styles}
              />
            ))
          )}
        </ScrollView>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => onContinue?.({ cofounderRole })}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue
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
    topAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: vw(55),
      height: vh(1.2),
      backgroundColor: '#26c6d0',
      zIndex: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: vw(5),
      paddingTop: isShortScreen ? vh(3.2) : vh(4.2),
      paddingBottom: vh(3.2),
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: vh(0.7),
      paddingHorizontal: vw(1),
      marginBottom: isShortScreen ? vh(2.5) : vh(3.2),
    },
    backArrowImage: {
      width: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      height: responsiveFont(isNarrowScreen ? 29 : 33, 24, 38),
      resizeMode: 'contain',
      tintColor: '#7d8498',
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: vh(2),
    },
    loadingWrap: {
      minHeight: vh(28),
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorMessage: {
      color: '#6b6b6b',
      fontSize: responsiveFont(16, 14, 18),
      lineHeight: responsiveFont(22, 18, 24),
      textAlign: 'center',
      marginTop: vh(3),
    },
    subheading: {
      color: '#616161',
      fontSize: responsiveFont(isShortScreen ? 18 : 20, 16, 22),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
    },
    heading: {
      color: '#0f0f0f',
      fontSize: responsiveFont(isShortScreen ? 32 : 36, 28, 42),
      lineHeight: responsiveFont(isShortScreen ? 38 : 44, 33, 50),
      fontWeight: '700',
      marginTop: vh(2.8),
      marginBottom: vh(2.8),
    },
    card: {
      borderWidth: 2,
      borderColor: '#d6d2cd',
      borderRadius: moderateScale(20),
      backgroundColor: '#fbfbfb',
      paddingHorizontal: vw(5),
      paddingTop: vh(1.6),
      paddingBottom: vh(2),
      marginBottom: vh(2.6),
    },
    cardSelected: {
      borderColor: '#2cbbc1',
      backgroundColor: '#f3fbfc',
    },
    cardTitle: {
      color: '#3f3f3f',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 18, 24),
      lineHeight: responsiveFont(isShortScreen ? 28 : 30, 22, 32),
      fontWeight: '700',
      textAlign: 'center',
    },
    cardTitleSelected: {
      color: '#2cbbc1',
    },
    equityPill: {
      alignSelf: 'center',
      marginTop: vh(0.8),
      marginBottom: vh(1.3),
      backgroundColor: '#e9e4dc',
      borderRadius: 999,
      paddingHorizontal: vw(4),
      minHeight: moderateScale(34),
      justifyContent: 'center',
    },
    equityPillSelected: {
      backgroundColor: '#dff2f4',
    },
    equityPillText: {
      color: '#7a8091',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(18, 15, 20),
      fontWeight: '400',
      textAlign: 'center',
    },
    equityPillTextSelected: {
      color: '#2cbbc1',
    },
    cardBodyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardIcon: {
      width: moderateScale(isShortScreen ? 36 : 40),
      height: moderateScale(isShortScreen ? 36 : 40),
      flexShrink: 0,
      marginRight: vw(3),
    },
    cardDescription: {
      flex: 1,
      color: '#3f3f3f',
      fontSize: responsiveFont(isShortScreen ? 14 : 15, 13, 16),
      lineHeight: responsiveFont(isShortScreen ? 22 : 24, 18, 26),
      fontWeight: '400',
      textAlign: 'center',
      paddingRight: vw(2),
    },
    cardDescriptionSelected: {
      color: '#2cbbc1',
    },
    continueButton: {
      width: isNarrowScreen ? '86%' : '84%',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: '#31c6d5',
      minHeight: moderateScale(isShortScreen ? 52 : 58),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: vw(4),
      marginTop: vh(1.4),
      marginBottom: vh(0.6),
    },
    continueButtonDisabled: {
      backgroundColor: '#cdcdcf',
    },
    continueButtonText: {
      color: '#ffffff',
      fontSize: responsiveFont(isShortScreen ? 20 : 22, 16, 24),
      lineHeight: responsiveFont(isShortScreen ? 24 : 26, 20, 28),
      fontWeight: '400',
      textAlign: 'center',
    },
    continueButtonTextDisabled: {
      color: '#707c96',
    },
  }));
}