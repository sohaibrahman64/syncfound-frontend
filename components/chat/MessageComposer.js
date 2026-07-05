import React from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';

export default function MessageComposer({
  value,
  onChangeText,
  onSend,
  disabled,
  isSending,
  errorMessage,
  styles,
} = {}) {
  const canSend = !!value?.trim();

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
          style={[styles.composerSendButton, (disabled || !canSend) && styles.composerSendButtonDisabled]}
          onPress={onSend}
          disabled={disabled || !canSend}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Image source={require('../../assets/send.png')} style={styles.composerSendIcon} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
