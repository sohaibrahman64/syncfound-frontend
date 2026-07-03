import React from 'react';
import { Text, View } from 'react-native';

export default function MessageBubble({ item, styles }) {
  const isMine = Boolean(item?.isMine);
  const isAcceptance = String(item?.messageKind || '').toLowerCase() === 'acceptance_note';
  const isFailed = item?.sendState === 'failed';
  const timestamp = formatTimestamp(item?.createdAt);

  return (
    <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowOther]}>
      <View
        style={[
          styles.messageBubble,
          isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
          isAcceptance && styles.messageBubbleAcceptance,
          isFailed && styles.messageBubbleFailed,
        ]}
      >
        <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextOther]}>
          {item?.messageText || ''}
        </Text>

        <Text style={[styles.messageMetaText, isMine ? styles.messageMetaTextMine : styles.messageMetaTextOther]}>
          {isFailed ? 'Failed to send' : timestamp}
        </Text>
      </View>
    </View>
  );
}

function formatTimestamp(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return isToday ? `Today, ${time}` : `${date.toLocaleDateString()} ${time}`;
}
