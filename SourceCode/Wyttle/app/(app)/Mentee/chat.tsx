import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { getCurrentUser, supabase } from '../../../src/lib/supabase';
type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
};

export default function MenteeChatScreen() {
  const params = useLocalSearchParams<{ threadId?: string; otherId?: string; name?: string }>();

  const threadId = params.threadId ? Number(params.threadId) : null;
  const displayName =
    typeof params.name === 'string' && params.name.length > 0
      ? params.name
      : 'Peer';

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!threadId) return;

      const me = await getCurrentUser();
      if (!isMounted) return;
      setMeId(me.id);

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender, body, inserted_at')
        .eq('thread_id', threadId)
        .order('inserted_at', { ascending: true });

      if (error) {
        console.error('Failed to load messages', error);
        return;
      }

      if (!isMounted) return;

      const mapped: Message[] = (data ?? []).map((m) => ({
        id: String(m.id),
        from: m.sender === me.id ? 'me' : 'them',
        text: m.body,
        time: new Date(m.inserted_at).toLocaleTimeString(),
      }));

      setMessages(mapped);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [threadId]);

  const handleSend = async () => {
    if (!threadId || !meId || !input.trim()) return;

    const body = input.trim();
    setInput('');

    const { error } = await supabase.from('messages').insert({
      thread_id: threadId,
      sender: meId,
      body,
    });

    if (error) {
      console.error('Failed to send message', error);
      return;
    }

    // Optimistically append; could also refetch
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        from: 'me',
        text: body,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  };

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
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <MessageBubble message={item} theme={theme} />}
        />

        {/* Composer */}
        <View style={[styles.composer, { backgroundColor: theme.card }]}> 
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Message..."
            placeholderTextColor="#7f8186"
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendButton} activeOpacity={0.8} onPress={handleSend}>
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
