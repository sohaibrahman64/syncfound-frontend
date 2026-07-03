import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

function formatPreviewText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'No messages yet.';
  }

  if (text.length <= 30) {
    return text;
  }

  return `${text.slice(0, 30)}...`;
}

export default function ChatListCard({ item, onPress, styles }) {
  return (
    <Pressable style={styles.chatCardWrap} onPress={() => onPress?.(item)}>
      <View style={styles.chatCardRow}>
        <View style={styles.chatAvatarWrap}>
          {item?.otherParticipant?.photoUrl ? (
            <Image source={{ uri: item.otherParticipant.photoUrl }} style={styles.chatAvatarImage} />
          ) : (
            <Image source={require('../../assets/cofounders.jpg')} style={styles.chatAvatarImage} />
          )}
        </View>

        <View style={styles.chatCardTextWrap}>
          <Text
            style={styles.chatCardName}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling
          >
            {item?.title || 'Conversation'}
          </Text>
          <Text
            style={styles.chatCardPreview}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling
          >
            {formatPreviewText(item?.preview)}
          </Text>
        </View>

        {item?.unreadCount > 0 ? (
          <View style={styles.chatUnreadBadge}>
            <Text style={styles.chatUnreadBadgeText}>{item.unreadCount > 99 ? '99+' : String(item.unreadCount)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.chatCardDivider} />
    </Pressable>
  );
}
