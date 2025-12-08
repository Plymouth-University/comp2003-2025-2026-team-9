import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { commonStyles } from '../../../src/styles/common';

type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
};

const MOCK_MESSAGES: Message[] = [
  { id: '1', from: 'them', text: "Hi, thanks for offering to mentor me!", time: '14:02' },
  { id: '2', from: 'me', text: "Great to meet you. What would you like to focus on first?", time: '14:03' },
  { id: '3', from: 'them', text: "I'm trying to move into a senior role this year.", time: '14:05' },
  { id: '4', from: 'me', text: "Perfect, we can put a plan together.", time: '14:07' },
];

export default function MentorChatScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const displayName =
    typeof params.name === 'string' && params.name.length > 0
      ? params.name
      : 'Member';

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        {/* Header */}
        <View style={styles.headerRow}>
          <BackButton />
          <View style={styles.headerTextBlock}>
            <ScreenHeader
              title={displayName}
              subtitle="Mock chat with member"
            />
          </View>
        </View>

        {/* Messages */}
        <FlatList
          data={MOCK_MESSAGES}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageBubble message={item} theme={theme} />}
        />

        {/* Composer (non-functional placeholder) */}
        <View style={[styles.composer, { backgroundColor: theme.card }]}> 
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Message (mock UI only)…"
            placeholderTextColor="#7f8186"
            editable={false}
          />
          <TouchableOpacity style={styles.sendButton} activeOpacity={0.8}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

type MessageBubbleProps = {
  message: Message;
  theme: ReturnType<typeof Colors[string]>;
};

function MessageBubble({ message, theme }: MessageBubbleProps) {
  const isMe = message.from === 'me';

  return (
    <View
      style={[
        styles.bubbleRow,
        {
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMe
            ? styles.bubbleMe
            : [styles.bubbleThem, { backgroundColor: theme.card }],
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            isMe && { color: '#fff' },
          ]}
        >
          {message.text}
        </Text>
        <Text style={styles.bubbleTime}>{message.time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 16,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#333f5c',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#e1e3ea',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: '#222',
  },
  bubbleTime: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontSize: 10,
    color: '#999',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#968c6c',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
