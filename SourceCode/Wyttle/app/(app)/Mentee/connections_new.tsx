import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { getLastReadAt } from '../../../src/lib/chat-read-state';
import { fetchBlockedUserIds, supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type MatchItem = {
  matchId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  createdAt: string;
  threadId: number | null;
};

type ChatItem = {
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessageSender: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unread: boolean;
};

type ChatFilter = 'all' | 'unread';
type ChatGroup = {
  title: 'Today' | 'Last Week' | 'Older';
  items: ChatItem[];
};

function EmptyChatsDropdown({
  open,
  emptyChats,
  onToggle,
  onOpenChat,
  theme,
}: {
  open: boolean;
  emptyChats: ChatItem[];
  onToggle: () => void;
  onOpenChat: (item: ChatItem) => void;
  theme: any;
}) {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (open && contentHeight > 0 && isReady) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: contentHeight,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } else if (!open && isReady) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [animatedHeight, animatedOpacity, contentHeight, isReady, open]);

  return (
    <View style={styles.pendingSection}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onToggle}
        style={[styles.pendingToggle, { backgroundColor: theme.card, borderColor: theme.border ?? '#d9d3c3' }]}
      >
        <View style={styles.pendingToggleTextBlock}>
          <View style={styles.pendingToggleTitleRow}>
            <ThemedText style={[styles.chatsTitle, styles.pendingToggleTitle, font('GlacialIndifference', '800')]}>
              New Connections
            </ThemedText>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{emptyChats.length}</Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text}
          style={styles.pendingToggleChevron}
        />
      </TouchableOpacity>

      <View
        style={styles.measureContainer}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight > 0) {
            setContentHeight(nextHeight);
            if (!isReady) {
              setIsReady(true);
            }
          }
        }}
      >
        <View style={styles.dropdownItemsContainer}>
          {emptyChats.map((item) => (
            <View key={String(item.threadId)} style={styles.chatRowSpacing}>
              <ConversationRow
                name={item.name}
                role="Peer match"
                lastMessage="Say hi and start the conversation!"
                time={formatChatTimestamp(item.createdAt)}
                photoUrl={item.photoUrl}
                unread={item.unread}
                theme={theme}
                onPress={() => onOpenChat(item)}
              />
            </View>
          ))}
        </View>
      </View>

      {isReady && (
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              height: animatedHeight,
              opacity: animatedOpacity,
            },
          ]}
        >
          <View style={styles.dropdownItemsContainer}>
            {emptyChats.map((item) => (
              <View key={String(item.threadId)} style={styles.chatRowSpacing}>
                <ConversationRow
                  name={item.name}
                  role="Peer match"
                  lastMessage="Say hi and start the conversation!"
                  time={formatChatTimestamp(item.createdAt)}
                  photoUrl={item.photoUrl}
                  unread={item.unread}
                  theme={theme}
                  onPress={() => onOpenChat(item)}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

export default function MenteeConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [emptyChatsExpanded, setEmptyChatsExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMatches([]);
        setChats([]);
        return;
      }

      const blockedIds = new Set(await fetchBlockedUserIds());

      const { data: matchRows, error: matchError } = await supabase
        .from('peer_matches')
        .select('id, member_a, member_b, thread_id, created_at')
        .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (matchError) throw matchError;

      if (!matchRows || matchRows.length === 0) {
        setMatches([]);
        setChats([]);
        return;
      }

      const enrichedMatches: MatchItem[] = matchRows
        .map((match: any) => {
          const otherUserId = match.member_a === user.id ? match.member_b : match.member_a;
          return {
            matchId: match.id,
            otherUserId,
            name: '',
            photoUrl: null,
            createdAt: match.created_at,
            threadId: match.thread_id,
          };
        })
        .filter((match) => !blockedIds.has(match.otherUserId));

      const otherUserIds = Array.from(new Set(enrichedMatches.map((match) => match.otherUserId)));

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url')
        .in('id', otherUserIds);

      if (profileError) throw profileError;

      const nameById: Record<string, { name: string; photoUrl: string | null }> = {};
      (profiles ?? []).forEach((profile: any) => {
        nameById[profile.id] = {
          name: profile.full_name ?? 'Member',
          photoUrl: profile.photo_url ?? null,
        };
      });

      const matchesWithProfile: MatchItem[] = enrichedMatches.map((match) => ({
        ...match,
        name: nameById[match.otherUserId]?.name ?? 'Member',
        photoUrl: nameById[match.otherUserId]?.photoUrl ?? null,
      }));

      const chatsResultUnsorted: ChatItem[] = await Promise.all(
        matchesWithProfile
          .filter((match) => match.threadId != null)
          .map(async (match) => {
            return {
              threadId: match.threadId!,
              otherUserId: match.otherUserId,
              name: match.name,
              photoUrl: match.photoUrl,
              lastMessageSender: null,
              lastMessage: null,
              lastMessageAt: null,
              createdAt: match.createdAt,
              unread: false,
            };
          }),
      );

      const threadIds = chatsResultUnsorted.map((chat) => chat.threadId);
      let lastByThread: Record<number, { sender: string | null; body: string; inserted_at: string }> = {};

      if (threadIds.length > 0) {
        const { data: messages, error: messageError } = await supabase
          .from('messages')
          .select('id, thread_id, sender, body, inserted_at')
          .in('thread_id', threadIds)
          .order('inserted_at', { ascending: false });

        if (messageError) throw messageError;

        (messages ?? []).forEach((message: any) => {
          if (!lastByThread[message.thread_id]) {
            lastByThread[message.thread_id] = {
              sender: message.sender ?? null,
              body: message.body,
              inserted_at: message.inserted_at,
            };
          }
        });
      }

      const chatsWithMessages = await Promise.all(
        chatsResultUnsorted.map(async (chat) => {
          const last = lastByThread[chat.threadId];
          const lastReadAt = await getLastReadAt(chat.threadId);
          const unread = !!(
            last?.inserted_at &&
            last?.sender &&
            last.sender !== user.id &&
            (!lastReadAt || new Date(last.inserted_at).getTime() > new Date(lastReadAt).getTime())
          );

          return {
            ...chat,
            lastMessageSender: last?.sender ?? null,
            lastMessage: last?.body ?? null,
            lastMessageAt: last?.inserted_at ?? null,
            unread,
          };
        }),
      );

      const sortedChats = chatsWithMessages.sort((a, b) => {
        const aDate = a.lastMessageAt ?? a.createdAt ?? '';
        const bDate = b.lastMessageAt ?? b.createdAt ?? '';
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });

      setMatches(matchesWithProfile);
      setChats(sortedChats);
    } catch (err: any) {
      console.error('Failed to load mentee connections', err);
      setError(err.message ?? 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let channel: any | null = null;

    const setupRealtime = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        channel = supabase
          .channel(`mentee-connections-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'peer_matches' },
            () => {
              if (isMounted) {
                load();
              }
            },
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            () => {
              if (isMounted) {
                load();
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.warn('Failed to set up realtime for mentee connections', err);
      }
    };

    load();
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredChats = chats.filter((chat) => {
    if (chatFilter === 'unread') {
      return chat.unread;
    }
    return true;
  });

  const activeChats = filteredChats.filter(hasLastMessage);
  const emptyChats = filteredChats.filter((chat) => !hasLastMessage(chat));
  const showEmptyChatsDropdown = activeChats.length > 0 && emptyChats.length > 0;
  const visibleChats = showEmptyChatsDropdown ? activeChats : filteredChats;
  const groupedChats = groupChatsByDate(visibleChats);

  const openChat = async (item: MatchItem | ChatItem) => {
    try {
      if ('threadId' in item && item.threadId) {
        router.push({
          pathname: '/(app)/Mentee/chat',
          params: {
            threadId: String(item.threadId),
            otherId: item.otherUserId,
            name: item.name,
          },
        });
        return;
      }

      const { data, error } = await supabase.rpc('ensure_peer_thread', {
        other_user: item.otherUserId,
      });
      if (error) throw error;

      const threadId = data?.id as number | undefined;
      if (!threadId) return;

      router.push({
        pathname: '/(app)/Mentee/chat',
        params: {
          threadId: String(threadId),
          otherId: item.otherUserId,
          name: item.name,
        },
      });
    } catch (err) {
      console.error('Failed to open chat', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Connections" subtitle="Your peer connections and active chats." />

      {loading && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {error && <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>}

      <View style={styles.matchesSection}>
        <ThemedText style={[styles.matchesTitle, font('GlacialIndifference', '800')]}>Matches</ThemedText>
        {matches.length === 0 ? (
          <Text style={styles.emptyText}>No connections yet – keep swiping in Discovery.</Text>
        ) : (
          <FlatList
            horizontal
            data={matches}
            keyExtractor={(item) => String(item.matchId)}
            contentContainerStyle={{ paddingVertical: 8 }}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => openChat(item)}
                style={[styles.matchCard, { backgroundColor: theme.card }]}
              >
                <View style={styles.matchAvatar}>
                  {item.photoUrl ? (
                    <Image source={{ uri: item.photoUrl }} style={styles.matchAvatarImage} />
                  ) : (
                    <Text style={styles.matchAvatarInitial}>{item.name.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <Text
                  style={[styles.matchName, font('GlacialIndifference', '800'), { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {showEmptyChatsDropdown && (
          <EmptyChatsDropdown
            open={emptyChatsExpanded}
            emptyChats={emptyChats}
            onToggle={() => setEmptyChatsExpanded((current) => !current)}
            onOpenChat={openChat}
            theme={theme}
          />
        )}

        <View style={styles.chatHeaderRow}>
          <ThemedText style={[styles.chatsTitle, font('GlacialIndifference', '800')]}>Chats</ThemedText>
          <View style={[styles.filterBar, { borderColor: theme.border ?? '#d9d3c3' }]}>
            <TouchableOpacity
              style={[styles.filterChip, chatFilter === 'all' && styles.filterChipActive]}
              onPress={() => setChatFilter('all')}
            >
              <Text style={[styles.filterChipText, chatFilter === 'all' && styles.filterChipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, chatFilter === 'unread' && styles.filterChipActive]}
              onPress={() => setChatFilter('unread')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  chatFilter === 'unread' && styles.filterChipTextActive,
                ]}
              >
                Unread
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {visibleChats.length === 0 && !loading ? (
          <Text style={styles.emptyText}>
            {chatFilter === 'unread'
              ? 'No unread chats right now.'
              : 'No chats yet – start a conversation with your matches!'}
          </Text>
        ) : (
          groupedChats.map((group) => (
            <View key={group.title} style={styles.chatGroup}>
              <View style={styles.groupHeader}>
                <ThemedText style={[styles.groupTitle, font('GlacialIndifference', '800')]}>
                  {group.title}
                </ThemedText>
                <View style={[styles.groupDivider, { backgroundColor: theme.border ?? '#d9d3c3' }]} />
              </View>
              {group.items.map((item) => (
                <View key={String(item.threadId)} style={styles.chatRowSpacing}>
                  <ConversationRow
                    name={item.name}
                    role="Peer match"
                    lastMessage={item.lastMessage ?? 'Say hi and start the conversation!'}
                    time={formatChatTimestamp(item.lastMessageAt ?? item.createdAt)}
                    photoUrl={item.photoUrl}
                    unread={item.unread}
                    theme={theme}
                    onPress={() => openChat(item)}
                  />
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function groupChatsByDate(chats: ChatItem[]): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const groups: ChatGroup[] = [];

  chats.forEach((chat) => {
    const referenceDate = chat.lastMessageAt ?? chat.createdAt;
    const chatDate = referenceDate ? new Date(referenceDate) : null;

    let title: ChatGroup['title'] = 'Older';
    if (chatDate && chatDate >= startOfToday) {
      title = 'Today';
    } else if (chatDate && chatDate >= startOfLastWeek) {
      title = 'Last Week';
    }

    const existingGroup = groups.find((group) => group.title === title);
    if (existingGroup) {
      existingGroup.items.push(chat);
    } else {
      groups.push({ title, items: [chat] });
    }
  });

  return groups;
}

function hasLastMessage(chat: ChatItem) {
  return Boolean(chat.lastMessage && chat.lastMessage.trim().length > 0);
}

function formatChatTimestamp(timestamp: string | null) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type ConversationRowProps = {
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  photoUrl?: string | null;
  unread?: boolean;
  theme: (typeof Colors)[keyof typeof Colors];
  onPress?: () => void;
};

function ConversationRow({ name, role, lastMessage, time, photoUrl, unread, theme, onPress }: ConversationRowProps) {
  const initials = name
    .split(' ')
    .map((segment) => segment.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.row, { backgroundColor: theme.card }]}>
        <View style={styles.avatar}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        <View style={styles.rowMiddle}>
          <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
            {name}
          </Text>
          <Text style={[styles.role, font('GlacialIndifference', '400')]}>{role}</Text>
          <Text style={[styles.lastMessage, font('GlacialIndifference', '400')]} numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <Text style={[styles.time, font('GlacialIndifference', '400')]}>{time}</Text>
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
  },
  matchesSection: {
    marginBottom: 16,
  },
  matchesTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  chatsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#8f8e8e',
    marginTop: 8,
  },
  matchCard: {
    width: 96,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  matchAvatarInitial: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  matchAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  matchName: {
    fontSize: 12,
    textAlign: 'center',
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
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
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
  chatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    backgroundColor: '#f5f1e7',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: '#333f5c',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6f6855',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  chatGroup: {
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 13,
    color: '#8f8e8e',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  groupDivider: {
    flex: 1,
    height: 1,
  },
  pendingSection: {
    marginBottom: 16,
  },
  measureContainer: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
  animatedContainer: {
    overflow: 'hidden',
    width: '100%',
  },
  dropdownItemsContainer: {
    width: '100%',
  },
  pendingToggle: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pendingToggleTextBlock: {
    flex: 1,
  },
  pendingToggleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingToggleTitle: {
    marginBottom: 0,
  },
  pendingToggleChevron: {
    marginLeft: 8,
  },
  pendingBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: '#d64545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  chatRowSpacing: {
    marginBottom: 10,
  },
});
