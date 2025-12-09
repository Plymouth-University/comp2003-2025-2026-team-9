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
  { id: '1', from: 'them', text: "Hey, great to meet you! How can I help?", time: '09:30' },
  { id: '2', from: 'me', text: "Hi, I'm looking for guidance on my portfolio.", time: '09:31' },
  { id: '3', from: 'them', text: "Perfect. Send me a link and we can walk through it.", time: '09:32' },
  { id: '4', from: 'me', text: "Awesome, thank you!", time: '09:33' },
];

export default function MenteeChatScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const displayName =
    typeof params.name === 'string' && params.name.length > 0
      ? params.name
      : 'Mentor';

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
            <Text
              style={[
                styles.headerName,
                font('GlacialIndifference', '800'),
                { color: theme.text },
              ]}
            >
              {displayName}
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                font('GlacialIndifference', '400'),
              ]}
            >
              Mock conversation preview
            </Text>
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
            { color: isMe ? '#fff' : theme.text },
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
  },
  headerName: {
    fontSize: 18,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8f8e8e',
    marginTop: 2,
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
