import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { withPlatformFontStyles } from '../utils/typography';

const TAB_ITEMS = [
  {
    key: 'invites',
    label: 'Invites',
    inactiveIcon: require('../assets/invites-inactive.png'),
    activeIcon: require('../assets/invites-active.png'),
  },
  {
    key: 'sync',
    label: 'Sync',
    inactiveIcon: require('../assets/sync-inactive.png'),
    activeIcon: require('../assets/sync-active.png'),
  },
  {
    key: 'chat',
    label: 'Chat',
    inactiveIcon: require('../assets/chat-inactive.png'),
    activeIcon: require('../assets/chat-active.png'),
  },
  {
    key: 'profile',
    label: 'Profile',
    inactiveIcon: require('../assets/profile-inactive.png'),
    activeIcon: require('../assets/profile-active.png'),
  },
];

export default function BottomNavigation({
  activeTab,
  onNavigate,
  metrics,
  bottomInset = 0,
  isOverlay = true,
  inviteUnreadCount = 0,
  chatUnreadCount = 0,
}) {
  const styles = useMemo(
    () => createStyles(metrics, bottomInset),
    [metrics, bottomInset],
  );

  return (
    <View
      style={[
        styles.bottomTabBar,
        isOverlay ? styles.bottomTabBarOverlay : styles.bottomTabBarFlow,
      ]}
    >
      {TAB_ITEMS.map((item) => {
        const isActive = item.key === activeTab;
        const unreadCount = item.key === 'invites'
          ? inviteUnreadCount
          : item.key === 'chat'
            ? chatUnreadCount
            : 0;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => onNavigate?.(item.key)}
            style={styles.navItem}
          >
            <View style={styles.navIconWrap}>
              <Image
                source={isActive ? item.activeIcon : item.inactiveIcon}
                style={styles.navIcon}
                resizeMode="contain"
              />
              {unreadCount > 0 ? (
                <View style={styles.navBadgeWrap}>
                  <Text style={styles.navBadgeText}>
                    {unreadCount > 99 ? '99+' : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(metrics, bottomInset) {
  const { vw, vh, moderateScale, responsiveFont } = metrics;

  return StyleSheet.create(withPlatformFontStyles({
    bottomTabBar: {
      height: moderateScale(66) + bottomInset,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e0e0e0',
      paddingTop: vh(1),
      paddingBottom: bottomInset,
      paddingHorizontal: vw(2),
      backgroundColor: '#f4f4f4',
      zIndex: 4,
      elevation: 4,
    },
    bottomTabBarOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    bottomTabBarFlow: {
      alignSelf: 'stretch',
    },
    navItem: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIconWrap: {
      width: moderateScale(32),
      height: moderateScale(32),
      alignItems: 'center',
      justifyContent: 'center',
    },
    navIcon: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    navBadgeWrap: {
      position: 'absolute',
      top: -moderateScale(4),
      right: -moderateScale(10),
      minWidth: moderateScale(18),
      height: moderateScale(18),
      borderRadius: 999,
      backgroundColor: '#2cbbc1',
      paddingHorizontal: moderateScale(4),
      alignItems: 'center',
      justifyContent: 'center',
    },
    navBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(10, 9, 11),
      lineHeight: responsiveFont(12, 11, 13),
      fontWeight: '600',
    },
    navLabel: {
      marginTop: vh(0.2),
      color: '#9e9e9e',
      fontSize: responsiveFont(15, 12, 16),
      lineHeight: responsiveFont(19, 15, 20),
      fontWeight: '400',
    },
    navLabelActive: {
      color: '#2eb8c6',
      fontWeight: '500',
    },
  }));
}
