import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { setMentorBadgeState } from '../../../src/lib/nav-badge-state';
import { acceptSession, declineSession } from '../../../src/lib/sessions';
import { fetchBlockedUserIds, supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type MentorRequestStatus = 'requested' | 'scheduled' | 'cancelled' | 'done' | null;

type MentorChatItem = {
  requestId: number;
  threadId: number;
  otherUserId: string;
  name: string;
  photoUrl: string | null;
  lastMessageId?: string | null;
  lastMessageSender: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  proposedAt: string | null;
  scheduledStart: string | null;
  description: string | null;
  status: MentorRequestStatus;
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
              No Messages Yet
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
                role="Mentee"
                lastMessage={getFallbackChatPreview(item)}
                time={formatChatTimestamp(item.lastMessageAt ?? item.scheduledStart ?? item.proposedAt)}
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
                  lastMessage={getFallbackChatPreview(item)}
                  time={formatChatTimestamp(item.lastMessageAt ?? item.scheduledStart ?? item.proposedAt)}
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
  const [requestActionId, setRequestActionId] = useState<number | null>(null);
  const isScreenFocusedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

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
        setChats([]);
        setMentorBadgeState({ connections: 0 });
        return;
      }

      const blockedIds = new Set(await fetchBlockedUserIds());

      const { data: requests, error: reqError } = await supabase
        .from('mentor_requests')
        .select('id, mentee, mentor, thread_id, proposed_at, scheduled_start, description, status')
        .eq('mentor', user.id)
        .not('thread_id', 'is', null)
        .order('proposed_at', { ascending: false });

      if (reqError) throw reqError;

      const visibleRequests = (requests ?? []).filter((request: any) => !blockedIds.has(request.mentee));

      if (visibleRequests.length === 0) {
        setChats([]);
        setMentorBadgeState({ connections: 0 });
        return;
      }

      const menteeIds = Array.from(new Set(visibleRequests.map((request: any) => request.mentee)));

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url, hidden')
        .in('id', menteeIds);

      if (profileError) throw profileError;

      const profileMap: Record<string, { name: string; photoUrl: string | null }> = {};
      (profiles ?? []).forEach((profile: any) => {
        if (profile.hidden) return;
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

      const chatItemsUnsorted: MentorChatItem[] = visibleRequests.filter((request: any) => Boolean(profileMap[request.mentee])).map((request: any) => {
        const profile = profileMap[request.mentee] ?? { name: 'Mentee', photoUrl: null };
        const last = request.thread_id ? lastByThread[request.thread_id] : undefined;
        const unread = !!(
          request.thread_id &&
          last?.id &&
          last?.sender &&
          last.sender !== user.id &&
          !hasLocalReadReached(localReadMap[request.thread_id], last.id)
        );

        return {
          requestId: request.id,
          threadId: request.thread_id!,
          otherUserId: request.mentee,
          name: profile.name,
          photoUrl: profile.photoUrl,
          lastMessageId: last?.id ?? null,
          lastMessageSender: last?.sender ?? null,
          lastMessage: last?.body ?? null,
          lastMessageAt: last?.inserted_at ?? null,
          proposedAt: request.proposed_at ?? null,
          scheduledStart: request.scheduled_start ?? null,
          description: request.description ?? null,
          status: request.status ?? null,
          unread,
        };
      });

      const sortedChatItems = chatItemsUnsorted.sort((a, b) => {
        const aDate = a.lastMessageAt ?? a.proposedAt ?? '';
        const bDate = b.lastMessageAt ?? b.proposedAt ?? '';
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });

      setChats(sortedChatItems);
      setMentorBadgeState({
        connections: sortedChatItems.filter((chat) => chat.status === 'requested' || chat.unread).length,
      });
    } catch (err: any) {
      console.error('Failed to load mentor connections', err);
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
          .channel(`mentor-connections-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mentor_requests',
              filter: `mentor=eq.${user.id}`,
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
        console.warn('Failed to set up realtime for mentor connections', err);
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
      void load({ quiet: true });
      return () => {
        isScreenFocusedRef.current = false;
      };
    }, [load]),
  );

  const filteredChats = chats.filter((chat) => {
    if (chatFilter === 'unread') {
      return chat.unread;
    }
    return true;
  });

  const pendingRequests = filteredChats.filter((chat) => chat.status === 'requested');
  const conversationChats = filteredChats.filter((chat) => chat.status !== 'requested');
  const activeChats = conversationChats.filter(hasLastMessage);
  const emptyChats = conversationChats.filter((chat) => !hasLastMessage(chat));
  const showEmptyChatsDropdown = activeChats.length > 0 && emptyChats.length > 0;
  const visibleChats = showEmptyChatsDropdown ? activeChats : conversationChats;
  const groupedChats = groupChatsByDate(visibleChats);

  const clearThreadUnread = useCallback((threadId: number) => {
    setChats((current) =>
      current.map((chat) => (chat.threadId === threadId ? { ...chat, unread: false } : chat)),
    );
  }, []);

  const openChat = (item: MentorChatItem) => {
    if (item.unread && chatFilter === 'unread') {
      setChatFilter('all');
    }

    if (item.unread && item.lastMessageId) {
      clearThreadUnread(item.threadId);
      void markThreadReadLocally(item.threadId, item.lastMessageId);
      void markThreadRead(item.threadId, item.lastMessageId).catch((error) => {
        console.warn('Failed to mark mentor chat read when opening thread', error);
        void load({ quiet: true });
      });
    }

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

  const handleRequestAction = useCallback(
    async (item: MentorChatItem, action: 'accept' | 'decline') => {
      setRequestActionId(item.requestId);

      try {
        if (action === 'accept') {
          await acceptSession(item.requestId);
          Alert.alert('Session accepted', `${item.name}'s session has been booked in.`);
        } else {
          await declineSession(item.requestId);
          Alert.alert('Request declined', 'Tokens have been refunded to the mentee.');
        }

        await load();
      } catch (err: any) {
        Alert.alert(
          action === 'accept' ? 'Unable to accept request' : 'Unable to decline request',
          err.message ?? 'Please try again.',
        );
      } finally {
        setRequestActionId(null);
      }
    },
    [load],
  );

  const confirmAcceptRequest = useCallback(
    (item: MentorChatItem) => {
      Alert.alert(
        'Accept session request',
        `Book ${item.name} for ${formatSessionDateTime(item.scheduledStart)}?`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Accept',
            onPress: () => {
              void handleRequestAction(item, 'accept');
            },
          },
        ],
      );
    },
    [handleRequestAction],
  );

  const confirmDeclineRequest = useCallback(
    (item: MentorChatItem) => {
      Alert.alert(
        'Decline session request',
        'This will decline the booking and refund the mentee.',
        [
          { text: 'Keep request', style: 'cancel' },
          {
            text: 'Decline',
            style: 'destructive',
            onPress: () => {
              void handleRequestAction(item, 'decline');
            },
          },
        ],
      );
    },
    [handleRequestAction],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Connections" subtitle="Manage session requests and mentee chats." />

      {loading && (
        <View style={{ paddingVertical: 16 }}>
          <ActivityIndicator />
        </View>
      )}

      {error && <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text>}

      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {pendingRequests.length > 0 && (
          <View style={styles.requestSection}>
            <View style={styles.requestHeaderRow}>
              <ThemedText style={[styles.sectionTitle, font('GlacialIndifference', '800')]}>
                Session Requests
              </ThemedText>
              <View style={styles.requestCountBadge}>
                <Text style={styles.requestCountBadgeText}>{pendingRequests.length}</Text>
              </View>
            </View>

            {pendingRequests.map((item) => (
              <SessionRequestCard
                key={`request-${item.requestId}`}
                item={item}
                busy={requestActionId === item.requestId}
                theme={theme}
                onMessage={() => openChat(item)}
                onAccept={() => confirmAcceptRequest(item)}
                onDecline={() => confirmDeclineRequest(item)}
              />
            ))}
          </View>
        )}

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
            {chatFilter === 'unread'
              ? 'No unread chats right now.'
              : pendingRequests.length > 0
                ? 'No accepted session chats yet.'
                : 'No active mentee chats yet.'}
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
                    lastMessage={item.lastMessage ?? getFallbackChatPreview(item)}
                    time={formatChatTimestamp(item.lastMessageAt ?? item.scheduledStart ?? item.proposedAt)}
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

function getFallbackChatPreview(chat: MentorChatItem) {
  switch (chat.status) {
    case 'scheduled':
      return 'Session scheduled';
    case 'cancelled':
      return 'Session declined';
    case 'done':
      return 'Session completed';
    default:
      return 'No messages yet';
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

function formatSessionDateTime(timestamp: string | null) {
  if (!timestamp) return 'Requested time unavailable';

  const date = new Date(timestamp);
  return `${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })} at ${date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
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

function SessionRequestCard({
  item,
  busy,
  theme,
  onMessage,
  onAccept,
  onDecline,
}: {
  item: MentorChatItem;
  busy: boolean;
  theme: (typeof Colors)[keyof typeof Colors];
  onMessage: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const initials = item.name
    .split(' ')
    .map((segment) => segment.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.requestCard, { backgroundColor: theme.card, borderColor: theme.border ?? '#d9d3c3' }]}>
      <View style={styles.requestCardHeader}>
        <View style={styles.avatar}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        <View style={styles.requestCardMeta}>
          <Text style={[styles.name, font('GlacialIndifference', '800'), { color: theme.text }]}>
            {item.name}
          </Text>
          <Text style={styles.requestSubtitle}>Pending approval</Text>
          <Text style={styles.requestSchedule}>{formatSessionDateTime(item.scheduledStart)}</Text>
        </View>
      </View>

      <Text style={[styles.requestDescription, { color: theme.text }]} numberOfLines={3}>
        {item.description?.trim() || 'No booking notes were included with this request.'}
      </Text>

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.requestButton, styles.requestButtonSecondary]}
          activeOpacity={0.8}
          onPress={onMessage}
          disabled={busy}
        >
          <Text style={styles.requestButtonSecondaryText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.requestButton, styles.requestButtonDanger]}
          activeOpacity={0.8}
          onPress={onDecline}
          disabled={busy}
        >
          <Text style={styles.requestButtonDangerText}>{busy ? 'Working...' : 'Decline'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.requestButton, styles.requestButtonPrimary, busy && styles.requestButtonDisabled]}
          activeOpacity={0.8}
          onPress={onAccept}
          disabled={busy}
        >
          <Text style={styles.requestButtonPrimaryText}>{busy ? 'Working...' : 'Accept'}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  requestSection: {
    marginBottom: 18,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  requestCountBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#d64545',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestCardMeta: {
    flex: 1,
  },
  requestSubtitle: {
    fontSize: 12,
    color: '#968c6c',
    fontWeight: '700',
    marginBottom: 2,
  },
  requestSchedule: {
    fontSize: 13,
    color: '#666',
  },
  requestDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestButtonPrimary: {
    backgroundColor: '#333f5c',
  },
  requestButtonPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  requestButtonSecondary: {
    backgroundColor: '#f3ede2',
  },
  requestButtonSecondaryText: {
    color: '#5f5848',
    fontSize: 13,
    fontWeight: '700',
  },
  requestButtonDanger: {
    backgroundColor: '#faecec',
  },
  requestButtonDangerText: {
    color: '#b43f3f',
    fontSize: 13,
    fontWeight: '700',
  },
  requestButtonDisabled: {
    opacity: 0.7,
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
