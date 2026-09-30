import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

function renderTopTextByTab(tabKey, item, styles) {
  const boldNameStyle = [styles.cardTopText, { fontWeight: '700' }];

  if (tabKey === 'invitations') {
    return (
      <>
        <Text style={boldNameStyle}>{item.previewName}</Text>
        <Text style={styles.cardTopText}>: {item.messagePreview}</Text>
      </>
    );
  }

  if (tabKey === 'sent') {
    return (
      <>
        <Text style={boldNameStyle}>{item.previewName || 'You'}</Text>
        <Text style={styles.cardTopText}>: {item.messagePreview}</Text>
      </>
    );
  }

  if (tabKey === 'saved') {
    return (
      <>
        <Text style={styles.cardTopText}>You saved </Text>
        <Text style={boldNameStyle}>{item.previewName}</Text>
        <Text style={styles.cardTopText}> profile</Text>
      </>
    );
  }

  return (
    <>
      <Text style={styles.cardTopText}>You passed on </Text>
      <Text style={boldNameStyle}>{item.previewName}</Text>
      <Text style={styles.cardTopText}> profile</Text>
    </>
  );
}

export default function InviteListCard({ item, tabKey, styles, onPress }) {
  return (
    <Pressable style={styles.cardWrap} onPress={() => onPress?.(item)}>
      <View style={styles.cardTopBubble}>
        <Text style={[styles.cardTopText, (tabKey === 'saved' || tabKey === 'passed') && styles.cardTopTextMuted]} numberOfLines={2}>
          {renderTopTextByTab(tabKey, item, styles)}
        </Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.profileRow}>
        <View style={styles.inviteCardAvatarWrap}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.inviteCardAvatarImage} />
          ) : (
            <Image source={require('../../assets/cofounders.jpg')} style={styles.inviteCardAvatarImage} />
          )}
        </View>

        <View style={styles.inviteCardProfileTextWrap}>
          <Text style={styles.inviteCardProfileName} numberOfLines={1}>{item.displayName}</Text>
          <Text style={styles.inviteCardProfileLocation} numberOfLines={1}>{item.locationText}</Text>
        </View>
      </View>

      <View style={styles.detailRow}>
        <Image source={require('../../assets/search.png')} style={styles.detailIcon} />
        <Text style={styles.detailText} numberOfLines={1}>{item.intentBadge}</Text>
      </View>

      <View style={styles.detailRow}>
        <Image source={require('../../assets/team_member.png')} style={styles.detailIcon} />
        <Text style={styles.detailText} numberOfLines={1}>{item.timeCommitment}</Text>
      </View>

      <View style={styles.detailRow}>
        <Image source={require('../../assets/internship.png')} style={styles.detailIcon} />
        <Text style={styles.detailText} numberOfLines={1}>{item.roleTagsText}</Text>
      </View>
    </Pressable>
  );
}
