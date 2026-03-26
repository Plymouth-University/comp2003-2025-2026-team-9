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
import {
  markThreadRead,
} from '../../../src/lib/chat-receipts';
import {
  getLastReadMessageIdMap,
  hasLocalReadReached,
  markThreadReadLocally,
  subscribeToLocalReadUpdates,
} from '../../../src/lib/chat-read-state';
import { font } from '../../../src/lib/fonts';
import { useMenteeBottomNavHeight } from '../../../src/lib/mentee-bottom-nav-height';
import { setMenteeBadgeState } from '../../../src/lib/nav-badge-state';
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
  roleLabel: string;
  statusLabel?: string | null;
  statusTone?: 'neutral' | 'warning' | 'success';
  scheduledStart?: string | null;
  lastMessageId?: string | null;
  lastMessageSender: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unread: boolean;
  sessionCount?: number;
  relatedSessions?: ChatItem[];
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
        pointerEvents="none"
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
                role={item.roleLabel}
                statusLabel={item.statusLabel}
                statusTone={item.statusTone}
                lastMessage="Say hi and start the conversation!"
                time={formatChatTimestamp(item.createdAt)}
                photoUrl={item.photoUrl}
                unread={item.unread}
                theme={theme}
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
                  role={item.roleLabel}
                  statusLabel={item.statusLabel}
                  statusTone={item.statusTone}
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
  const [expandedMentorIds, setExpandedMentorIds] = useState<Record<string, boolean>>({});
  const [bottomNavHeight, setBottomNavHeight] = useState(140);
  const { registerOnHeightChange } = useMenteeBottomNavHeight();
  const isScreenFocusedRef = useRef(false);

  const load = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet ?? false;
    if (!quiet) {
      setLoading(true);
    }
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMatches([]);
        setChats([]);
        setMenteeBadgeState({ connections: 0, mentorHub: 0 });
        return;
      }

      const blockedIds = new Set(await fetchBlockedUserIds());

      const { data: matchRows, error: matchError } = await supabase
        .from('peer_matches')
        .select('id, member_a, member_b, thread_id, created_at')
        .or(`member_a.eq.${user.id},member_b.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (matchError) throw matchError;

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

      const peerUserIds = Array.from(new Set(enrichedMatches.map((match) => match.otherUserId)));

      let peerProfiles: any[] = [];
      if (peerUserIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url')
          .in('id', peerUserIds);

        if (profileError) throw profileError;
        peerProfiles = profiles ?? [];
      }

      const nameById: Record<string, { name: string; photoUrl: string | null }> = {};
      peerProfiles.forEach((profile: any) => {
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

      const peerChats: ChatItem[] = await Promise.all(
        matchesWithProfile
          .filter((match) => match.threadId != null)
          .map(async (match) => {
            return {
              threadId: match.threadId!,
              otherUserId: match.otherUserId,
              name: match.name,
              photoUrl: match.photoUrl,
              roleLabel: 'Peer match',
              statusLabel: null,
              statusTone: 'neutral',
              scheduledStart: null,
              lastMessageId: null,
              lastMessageSender: null,
              lastMessage: null,
              lastMessageAt: null,
              createdAt: match.createdAt,
              unread: false,
            };
          }),
      );

      const { data: mentorRequests, error: mentorRequestError } = await supabase
        .from('mentor_requests')
        .select('id, mentor, thread_id, proposed_at, scheduled_start, status')
        .eq('mentee', user.id)
        .not('thread_id', 'is', null)
        .in('status', ['requested', 'scheduled', 'cancelled']);

      if (mentorRequestError) throw mentorRequestError;

      const visibleMentorRequests = (mentorRequests ?? []).filter((request: any) => !blockedIds.has(request.mentor));
      const mentorIds = Array.from(new Set(visibleMentorRequests.map((request: any) => request.mentor)));

      let mentorProfiles: any[] = [];
      if (mentorIds.length > 0) {
        const { data: profiles, error: mentorProfileError } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url')
          .in('id', mentorIds);

        if (mentorProfileError) throw mentorProfileError;
        mentorProfiles = profiles ?? [];
      }

      const mentorProfileMap: Record<string, { name: string; photoUrl: string | null }> = {};
      mentorProfiles.forEach((profile: any) => {
        mentorProfileMap[profile.id] = {
          name: profile.full_name ?? 'Mentor',
          photoUrl: profile.photo_url ?? null,
        };
      });

      const mentorshipChats: ChatItem[] = visibleMentorRequests.map((request: any) => ({
        threadId: request.thread_id,
        otherUserId: request.mentor,
        name: mentorProfileMap[request.mentor]?.name ?? 'Mentor',
        photoUrl: mentorProfileMap[request.mentor]?.photoUrl ?? null,
        roleLabel: 'Mentor',
        statusLabel: getMentorshipStatusLabel(request.status, request.scheduled_start),
        statusTone: getMentorshipStatusTone(request.status, request.scheduled_start),
        scheduledStart: request.scheduled_start ?? null,
        lastMessageId: null,
        lastMessageSender: null,
        lastMessage: null,
        lastMessageAt: null,
        createdAt: request.proposed_at,
        unread: false,
      }));

      const chatsResultUnsorted = [...peerChats, ...mentorshipChats].filter(
        (chat, index, list) => list.findIndex((candidate) => candidate.threadId === chat.threadId) === index,
      );

      const threadIds = chatsResultUnsorted.map((chat) => chat.threadId);
      let lastByThread: Record<number, { id: string; sender: string | null; body: string; inserted_at: string }> = {};

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
              id: String(message.id),
              sender: message.sender ?? null,
              body: message.body,
              inserted_at: message.inserted_at,
            };
          }
        });
      }

      const localReadMap =
        threadIds.length > 0 ? await getLastReadMessageIdMap(threadIds) : {};

      const chatsWithMessages = chatsResultUnsorted.map((chat) => {
        const last = lastByThread[chat.threadId];
        const unread = !!(
          last?.id &&
          last?.sender &&
          last.sender !== user.id &&
          !hasLocalReadReached(localReadMap[chat.threadId], last.id)
        );

        return {
          ...chat,
          lastMessageId: last?.id ?? null,
          lastMessageSender: last?.sender ?? null,
          lastMessage: last?.body ?? null,
          lastMessageAt: last?.inserted_at ?? null,
          unread,
        };
      });

      const collapsedChats = collapseMentorshipChats(chatsWithMessages);

      const sortedChats = collapsedChats.sort((a, b) => {
        const aDate = a.lastMessageAt ?? a.createdAt ?? '';
        const bDate = b.lastMessageAt ?? b.createdAt ?? '';
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });

      const mentorHubCount = visibleMentorRequests.filter(
        (request: any) =>
          request.status === 'scheduled' &&
          request.scheduled_start &&
          new Date(request.scheduled_start).getTime() >= Date.now() - 30 * 60 * 1000,
      ).length;

      setMatches(matchesWithProfile);
      setChats(sortedChats);
      setMenteeBadgeState({
        connections: sortedChats.filter((chat) => chat.unread).length,
        mentorHub: mentorHubCount,
      });
    } catch (err: any) {
      console.error('Failed to load mentee connections', err);
      setError(err.message ?? 'Failed to load connections');
    } finally {
      if (!quiet) {
        setLoading(false);
      }
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
            {
              event: '*',
              schema: 'public',
              table: 'peer_matches',
              filter: `member_a=eq.${user.id}`,
            },
            () => {
              if (isMounted && isScreenFocusedRef.current) {
                void load({ quiet: true });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'peer_matches',
              filter: `member_b=eq.${user.id}`,
            },
            () => {
              if (isMounted && isScreenFocusedRef.current) {
                void load({ quiet: true });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mentor_requests',
              filter: `mentee=eq.${user.id}`,
            },
            () => {
              if (isMounted && isScreenFocusedRef.current) {
                void load({ quiet: true });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'thread_memberships',
              filter: `user_id=eq.${user.id}`,
            },
            () => {
              if (isMounted && isScreenFocusedRef.current) {
                void load({ quiet: true });
              }
            },
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            },
            () => {
              if (isMounted && isScreenFocusedRef.current) {
                void load({ quiet: true });
              }
            },
          )
          .subscribe();
      } catch (err) {
        console.warn('Failed to set up realtime for mentee connections', err);
      }
    };

    void load();
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [load]);

  useEffect(() => {
    const unsubscribe = subscribeToLocalReadUpdates(() => {
      if (isScreenFocusedRef.current) {
        void load({ quiet: true });
      }
    });

    return unsubscribe;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocusedRef.current = true;
      registerOnHeightChange(setBottomNavHeight);
      void load({ quiet: true });
      return () => {
        isScreenFocusedRef.current = false;
        registerOnHeightChange(undefined);
      };
    }, [load, registerOnHeightChange]),
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

  const clearThreadUnread = useCallback((threadId: number) => {
    setChats((current) =>
      current.map((chat) => {
        if (chat.threadId === threadId && !chat.relatedSessions?.length) {
          return { ...chat, unread: false };
        }

        if (!chat.relatedSessions?.length) {
          return chat;
        }

        const nextRelatedSessions = chat.relatedSessions.map((session) =>
          session.threadId === threadId ? { ...session, unread: false } : session,
        );
        const hasChanged = nextRelatedSessions.some(
          (session, index) => session.unread !== chat.relatedSessions?.[index]?.unread,
        );

        if (!hasChanged) {
          return chat.threadId === threadId ? { ...chat, unread: false } : chat;
        }

        const matchingSession = nextRelatedSessions.find((session) => session.threadId === threadId);
        const shouldClearParent = chat.threadId === threadId || matchingSession?.threadId === threadId;

        return {
          ...chat,
          unread: shouldClearParent ? nextRelatedSessions.some((session) => session.unread) : chat.unread,
          relatedSessions: nextRelatedSessions,
        };
      }),
    );
  }, []);

  const openChat = async (item: MatchItem | ChatItem) => {
    try {
      if ('threadId' in item && item.threadId) {
        if ('unread' in item && item.unread && chatFilter === 'unread') {
          setChatFilter('all');
        }

        if ('unread' in item && item.unread && item.lastMessageId) {
          clearThreadUnread(item.threadId);
          void markThreadReadLocally(item.threadId, item.lastMessageId);
          void markThreadRead(item.threadId, item.lastMessageId).catch((error) => {
            console.warn('Failed to mark mentee chat read when opening thread', error);
            void load({ quiet: true });
          });
        }

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

  const toggleMentorSessions = (mentorId: string) => {
    setExpandedMentorIds((current) => ({
      ...current,
      [mentorId]: !current[mentorId],
    }));
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

      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomNavHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      >
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
                  {item.roleLabel === 'Mentor' && (item.sessionCount ?? 1) > 1 ? (
                    <MentorChatGroupRow
                      item={item}
                      expanded={!!expandedMentorIds[item.otherUserId]}
                      onToggle={() => toggleMentorSessions(item.otherUserId)}
                      onOpenChat={openChat}
                      theme={theme}
                    />
                  ) : (
                    <ConversationRow
                      name={item.name}
                      role={item.roleLabel}
                      statusLabel={item.statusLabel}
                      statusTone={item.statusTone}
                      lastMessage={item.lastMessage ?? 'Say hi and start the conversation!'}
                      time={formatChatTimestamp(item.lastMessageAt ?? item.createdAt)}
                      photoUrl={item.photoUrl}
                    unread={item.unread}
                      theme={theme}
                      onPress={() => openChat(item)}
                    />
                  )}
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

function collapseMentorshipChats(chats: ChatItem[]) {
  const peerChats = chats.filter((chat) => chat.roleLabel !== 'Mentor');
  const mentorChats = chats.filter((chat) => chat.roleLabel === 'Mentor');

  const byMentor = new Map<string, ChatItem[]>();
  mentorChats.forEach((chat) => {
    const existing = byMentor.get(chat.otherUserId);
    if (existing) {
      existing.push(chat);
    } else {
      byMentor.set(chat.otherUserId, [chat]);
    }
  });

  const collapsedMentorChats = Array.from(byMentor.values()).map((group) => {
    const latestRequest = group.reduce((latest, current) => {
      const latestTime = latest.createdAt ?? '';
      const currentTime = current.createdAt ?? '';
      return currentTime > latestTime ? current : latest;
    });

    const latestActivity = group.reduce((latest, current) => {
      const latestTime = latest.lastMessageAt ?? latest.createdAt ?? '';
      const currentTime = current.lastMessageAt ?? current.createdAt ?? '';
      return currentTime > latestTime ? current : latest;
    });

    const latestStatusSource = group.reduce((latest, current) => {
      const latestTime = latest.lastMessageAt ?? latest.createdAt ?? '';
      const currentTime = current.lastMessageAt ?? current.createdAt ?? '';
      return currentTime > latestTime ? current : latest;
    });

    return {
      ...latestActivity,
      createdAt: latestRequest.createdAt,
      statusLabel: latestStatusSource.statusLabel,
      statusTone: latestStatusSource.statusTone,
      scheduledStart: latestStatusSource.scheduledStart,
      unread: group.some((chat) => chat.unread),
      sessionCount: group.length,
      relatedSessions: group.sort((a, b) => {
        const aTime = a.lastMessageAt ?? a.createdAt ?? '';
        const bTime = b.lastMessageAt ?? b.createdAt ?? '';
        return aTime < bTime ? 1 : aTime > bTime ? -1 : 0;
      }),
    };
  });

  return [...peerChats, ...collapsedMentorChats];
}

function hasLastMessage(chat: ChatItem) {
  return Boolean(chat.lastMessage && chat.lastMessage.trim().length > 0);
}

function getMentorshipStatusLabel(status: string | null, scheduledStart?: string | null) {
  switch (status) {
    case 'cancelled':
      return 'Declined';
    case 'requested':
      return 'Pending';
    case 'scheduled':
      return isPastSession(scheduledStart) ? 'Past session' : 'Scheduled';
    default:
      return null;
  }
}

function getMentorshipStatusTone(
  status: string | null,
  scheduledStart?: string | null,
): 'neutral' | 'warning' | 'success' {
  switch (status) {
    case 'cancelled':
      return 'warning';
    case 'scheduled':
      return isPastSession(scheduledStart) ? 'neutral' : 'success';
    default:
      return 'neutral';
  }
}

function isPastSession(scheduledStart?: string | null) {
  if (!scheduledStart) return false;
  return new Date(scheduledStart).getTime() < Date.now();
}

function getStatusBadgeStyle(tone: 'neutral' | 'warning' | 'success') {
  switch (tone) {
    case 'warning':
      return styles.statusBadgeWarning;
    case 'success':
      return styles.statusBadgeSuccess;
    default:
      return styles.statusBadgeNeutral;
  }
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

function formatSessionSummary(chat: ChatItem) {
  const reference = chat.scheduledStart ?? chat.createdAt;
  if (!reference) return 'No date';

  const date = new Date(reference);
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

type ConversationRowProps = {
  name: string;
  role: string;
  statusLabel?: string | null;
  statusTone?: 'neutral' | 'warning' | 'success';
  lastMessage: string;
  time: string;
  photoUrl?: string | null;
  unread?: boolean;
  theme: (typeof Colors)[keyof typeof Colors];
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
};

function ConversationRow({
  name,
  role,
  statusLabel,
  statusTone = 'neutral',
  lastMessage,
  time,
  photoUrl,
  unread,
  theme,
  onPress,
  rightAccessory,
}: ConversationRowProps) {
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
          <View style={styles.metaRow}>
            <Text style={[styles.role, font('GlacialIndifference', '400')]}>{role}</Text>
            {statusLabel ? (
              <View style={[styles.statusBadge, getStatusBadgeStyle(statusTone)]}>
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.lastMessage, font('GlacialIndifference', '400')]} numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>

        <View style={styles.rowRight}>
          {rightAccessory ?? (
            <>
              <Text style={[styles.time, font('GlacialIndifference', '400')]}>{time}</Text>
              {unread && <View style={styles.unreadDot} />}
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MentorChatGroupRow({
  item,
  expanded,
  onToggle,
  onOpenChat,
  theme,
}: {
  item: ChatItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenChat: (item: ChatItem) => void;
  theme: (typeof Colors)[keyof typeof Colors];
}) {
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (expanded && contentHeight > 0 && isReady) {
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
    } else if (!expanded && isReady) {
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
  }, [animatedHeight, animatedOpacity, contentHeight, expanded, isReady]);

  return (
    <View>
      <View style={styles.groupedChatCard}>
        <ConversationRow
          name={item.name}
          role={item.roleLabel}
          statusLabel={item.statusLabel}
          statusTone={item.statusTone}
          lastMessage={item.lastMessage ?? 'Say hi and start the conversation!'}
          time={formatChatTimestamp(item.lastMessageAt ?? item.createdAt)}
          photoUrl={item.photoUrl}
          unread={item.unread}
          theme={theme}
          onPress={() => onOpenChat(item)}
          rightAccessory={
            <TouchableOpacity style={styles.sessionToggle} onPress={onToggle} activeOpacity={0.8}>
              <Text style={styles.sessionToggleText}>{item.sessionCount} sessions</Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#6a6150"
              />
            </TouchableOpacity>
          }
        />
      </View>

      <View
        style={styles.measureContainer}
        pointerEvents="none"
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
        <View style={styles.sessionList}>
          {(item.relatedSessions ?? []).map((session, index) => (
            <TouchableOpacity
              key={`${session.threadId}-${index}`}
              style={styles.sessionRow}
              activeOpacity={0.8}
              onPress={() => onOpenChat(session)}
            >
              <View style={styles.sessionRowText}>
                <Text style={styles.sessionRowTitle}>
                  {session.statusLabel ?? 'Session'} • {formatSessionSummary(session)}
                </Text>
                <Text style={styles.sessionRowMessage} numberOfLines={1}>
                  {session.lastMessage ?? 'Say hi and start the conversation!'}
                </Text>
              </View>
              {session.unread ? <View style={styles.sessionUnreadDot} /> : null}
            </TouchableOpacity>
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
          <View style={styles.sessionList}>
            {(item.relatedSessions ?? []).map((session, index) => (
              <TouchableOpacity
                key={`${session.threadId}-${index}`}
                style={styles.sessionRow}
                activeOpacity={0.8}
                onPress={() => onOpenChat(session)}
              >
                <View style={styles.sessionRowText}>
                  <Text style={styles.sessionRowTitle}>
                    {session.statusLabel ?? 'Session'} • {formatSessionSummary(session)}
                  </Text>
                  <Text style={styles.sessionRowMessage} numberOfLines={1}>
                    {session.lastMessage ?? 'Say hi and start the conversation!'}
                  </Text>
                </View>
                {session.unread ? <View style={styles.sessionUnreadDot} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
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
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusBadgeNeutral: {
    backgroundColor: '#ece7d8',
  },
  statusBadgeWarning: {
    backgroundColor: '#f6dddd',
  },
  statusBadgeSuccess: {
    backgroundColor: '#dceedd',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6a6150',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  groupedChatCard: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  sessionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6a6150',
  },
  sessionList: {
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f6f3ea',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionRowText: {
    flex: 1,
    paddingRight: 12,
  },
  sessionRowTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6a6150',
    marginBottom: 2,
  },
  sessionRowMessage: {
    fontSize: 12,
    color: '#777',
  },
  sessionUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#968c6c',
  },
});
