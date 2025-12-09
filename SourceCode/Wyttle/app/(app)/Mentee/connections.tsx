import { router } from 'expo-router';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { commonStyles } from '../../../src/styles/common';

const MOCK_MEMBER_CONVERSATIONS = [
  {
    id: '1',
    name: 'Alex Young',
    role: 'Mentor • Product design',
    lastMessage: 'Great, let’s lock in a time for next week.',
    time: '2m',
    unread: true,
  },
  {
    id: '2',
    name: 'Priya Shah',
    role: 'Mentor • Career coaching',
    lastMessage: 'How did the interview go?',
    time: '1h',
    unread: false,
  },
  {
    id: '3',
    name: 'Jordan Lee',
    role: 'Mentor • Engineering leadership',
    lastMessage: 'Happy to review your portfolio.',
    time: 'Yesterday',
    unread: false,
  },
] as const;

export default function MemberConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Connections"
        subtitle="A simple placeholder list of your mentor chats."
      />

      {/* Conversation list (placeholder) */}
      <FlatList
        data={MOCK_MEMBER_CONVERSATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ConversationRow
            name={item.name}
            role={item.role}
            lastMessage={item.lastMessage}
            time={item.time}
            unread={item.unread}
            theme={theme}
            onPress={() =>
              router.push({
                pathname: '/(app)/Mentee/chat',
                params: { id: item.id, name: item.name },
              })
            }
          />
        )}
      />
    </View>
  );
}

type ConversationRowProps = {
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  unread?: boolean;
  theme: ReturnType<typeof Colors[string]>;
  onPress?: () => void;
};

function ConversationRow({ name, role, lastMessage, time, unread, theme, onPress }: ConversationRowProps) {
  const initials = name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.row, { backgroundColor: theme.card }]}>
        {/* Avatar placeholder */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

      {/* Main text */}
      <View style={styles.rowMiddle}>
        <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
          {name}
        </Text>
        <Text style={[styles.role, font('GlacialIndifference', '400')]}> 
          {role}
        </Text>
        <Text
          style={[styles.lastMessage, font('GlacialIndifference', '400')]}
          numberOfLines={1}
        >
          {lastMessage}
        </Text>
      </View>

      {/* Meta (time + unread dot) */}
      <View style={styles.rowRight}>
        <Text style={[styles.time, font('GlacialIndifference', '400')]}> 
          {time}
        </Text>
        {unread && <View style={styles.unreadDot} />}
      </View>
    </View>
  </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  rowMiddle: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    marginBottom: 2,
  },
  role: {
    fontSize: 12,
    color: '#8f8e8e',
    marginBottom: 2,
  },
  lastMessage: {
    fontSize: 13,
    color: '#666',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 40,
  },
  time: {
    fontSize: 11,
    color: '#999',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#968c6c',
    marginTop: 6,
  },
});
