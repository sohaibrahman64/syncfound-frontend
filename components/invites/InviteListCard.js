import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

function topTextByTab(tabKey, item) {
  if (tabKey === 'invitations') {
    return `${item.previewName}: ${item.messagePreview}`;
  }

  if (tabKey === 'sent') {
    return `You: ${item.messagePreview}`;
  }

  if (tabKey === 'saved') {
    return `You saved ${item.displayName} profile`;
  }

  return `You passed on ${item.displayName} profile`;
}

export default function InviteListCard({ item, tabKey, styles, onPress }) {
  const topText = topTextByTab(tabKey, item);

  return (
    <Pressable style={styles.cardWrap} onPress={() => onPress?.(item)}>
      <View style={styles.cardTopBubble}>
        <Text style={[styles.cardTopText, (tabKey === 'saved' || tabKey === 'passed') && styles.cardTopTextMuted]} numberOfLines={2}>
          {topText}
        </Text>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.profileRow}>
        <View style={styles.avatarWrap}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Image source={require('../../assets/cofounders.jpg')} style={styles.avatarImage} />
          )}
        </View>

        <View style={styles.profileTextWrap}>
          <Text style={styles.profileName} numberOfLines={1}>{item.displayName}</Text>
          <Text style={styles.profileLocation} numberOfLines={1}>{item.locationText}</Text>
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
