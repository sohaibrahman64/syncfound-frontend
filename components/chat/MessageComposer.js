import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

export default function MessageComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  isSending,
  errorMessage,
  styles,
} = {}) {
  return (
    <View style={styles.composerWrap}>
      {!!errorMessage && <Text style={styles.composerErrorText}>{errorMessage}</Text>}

      <View style={styles.composerInputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Type a message"
          placeholderTextColor="#9aa0b0"
          style={styles.composerInput}
          editable={!disabled}
          multiline
          maxLength={4000}
        />

        <Pressable
          style={[styles.composerSendButton, (disabled || !value?.trim()) && styles.composerSendButtonDisabled]}
          onPress={onSend}
          disabled={disabled || !value?.trim()}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.composerSendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
