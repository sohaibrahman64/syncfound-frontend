import React from 'react';
import { Pressable, Text, View } from 'react-native';

export default function InvitesErrorState({ message, styles, onRetry }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateErrorText}>{message || 'Failed to load invites.'}</Text>
      <Pressable style={styles.stateButton} onPress={onRetry}>
        <Text style={styles.stateButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}
