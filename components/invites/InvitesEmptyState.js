import React from 'react';
import { Pressable, Text, View } from 'react-native';

const COPY = {
  invitations: 'No invitations yet. When someone invites you, it will appear here.',
  sent: 'No sent invites right now.',
  saved: 'No saved profiles yet.',
  passed: 'No passed profiles yet.',
};

export default function InvitesEmptyState({ tabKey, styles, onRetry }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateText}>{COPY[tabKey] || COPY.invitations}</Text>
      <Pressable style={styles.stateButton} onPress={onRetry}>
        <Text style={styles.stateButtonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}
