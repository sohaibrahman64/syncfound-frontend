import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { withPlatformFontStyles } from '../../utils/typography';

function formatText(value) {
  return String(value ?? '').trim();
}

function getItemTitle(item = {}) {
  return formatText(item.title || item.position || item.school || item.institution);
}

function getItemSubtitle(item = {}) {
  return formatText(
    item.company || item.company_name || item.organization || item.degree_name || item.degree,
  );
}

function getItemMeta(item = {}) {
  return formatText(item.dates || item.duration || item.date_range || item.dates_text);
}

function getItemDescription(item = {}) {
  return formatText(item.description || item.field_of_study || item.field || item.major);
}

function getPromptTitle(prompt = {}) {
  return formatText(prompt.title || prompt.prompt || prompt.question || prompt.label);
}

function getPromptAnswer(prompt = {}) {
  return formatText(prompt.answer || prompt.response || prompt.content || prompt.answer_text);
}

export default function ProfilePreview({
  metrics,
  displayName,
  photoUri,
  linkedinUrl,
  locationText,
  locationPreferenceText,
  badges = [],
  summary,
  ideaTitle = "I'm exploring",
  idea,
  founderTitle = 'As a founder, I am...',
  founderRows = [],
  industries = [],
  startupExperiences = [],
  workPreferences = [],
  prompts = [],
  motivation,
  superpower,
  experiences = [],
  experienceSummary,
  education = [],
}) {
  const styles = createStyles(metrics);
  const normalizedLinkedinUrl = formatText(linkedinUrl);

  return (
    <View style={styles.previewContent}>
      <View style={styles.profileHero}>
        <View style={styles.profileTopRow}>
          <Image
            source={photoUri ? { uri: photoUri } : require('../../assets/user.png')}
            style={styles.profileAvatar}
            resizeMode="cover"
          />
          <View style={styles.profileTextWrap}>
            <View style={styles.profileNameRow}>
              <Text style={styles.profileName} numberOfLines={1}>
                {formatText(displayName) || 'Your Profile'}
              </Text>
              {normalizedLinkedinUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open LinkedIn profile"
                  style={styles.profileLinkedinButton}
                  onPress={() => {
                    const url = /^https?:\/\//i.test(normalizedLinkedinUrl)
                      ? normalizedLinkedinUrl
                      : `https://${normalizedLinkedinUrl}`;
                    void Linking.openURL(url).catch(() => {});
                  }}
                >
                  <Image
                    source={require('../../assets/linkedin.png')}
                    style={styles.profileLinkedinIcon}
                    resizeMode="contain"
                  />
                </Pressable>
              ) : null}
            </View>
            {!!formatText(locationText) ? (
              <View style={styles.profileMetaRow}>
                <Text style={styles.locationGlyph}>⌖</Text>
                <Text style={styles.profileLocation} numberOfLines={2}>
                  {formatText(locationText)}
                </Text>
              </View>
            ) : null}
            {!!formatText(locationPreferenceText) ? (
              <View style={styles.profileMetaRow}>
                <Image
                  source={require('../../assets/teamwork.png')}
                  style={styles.profileMetaIcon}
                  resizeMode="contain"
                />
                <Text style={styles.profileLocation} numberOfLines={2}>
                  {formatText(locationPreferenceText)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {badges.length > 0 ? (
          <View style={styles.profileBadges}>
            {badges.map((badge) => (
              <View key={badge.label} style={[styles.statusBadge, styles[badge.style]]}>
                <Text style={[styles.statusBadgeText, styles[badge.textStyle]]}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!!formatText(summary) ? <Text style={styles.profileBio}>{formatText(summary)}</Text> : null}
      </View>

      {!!formatText(idea) ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>{formatText(ideaTitle)}</Text>
          <Text style={styles.profileIdea}>{formatText(idea)}</Text>
        </View>
      ) : null}

      {founderRows.length > 0 ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>{founderTitle}</Text>
          {founderRows.map((row, index) => (
            <View
              key={`${row.value}-${index}`}
              style={[
                styles.profileDetailRow,
                index === founderRows.length - 1 && styles.profileDetailRowLast,
              ]}
            >
              {row.icon ? (
                <Image source={row.icon} style={styles.profileDetailIcon} resizeMode="contain" />
              ) : null}
              <Text style={styles.profileSectionBody}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {industries.length > 0 ? (
        <BadgeSection title="Industries & interests" values={industries} styles={styles} />
      ) : null}

      {startupExperiences.length > 0 ? (
        <BadgeSection title="Startup experience" values={startupExperiences} styles={styles} />
      ) : null}

      {workPreferences.length > 0 ? (
        <BadgeSection title="Work preferences" values={workPreferences} styles={styles} />
      ) : null}

      {prompts.map((prompt, index) => {
        const title = getPromptTitle(prompt);
        const answer = getPromptAnswer(prompt);
        if (!title && !answer) return null;

        return (
          <View key={`${title || 'prompt'}-${index}`} style={styles.profileSectionCard}>
            {!!title ? <Text style={styles.profileSectionTitle}>{title}</Text> : null}
            {!!answer ? <Text style={styles.profileSectionBody}>{answer}</Text> : null}
          </View>
        );
      })}

      {!!formatText(motivation) ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>My motivation to build a startup</Text>
          <Text style={styles.profileSectionBody}>{formatText(motivation)}</Text>
        </View>
      ) : null}

      {!!formatText(superpower) ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>My strength / superpower</Text>
          <Text style={styles.profileSectionBody}>{formatText(superpower)}</Text>
        </View>
      ) : null}

      {(experiences.length > 0 || formatText(experienceSummary)) ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>Experiences</Text>
          {experiences.length > 0 ? experiences.map((item, index) => (
            <HistoryRow
              key={`${getItemTitle(item)}-${getItemSubtitle(item)}-${index}`}
              item={item}
              icon={require('../../assets/briefcase.png')}
              styles={styles}
            />
          )) : <Text style={styles.profileSectionBody}>{formatText(experienceSummary)}</Text>}
        </View>
      ) : null}

      {education.length > 0 ? (
        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>Education</Text>
          {education.map((item, index) => (
            <HistoryRow
              key={`${getItemTitle(item)}-${index}`}
              item={item}
              icon={require('../../assets/graduation.png')}
              styles={styles}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function BadgeSection({ title, values, styles }) {
  return (
    <View style={styles.profileBadgeSection}>
      <Text style={styles.profileSectionTitle}>{title}</Text>
      <View style={styles.profileBadgesWrap}>
        {values.map((value, index) => (
          <View key={`${value}-${index}`} style={styles.profileBadge}>
            <Text style={styles.profileBadgeText}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function HistoryRow({ item, icon, styles }) {
  const title = getItemTitle(item);
  const subtitle = getItemSubtitle(item);
  const meta = getItemMeta(item);
  const description = getItemDescription(item);

  return (
    <View style={styles.profileListRow}>
      <Image source={icon} style={styles.profileListIcon} resizeMode="contain" />
      <View style={styles.profileListBody}>
        {!!title ? <Text style={styles.profileListTitle}>{title}</Text> : null}
        {!!subtitle ? <Text style={styles.profileSectionBody}>{subtitle}</Text> : null}
        {!!meta ? <Text style={styles.profileListMeta}>{meta}</Text> : null}
        {!!description ? <Text style={styles.profileListDescription}>{description}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(metrics) {
  const { vw, vh, moderateScale, responsiveFont } = metrics;

  return StyleSheet.create(withPlatformFontStyles({
    previewContent: {
      marginHorizontal: vw(1.8),
      paddingTop: moderateScale(12),
      paddingBottom: moderateScale(20),
    },
    profileHero: {
      marginBottom: moderateScale(16),
    },
    profileTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileAvatar: {
      width: moderateScale(112),
      height: moderateScale(112),
      borderRadius: moderateScale(15),
      backgroundColor: '#d4d4d4',
      flexShrink: 0,
    },
    profileTextWrap: {
      flex: 1,
      minWidth: 0,
      marginLeft: moderateScale(16),
    },
    profileNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileName: {
      flex: 1,
      minWidth: 0,
      color: '#141414',
      fontSize: responsiveFont(24, 20, 27),
      lineHeight: responsiveFont(30, 25, 32),
      fontWeight: '500',
    },
    profileLinkedinButton: {
      width: moderateScale(34),
      height: moderateScale(34),
      marginLeft: moderateScale(8),
    },
    profileLinkedinIcon: {
      width: '100%',
      height: '100%',
    },
    profileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: moderateScale(4),
    },
    locationGlyph: {
      width: moderateScale(20),
      color: '#222222',
      fontSize: responsiveFont(20, 17, 22),
      lineHeight: responsiveFont(24, 20, 26),
      textAlign: 'center',
      marginRight: moderateScale(4),
    },
    profileMetaIcon: {
      width: moderateScale(20),
      height: moderateScale(20),
      marginRight: moderateScale(4),
    },
    profileLocation: {
      flex: 1,
      minWidth: 0,
      color: '#7d879e',
      fontSize: responsiveFont(14, 12, 16),
      lineHeight: responsiveFont(19, 16, 21),
      fontStyle: 'italic',
    },
    profileBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: moderateScale(10),
      marginTop: moderateScale(28),
      marginBottom: moderateScale(18),
    },
    statusBadge: {
      minHeight: moderateScale(40),
      paddingHorizontal: moderateScale(17),
      borderRadius: moderateScale(11),
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
    },
    statusBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(16, 14, 17),
      lineHeight: responsiveFont(20, 17, 21),
    },
    foundingBadge: {
      backgroundColor: '#81879a',
    },
    newBadge: {
      borderWidth: moderateScale(3),
      borderColor: '#2dbcc4',
      paddingHorizontal: moderateScale(28),
    },
    activeBadge: {
      borderWidth: moderateScale(3),
      borderColor: '#25793b',
      paddingHorizontal: moderateScale(28),
    },
    darkBadgeText: {
      color: '#ffffff',
    },
    tealBadgeText: {
      color: '#19aeb9',
    },
    greenBadgeText: {
      color: '#25793b',
    },
    profileBio: {
      marginHorizontal: moderateScale(4),
      color: '#111111',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(21, 18, 23),
      fontWeight: '700',
    },
    profileSectionCard: {
      borderRadius: moderateScale(24),
      backgroundColor: '#ffffff',
      paddingHorizontal: vw(5),
      paddingVertical: moderateScale(18),
      marginBottom: moderateScale(18),
    },
    profileSectionTitle: {
      color: '#111111',
      fontSize: responsiveFont(18, 15, 19),
      lineHeight: responsiveFont(24, 20, 26),
      fontWeight: '700',
      marginBottom: moderateScale(8),
    },
    profileSectionBody: {
      color: '#111111',
      fontSize: responsiveFont(18, 15, 20),
      lineHeight: responsiveFont(25, 21, 28),
      fontWeight: '400',
    },
    profileIdea: {
      color: '#111111',
      fontSize: responsiveFont(22, 18, 24),
      lineHeight: responsiveFont(33, 27, 36),
    },
    profileDetailRow: {
      minHeight: moderateScale(54),
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#aaaaaa',
      paddingVertical: moderateScale(11),
      gap: moderateScale(12),
    },
    profileDetailRowLast: {
      borderBottomWidth: 0,
    },
    profileDetailIcon: {
      width: moderateScale(28),
      height: moderateScale(28),
      resizeMode: 'contain',
    },
    profileBadgeSection: {
      marginHorizontal: moderateScale(8),
      marginBottom: moderateScale(20),
    },
    profileBadgesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: moderateScale(9),
    },
    profileBadge: {
      maxWidth: '100%',
      borderRadius: 999,
      backgroundColor: '#1098b6',
      paddingHorizontal: moderateScale(16),
      paddingVertical: moderateScale(10),
    },
    profileBadgeText: {
      color: '#ffffff',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '500',
    },
    profileListRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: moderateScale(10),
      paddingBottom: moderateScale(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#d5d5d5',
    },
    profileListIcon: {
      width: moderateScale(72),
      height: moderateScale(72),
      borderRadius: moderateScale(8),
      backgroundColor: '#e1e4e9',
      marginRight: moderateScale(12),
    },
    profileListBody: {
      flex: 1,
      minWidth: 0,
    },
    profileListTitle: {
      color: '#111111',
      fontSize: responsiveFont(17, 15, 18),
      lineHeight: responsiveFont(23, 19, 24),
      fontWeight: '700',
    },
    profileListMeta: {
      marginTop: moderateScale(3),
      color: '#6f7b96',
      fontSize: responsiveFont(14, 12, 15),
      lineHeight: responsiveFont(19, 16, 20),
      fontWeight: '400',
    },
    profileListDescription: {
      marginTop: moderateScale(6),
      color: '#6f7b96',
      fontSize: responsiveFont(15, 13, 16),
      lineHeight: responsiveFont(21, 18, 23),
    },
  }));
}
