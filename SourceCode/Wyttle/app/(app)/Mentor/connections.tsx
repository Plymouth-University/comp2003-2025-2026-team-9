import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
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

type MentorChatItem = {
  requestId: number;
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessageSender: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  proposedAt: string | null;
  unread: boolean;
};

type ChatFilter = 'all' | 'unread';
type ChatGroup = {
  title: 'Today' | 'Last Week' | 'Older';
  items: MentorChatItem[];
};

function EmptyChatsDropdown({
  open,
  emptyChats,
  onToggle,
  onOpenChat,
  theme,
}: {
  open: boolean;
  emptyChats: MentorChatItem[];
  onToggle: () => void;
  onOpenChat: (item: MentorChatItem) => void;
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
            <ThemedText style={[styles.sectionTitle, styles.pendingToggleTitle, font('GlacialIndifference', '800')]}>
              New Mentorship Requests
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
                role="Mentee"
                lastMessage="New mentorship request"
                time={formatChatTimestamp(item.proposedAt)}
                photoUrl={item.photoUrl}
                unread={item.unread}
                theme={theme}
                //onPress={() => onOpenChat(item)}
                onPress={onToggle}
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
                  role="Mentee"
                  lastMessage="New mentorship request"
                  time={formatChatTimestamp(item.proposedAt)}
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

export default function MentorConnectionsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [chats, setChats] = useState<MentorChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [emptyChatsExpanded, setEmptyChatsExpanded] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChats([]);
        return;
      }

      const blockedIds = new Set(await fetchBlockedUserIds());

      const { data: requests, error: reqError } = await supabase
        .from('mentor_requests')
        .select('id, mentee, mentor, thread_id, proposed_at')
        .eq('mentor', user.id)
        .not('thread_id', 'is', null)
        .order('proposed_at', { ascending: false });

      if (reqError) throw reqError;

      const visibleRequests = (requests ?? []).filter((request: any) => !blockedIds.has(request.mentee));

      if (visibleRequests.length === 0) {
        setChats([]);
        return;
      }

      const menteeIds = Array.from(new Set(visibleRequests.map((request: any) => request.mentee)));

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url')
        .in('id', menteeIds);

      if (profileError) throw profileError;

      const profileMap: Record<string, { name: string; photoUrl: string | null }> = {};
      (profiles ?? []).forEach((profile: any) => {
        profileMap[profile.id] = {
          name: profile.full_name ?? 'Mentee',
          photoUrl: profile.photo_url ?? null,
        };
      });

      const threadIds = Array.from(
        new Set(
          visibleRequests
            .map((request: any) => request.thread_id)
            .filter((id: number | null): id is number => id != null),
        ),
      );

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

      const chatItemsUnsorted: MentorChatItem[] = await Promise.all(
        visibleRequests.map(async (request: any) => {
          const profile = profileMap[request.mentee] ?? { name: 'Mentee', photoUrl: null };
          const last = request.thread_id ? lastByThread[request.thread_id] : undefined;
          const lastReadAt = request.thread_id ? await getLastReadAt(request.thread_id) : null;
          const unread = !!(
            request.thread_id &&
            last?.inserted_at &&
            last?.sender &&
            last.sender !== user.id &&
            (!lastReadAt || new Date(last.inserted_at).getTime() > new Date(lastReadAt).getTime())
          );

          return {
            requestId: request.id,
            threadId: request.thread_id!,
            otherUserId: request.mentee,
            name: profile.name,
            photoUrl: profile.photoUrl,
            lastMessageSender: last?.sender ?? null,
            lastMessage: last?.body ?? null,
            lastMessageAt: last?.inserted_at ?? null,
            proposedAt: request.proposed_at ?? null,
            unread,
          };
        }),
      );

      const sortedChatItems = chatItemsUnsorted.sort((a, b) => {
        const aDate = a.lastMessageAt ?? a.proposedAt ?? '';
        const bDate = b.lastMessageAt ?? b.proposedAt ?? '';
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });

      setChats(sortedChatItems);
    } catch (err: any) {
      console.error('Failed to load mentor connections', err);
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
          .channel(`mentor-connections-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'mentor_requests' },
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
        console.warn('Failed to set up realtime for mentor connections', err);
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

  const openChat = (item: MentorChatItem) => {
    router.push({
      pathname: '/(app)/Mentor/chat',
      params: {
        threadId: String(item.threadId),
        otherId: item.otherUserId,
        name: item.name,
      },
    });
  };

  const toggleEmptyChatsExpanded = () => {
    setEmptyChatsExpanded((current) => !current);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Connections" subtitle="Mentees who have booked sessions with you." />

      {loading && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {error && <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {showEmptyChatsDropdown && (
          <EmptyChatsDropdown
            open={emptyChatsExpanded}
            emptyChats={emptyChats}
            onToggle={toggleEmptyChatsExpanded}
            onOpenChat={openChat}
            theme={theme}
          />
        )}

        <View style={styles.chatHeaderRow}>
          <ThemedText style={[styles.sectionTitle, font('GlacialIndifference', '800')]}>
            Chats
          </ThemedText>
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
          <Text style={{ fontSize: 14, color: '#8f8e8e' }}>
            {chatFilter === 'unread' ? 'No unread chats right now.' : 'No active mentee chats yet.'}
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
                <View key={String(item.threadId)} style={{ marginBottom: 10 }}>
                  <ConversationRow
                    name={item.name}
                    role="Mentee"
                    lastMessage={item.lastMessage ?? 'New mentorship request'}
                    time={formatChatTimestamp(item.lastMessageAt ?? item.proposedAt)}
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

function groupChatsByDate(chats: MentorChatItem[]): ChatGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const groups: ChatGroup[] = [];

  chats.forEach((chat) => {
    const referenceDate = chat.lastMessageAt ?? chat.proposedAt;
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

function hasLastMessage(chat: MentorChatItem) {
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
    paddingBottom: 0,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 140,
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
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
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
});
