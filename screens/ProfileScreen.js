import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useResponsiveMetrics } from "../utils/responsive";
import { BASE_URL_NO_API } from "../utils/Constants";
import { getMyProfile } from "../utils/backendAuth";
import { withPlatformFontStyles } from "../utils/typography";
import ProfileEditScreen from "./ProfileEditScreen";

const TAB_ITEMS = [
  { key: "invites", label: "Invites", icon: require("../assets/invites-inactive.png") },
  { key: "sync", label: "Sync", icon: require("../assets/sync-inactive.png") },
  { key: "chat", label: "Chat", icon: require("../assets/chat-inactive.png") },
  { key: "profile", label: "Profile", icon: require("../assets/profile-active.png") },
];

function resolveProfileImageUrl(imageUri) {
  const value = String(imageUri || "").trim();
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${BASE_URL_NO_API.replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
}

function resolveLinkedinUrl(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }

  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function ProfileAction({ icon, title, subtitle, onPress, styles }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.actionCard}
    >
      <Image source={icon} style={styles.actionIcon} resizeMode="contain" />
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen({
  firebaseToken = "",
  onAuthExpired,
  onNavigate,
}) {
  const metrics = useResponsiveMetrics();
  const insets = useSafeAreaInsets();
  const styles = createStyles(metrics, insets);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const loadProfile = async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setProfile(await getMyProfile(firebaseToken));
    } catch (error) {
      if (error?.status === 401) {
        onAuthExpired?.();
        return;
      }
      setErrorMessage(error?.message || "Could not load your profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, [firebaseToken]);

  const displayName = [profile?.firstName, profile?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ") || "Your Profile";
  const location = String(
    profile?.linkedinProfilePreview?.firstLocation || "",
  ).trim();
  const profileImageUrl = resolveProfileImageUrl(profile?.profileImageUri);
  const linkedinUrl = resolveLinkedinUrl(profile?.linkedinUrl);
  const dateOfBirth = String(
    profile?.dateOfBirth ||
      profile?.date_of_birth ||
      profile?.dob ||
      profile?.birth_date ||
      "",
  ).trim();
  const bioSummary = String(
    profile?.bio || profile?.title || "",
  ).trim();

  return (
    <View style={styles.screen}>
      {isEditingProfile ? (
        <ProfileEditScreen
          profile={profile}
          profileImageUrl={profileImageUrl}
          firebaseToken={firebaseToken}
          initialDateOfBirth={dateOfBirth}
          onClose={() => setIsEditingProfile(false)}
          onSave={() => setIsEditingProfile(false)}
        />
      ) : (
        <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          style={styles.settingsButton}
        >
          <Image
            source={require("../assets/profile_settings.png")}
            style={styles.settingsIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color="#2dbcc4" />
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={loadProfile} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.identityRow}>
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Image source={require("../assets/user.png")} style={styles.userIcon} />
              </View>
            )}
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                {linkedinUrl ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open LinkedIn profile"
                    onPress={() => Linking.openURL(linkedinUrl)}
                  >
                    <Image
                      source={require("../assets/linkedin.png")}
                      style={styles.linkedinIcon}
                    />
                  </Pressable>
                ) : null}
              </View>
              {!!location && <Text style={styles.locationText}>{location}</Text>}
              {Array.isArray(profile?.locationPreference) &&
              profile.locationPreference.length > 0 ? (
                <Text style={styles.preferenceHint}>
                  Open to relocate or remote work
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.badges}>
            <View style={styles.foundingBadge}>
              <Text style={styles.foundingText}>Open to founding</Text>
            </View>
            <View style={styles.newBadge}>
              <Text style={styles.newText}>New</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeText}>Active Today</Text>
            </View>
          </View>

          {!!bioSummary && (
            <Text style={styles.summary}>
              {`${bioSummary}`}
            </Text>
          )}

          <View style={styles.actions}>
            <ProfileAction
              icon={require("../assets/edit_profile.png")}
              title="Edit Profile"
              subtitle="How do you want your profile to be seen?"
              onPress={() => setIsEditingProfile(true)}
              styles={styles}
            />
            <ProfileAction
              icon={require("../assets/edit_preferences.png")}
              title="Edit Preference"
              subtitle="Who do you want to see as potential candidates?"
              styles={styles}
            />
          </View>

          <ImageBackground
            source={require("../assets/invites_cover.png")}
            imageStyle={styles.inviteImage}
            style={styles.inviteBanner}
          >
            {/* <View style={styles.inviteScrim} /> */}
            <Text style={styles.inviteTitle}>SyncFound</Text>
            <Text style={styles.inviteSubtitle}>Invite your friends to SyncFound</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Share.share({ message: "Join me on SyncFound." }).catch(() => {})
              }
              style={styles.inviteButton}
            >
              <Text style={styles.inviteButtonText}>Invite</Text>
            </Pressable>
          </ImageBackground>

          <Pressable
            accessibilityRole="button"
            onPress={() => onNavigate?.({ tab: "profile", openPaywall: true })}
            style={styles.membershipCard}
          >
            <Image
              source={require("../assets/elite-status.png")}
              style={styles.membershipIcon}
              resizeMode="contain"
            />
            <View style={styles.actionCopy}>
              <Text style={styles.actionTitle}>Memberships</Text>
              <Text style={styles.actionSubtitle}>
                Get up to 5x more recommendations and unlock premium features
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      )}
        </>
      )}

    </View>
  );
}

// Fix for duplicate bottom tab bar causing increased navigation bar height
function createStyles(metrics, insets) {
  const scale = metrics.moderateScale;
  return withPlatformFontStyles({
    screen: {
      flex: 1,
      paddingTop: insets.top,
      backgroundColor: "#f0eee5",
    },
    header: {
      minHeight: scale(68),
      paddingLeft: metrics.vw(7.5),
      paddingRight: metrics.vw(5.5),
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      color: "#050505",
      fontSize: scale(34),
      fontWeight: "700",
    },
    settingsButton: {
      width: scale(32),
      height: scale(42),
      alignItems: "center",
      justifyContent: "center",
    },
    settingsIcon: { width: scale(32), height: scale(32) },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: metrics.vw(5.5),
      paddingTop: scale(16),
      paddingBottom: scale(22),
    },
    identityRow: {
      minHeight: scale(112),
      flexDirection: "row",
      alignItems: "center",
      marginBottom: scale(24),
    },
    avatar: {
      width: scale(112),
      height: scale(112),
      borderRadius: scale(15),
      backgroundColor: "#d8d6ce",
    },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    userIcon: { width: "58%", height: "58%", tintColor: "#2dbcc4" },
    identityCopy: { flex: 1, marginLeft: scale(16), minWidth: 0 },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: scale(8),
      marginBottom: scale(4),
    },
    name: { flex: 1, color: "#080808", fontSize: scale(25), fontWeight: "500" },
    linkedinIcon: { width: scale(34), height: scale(34) },
    locationText: {
      color: "#7d879e",
      fontSize: scale(14),
      fontStyle: "italic",
      marginBottom: scale(4),
    },
    preferenceHint: {
      color: "#7d879e",
      fontSize: scale(14),
      fontStyle: "italic",
    },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: scale(10),
      marginBottom: scale(18),
    },
    foundingBadge: {
      minWidth: metrics.vw(45),
      minHeight: scale(42),
      paddingHorizontal: scale(17),
      borderRadius: scale(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#81879a",
    },
    foundingText: { color: "#fff", fontSize: scale(16) },
    newBadge: {
      minWidth: metrics.vw(24),
      minHeight: scale(42),
      paddingHorizontal: scale(16),
      borderWidth: scale(3),
      borderColor: "#2dbcc4",
      borderRadius: scale(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fff",
    },
    newText: { color: "#19aeb9", fontSize: scale(16) },
    activeBadge: {
      minWidth: metrics.vw(45),
      minHeight: scale(42),
      paddingHorizontal: scale(17),
      borderWidth: scale(3),
      borderColor: "#25793b",
      borderRadius: scale(11),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#fff",
    },
    activeText: { color: "#25793b", fontSize: scale(16) },
    summary: {
      color: "#111",
      fontSize: scale(14),
      fontWeight: "700",
      lineHeight: scale(21),
      marginHorizontal: scale(4),
      marginBottom: scale(28),
    },
    actions: { gap: scale(22), marginBottom: scale(30) },
    actionCard: {
      minHeight: scale(142),
      borderWidth: scale(1.5),
      borderColor: "#aaa9a7",
      borderRadius: scale(18),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(22),
      paddingVertical: scale(18),
    },
    actionIcon: { width: scale(58), height: scale(58), marginRight: scale(26) },
    actionCopy: { flex: 1, minWidth: 0 },
    actionTitle: {
      color: "#050505",
      fontSize: scale(23),
      fontWeight: "700",
      marginBottom: scale(4),
    },
    actionSubtitle: {
      color: "#7d879e",
      fontSize: scale(15),
      lineHeight: scale(22),
    },
    inviteBanner: {
      height: scale(194),
      borderRadius: scale(18),
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: scale(34),
      paddingHorizontal: scale(18),
    },
    inviteImage: { borderRadius: scale(18) },
    inviteScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.22)",
    },
    inviteTitle: { color: "#fff", fontSize: scale(30), fontWeight: "600" },
    inviteSubtitle: {
      color: "#fff",
      fontSize: scale(13),
      marginTop: scale(1),
      marginBottom: scale(14),
    },
    inviteButton: {
      width: metrics.vw(36),
      minHeight: scale(38),
      borderRadius: scale(24),
      backgroundColor: "#f4f4f8",
      alignItems: "center",
      justifyContent: "center",
    },
    inviteButtonText: { color: "#161616", fontSize: scale(17) },
    membershipCard: {
      minHeight: scale(142),
      borderWidth: scale(1.5),
      borderColor: "#aaa9a7",
      borderRadius: scale(18),
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: scale(22),
      paddingVertical: scale(18),
    },
    membershipIcon: { width: scale(58), height: scale(68), marginRight: scale(26) },
    stateWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: metrics.vw(8),
    },
    errorText: { color: "#a12222", textAlign: "center", fontSize: scale(15) },
    retryButton: {
      marginTop: scale(14),
      minHeight: scale(40),
      paddingHorizontal: scale(20),
      justifyContent: "center",
      borderRadius: scale(8),
      backgroundColor: "#2dbcc4",
    },
    retryButtonText: { color: "#fff", fontWeight: "600" },
    bottomTabBar: {
      minHeight: scale(82) + insets.bottom,
      paddingBottom: insets.bottom,
      paddingTop: scale(8),
      backgroundColor: "#fff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    tabItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: scale(2),
    },
    tabIcon: { width: scale(38), height: scale(38) },
    tabLabel: { color: "#aaa", fontSize: scale(16) },
    tabLabelActive: { color: "#12b7c2" },
  });
}