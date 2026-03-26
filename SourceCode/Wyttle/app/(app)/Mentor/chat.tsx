import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  findNodeHandle,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
} from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMessageClientId,
  fetchThreadMemberships,
  getLatestIncomingMessageId,
  getOtherParticipantMembership,
  getOutgoingReceiptState,
  markThreadDelivered,
  markThreadRead,
  sendThreadMessage,
  type MessageReceiptState,
  type ThreadMembership,
} from '../../../src/lib/chat-receipts';
import { playMessageSound } from '../../../src/lib/message-sound';
import { acceptSession, declineSession } from '../../../src/lib/sessions';
import type { Profile } from '../../../src/lib/supabase';
import { getBlockStatus, getCurrentUser, supabase } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

type Message = {
  id: string;
  clientId?: string | null;
  insertedAt?: string | null;
  from: 'me' | 'them';
  text: string;
  time: string;
  replyToMessageId?: string | null;
  replyTo?: {
    id: string;
    from: 'me' | 'them';
    text: string;
    deleted?: boolean;
  } | null;
  deleted?: boolean;
  edited?: boolean;
  sendState?: MessageReceiptState;
};

type AppTheme = typeof Colors[keyof typeof Colors];
type MentorRequestStatus = 'requested' | 'scheduled' | 'cancelled' | 'done' | null;
type MentorRequestDetails = {
  requestId: number;
  status: MentorRequestStatus;
  scheduledStart: string | null;
  description: string | null;
};

const GAP_ABOVE_KEYBOARD = 6;
const EXTRA_LIST_GAP = 16;
const SCROLL_DELAY = 80;
const NEAR_BOTTOM_THRESHOLD = 140;

export default function MentorChatScreen() {
  const params = useLocalSearchParams<{ threadId?: string; otherId?: string; name?: string }>();
  const insets = useSafeAreaInsets();

  const threadId = params.threadId ? Number(params.threadId) : null;
  const otherId = typeof params.otherId === 'string' ? params.otherId : null;
  const fallbackName =
    typeof params.name === 'string' && params.name.length > 0 ? params.name : 'Member';

  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [threadMemberships, setThreadMemberships] = useState<ThreadMembership[]>([]);
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<MentorRequestDetails | null>(null);
  const [requestActionBusy, setRequestActionBusy] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [composerHeight, setComposerHeight] = useState(72);

  const [screenY, setScreenY] = useState(0);
  const [screenHeight, setScreenHeight] = useState(0);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const rootRef = useRef<View>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const isNearBottomRef = useRef(true);
  const pendingScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = otherProfile?.full_name ?? fallbackName;
  const otherMembership = getOtherParticipantMembership(threadMemberships, meId);

  const measureRootInWindow = useCallback(() => {
    const node = findNodeHandle(rootRef.current);
    if (!node) return;

    UIManager.measureInWindow(node, (_x, y, _w, h) => {
      setScreenY(y);
      setScreenHeight(h);
    });
  }, []);

  const screenBottom = screenY + screenHeight;
  const keyboardVisible = keyboardTop !== null;

  const closedBottomOffset = Platform.OS === 'android' ? 92 : 70;
  const composerBottom = keyboardVisible
    ? Platform.OS === 'android'
      ? Math.max(GAP_ABOVE_KEYBOARD, keyboardHeight + GAP_ABOVE_KEYBOARD)
      : Math.max(0, screenBottom - keyboardTop + GAP_ABOVE_KEYBOARD)
    : closedBottomOffset + Math.max(insets.bottom, 8);

  const listBottomSpacer = composerHeight + composerBottom + EXTRA_LIST_GAP;

  const clearPendingScroll = useCallback(() => {
    if (pendingScrollTimeoutRef.current) {
      clearTimeout(pendingScrollTimeoutRef.current);
      pendingScrollTimeoutRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback((animated = true, delay = 0, force = false) => {
    if (!force && !isNearBottomRef.current) return;

    clearPendingScroll();

    const run = () => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
      });
    };

    if (delay > 0) {
      pendingScrollTimeoutRef.current = setTimeout(() => {
        pendingScrollTimeoutRef.current = null;
        run();
      }, delay);
    } else {
      run();
    }
  }, [clearPendingScroll]);

  const formatReplyPreview = (
    m: { id: string | number; sender: string; body: string | null; deleted_at?: string | null },
    currentUserId: string,
  ): Message['replyTo'] => ({
    id: String(m.id),
    from: m.sender === currentUserId ? 'me' : 'them',
    text: m.deleted_at ? 'Message deleted' : m.body ?? '',
    deleted: !!m.deleted_at,
  });

  const fetchReplyPreview = useCallback(
    async (replyToMessageId: string | number, currentUserId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender, body, deleted_at')
        .eq('id', replyToMessageId)
        .maybeSingle();

      if (error || !data) return null;
      return formatReplyPreview(data, currentUserId);
    },
    [],
  );

  const formatMessage = (m: any, currentUserId: string, replyTo: Message['replyTo'] = null): Message => {
    const deleted = !!m.deleted_at;
    const edited = !!m.edited_at;
    const replyToMessageId = m.reply_to_message_id ? String(m.reply_to_message_id) : null;

    return {
      id: String(m.id),
      clientId: m.client_id ?? null,
      insertedAt: m.inserted_at ?? null,
      from: m.sender === currentUserId ? 'me' : 'them',
      text: deleted ? 'Message deleted' : m.body,
      time: new Date(m.inserted_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      replyToMessageId,
      replyTo,
      deleted,
      edited,
      sendState: m.sender === currentUserId ? 'sent' : undefined,
    };
  };

  const hydrateMessage = useCallback(
    async (m: any, currentUserId: string) => {
      const replyTo = m.reply_to_message_id
        ? await fetchReplyPreview(m.reply_to_message_id, currentUserId)
        : null;
      return formatMessage(m, currentUserId, replyTo);
    },
    [fetchReplyPreview],
  );

  const loadThreadMembershipState = useCallback(async () => {
    if (!threadId) return;

    try {
      const memberships = await fetchThreadMemberships(threadId);
      setThreadMemberships(memberships);
    } catch (error) {
      console.warn('Failed to load thread membership state', error);
    }
  }, [threadId]);

  const upsertMessage = useCallback((nextMessage: Message) => {
    setMessages((prev) => {
      const existingIndex = prev.findIndex((message) => {
        if (message.id === nextMessage.id) return true;
        if (message.clientId && nextMessage.clientId && message.clientId === nextMessage.clientId) return true;
        return false;
      });

      if (existingIndex === -1) {
        return [...prev, nextMessage];
      }

      const updated = [...prev];
      updated[existingIndex] = nextMessage;
      return updated;
    });
  }, []);

  const loadRequestDetails = useCallback(async () => {
    if (!threadId) {
      setRequestDetails(null);
      return;
    }

    const { data, error } = await supabase
      .from('mentor_requests')
      .select('id, status, scheduled_start, description')
      .eq('thread_id', threadId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load mentorship request details', error);
      return;
    }

    setRequestDetails(
      data
        ? {
            requestId: data.id,
            status: data.status ?? null,
            scheduledStart: data.scheduled_start ?? null,
            description: data.description ?? null,
          }
        : null,
    );
  }, [threadId]);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    const load = async () => {
      if (!threadId) return;

      const me = await getCurrentUser();
      if (!isMounted) return;
      setMeId(me.id);

      if (otherId) {
        const status = await getBlockStatus(otherId);
        if (!isMounted) return;

        if (status.isBlocked) {
          setBlockedNotice(
            status.blockedByMe
              ? 'You blocked this user. Messages are hidden until you unblock them.'
              : 'This user has blocked you. Messages are unavailable.',
          );
          setMessages([]);
          return;
        }
      }

      if (otherId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, title, industry, bio, photo_url, role')
          .eq('id', otherId)
          .single();

        if (!profileError && profile && isMounted) {
          setOtherProfile(profile as Profile);
        }
      }

      const { data, error } = await supabase
        .from('messages')
        .select('id, sender, body, inserted_at, edited_at, deleted_at, reply_to_message_id, client_id')
        .eq('thread_id', threadId)
        .order('inserted_at', { ascending: true });

      if (error) {
        console.error('Failed to load messages', error);
        return;
      }

      if (!isMounted) return;

      const mapped: Message[] = await Promise.all((data ?? []).map((m) => hydrateMessage(m, me.id)));
      setMessages(mapped);
      isNearBottomRef.current = true;
      scrollToBottom(false, SCROLL_DELAY, true);
      await loadThreadMembershipState();

      const latestIncomingMessageId = getLatestIncomingMessageId(mapped);
      if (latestIncomingMessageId) {
        try {
          await markThreadRead(threadId, latestIncomingMessageId);
        } catch (receiptError) {
          console.warn('Failed to mark thread read on load', receiptError);
        }
      }

      channel = supabase
        .channel(`messages-thread-${threadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          async (payload) => {
            const row = payload.new as any;
            const hydrated = await hydrateMessage(row, me.id);
            upsertMessage(hydrated);

            if (row.sender !== me.id) {
              playMessageSound();
              try {
                if (isNearBottomRef.current) {
                  await markThreadRead(threadId, String(row.id));
                } else {
                  await markThreadDelivered(threadId, String(row.id));
                }
              } catch (receiptError) {
                console.warn('Failed to update message receipt state', receiptError);
              }
            }
            scrollToBottom(true, SCROLL_DELAY);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          async (payload) => {
            const row = payload.new as any;
            const hydrated = await hydrateMessage(row, me.id);
            upsertMessage(hydrated);

            scrollToBottom(true, SCROLL_DELAY);
          }
        )
        .subscribe();
    };

    load();

    return () => {
      isMounted = false;
      clearPendingScroll();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [clearPendingScroll, threadId, otherId, hydrateMessage, loadThreadMembershipState, scrollToBottom, upsertMessage]);

  useEffect(() => {
    void loadRequestDetails();
  }, [loadRequestDetails]);

  useEffect(() => {
    if (!threadId) return;

    const membershipChannel = supabase
      .channel(`mentor-thread-memberships-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'thread_memberships',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void loadThreadMembershipState();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(membershipChannel);
    };
  }, [threadId, loadThreadMembershipState]);

  const markVisibleMessagesRead = useCallback(async () => {
    if (!threadId) return;

    const latestIncomingMessageId = getLatestIncomingMessageId(messages);
    if (!latestIncomingMessageId) return;

    try {
      await markThreadRead(threadId, latestIncomingMessageId);
    } catch (error) {
      console.warn('Failed to mark visible messages as read', error);
    }
  }, [messages, threadId]);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`mentor-request-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mentor_requests',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void loadRequestDetails();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, loadRequestDetails]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false, 40, true);
    }
  }, [messages.length, listBottomSpacer, scrollToBottom]);

  useEffect(() => {
    if (!threadId || messages.length === 0 || !isNearBottomRef.current) return;
    void markVisibleMessagesRead();
  }, [threadId, messages.length, markVisibleMessagesRead]);

  useEffect(() => {
    measureRootInWindow();
    const t = setTimeout(measureRootInWindow, 120);
    return () => clearTimeout(t);
  }, [measureRootInWindow, scrollToBottom]);

  useEffect(() => {
    const handleKeyboardShow = (e: any) => {
      const top = e?.endCoordinates?.screenY;
      const height = e?.endCoordinates?.height;
      if (typeof top === 'number') {
        setKeyboardTop(top);
      }
      if (typeof height === 'number') {
        setKeyboardHeight(height);
      }
      setTimeout(() => {
        measureRootInWindow();
        scrollToBottom(false, 40, true);
      }, 20);
    };

    const handleKeyboardHide = () => {
      setKeyboardTop(null);
      setKeyboardHeight(0);
      setTimeout(() => {
        measureRootInWindow();
        scrollToBottom(false, 40, true);
      }, 20);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    let frameSub: { remove: () => void } | null = null;

    if (Platform.OS === 'ios') {
      frameSub = Keyboard.addListener('keyboardWillChangeFrame', (e: any) => {
        const top = e?.endCoordinates?.screenY;
        const height = e?.endCoordinates?.height;
        if (typeof top === 'number') {
          setKeyboardTop(top);
        }
        if (typeof height === 'number') {
          setKeyboardHeight(height);
        }
        setTimeout(() => {
          measureRootInWindow();
          scrollToBottom(false, 40, true);
        }, 20);
      });
    }

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [measureRootInWindow, scrollToBottom]);

  const handleSend = async () => {
    if (!threadId || !meId || !input.trim() || blockedNotice) return;

    const trimmedInput = input.trim();
    const body = trimmedInput;
    setInput('');
    isNearBottomRef.current = true;
    const activeReply = replyingToMessage;
    setReplyingToMessage(null);

    if (editingMessageId) {
      const { data, error } = await supabase
        .from('messages')
        .update({
          body,
          edited_at: new Date().toISOString(),
          deleted_at: null,
        })
        .eq('id', editingMessageId)
        .select('id, sender, body, inserted_at, edited_at, deleted_at')
        .single();

      if (error) {
        console.error('Failed to edit message', error);
        setInput(trimmedInput);
        return;
      }

      setEditingMessageId(null);
      upsertMessage(formatMessage(data, meId));
      scrollToBottom(true, SCROLL_DELAY, true);
      return;
    }

    const clientId = createMessageClientId();
    const optimisticInsertedAt = new Date().toISOString();
    const optimisticReplyPreview = activeReply
      ? {
          id: activeReply.id,
          from: activeReply.from,
          text: activeReply.text,
          deleted: activeReply.deleted,
        }
      : null;

    upsertMessage({
      id: `optimistic:${clientId}`,
      clientId,
      insertedAt: optimisticInsertedAt,
      from: 'me',
      text: body,
      time: new Date(optimisticInsertedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      replyToMessageId: activeReply?.id ?? null,
      replyTo: optimisticReplyPreview,
      deleted: false,
      edited: false,
      sendState: 'sending',
    });
    scrollToBottom(true, SCROLL_DELAY, true);

    try {
      const data = await sendThreadMessage({
        threadId,
        body,
        replyToMessageId: activeReply?.id ?? null,
        clientId,
      });

      upsertMessage(formatMessage(data, meId, optimisticReplyPreview));
      void loadThreadMembershipState();
    } catch (error) {
      console.error('Failed to send message', error);
      setInput(trimmedInput);
      setReplyingToMessage(activeReply);
      upsertMessage({
        id: `optimistic:${clientId}`,
        clientId,
        insertedAt: optimisticInsertedAt,
        from: 'me',
        text: body,
        time: new Date(optimisticInsertedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        replyToMessageId: activeReply?.id ?? null,
        replyTo: optimisticReplyPreview,
        deleted: false,
        edited: false,
        sendState: 'failed',
      });
    }
  };

  const closeMessageOptions = () => setSelectedMessage(null);

  const handleMessageLongPress = (message: Message) => {
    if (message.deleted) return;
    setSelectedMessage(message);
  };

  const handleCopyMessage = async () => {
    if (!selectedMessage) return;
    try {
      await Clipboard.setStringAsync(selectedMessage.text);
    } catch (err) {
      console.error('Failed to copy message', err);
    } finally {
      closeMessageOptions();
    }
  };

  const handleEditMessage = () => {
    if (!selectedMessage) return;
    setInput(selectedMessage.text);
    setEditingMessageId(selectedMessage.id);
    setReplyingToMessage(null);
    isNearBottomRef.current = true;
    closeMessageOptions();
    scrollToBottom(false, 40, true);
  };

  const handleReplyMessage = () => {
    if (!selectedMessage) return;
    setReplyingToMessage(selectedMessage);
    setEditingMessageId(null);
    isNearBottomRef.current = true;
    closeMessageOptions();
    scrollToBottom(false, 40, true);
  };

  const handleUnsendMessage = async () => {
    if (!selectedMessage || !meId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .update({
          body: '',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', selectedMessage.id)
        .select('id, sender, body, inserted_at, edited_at, deleted_at')
        .single();

      if (error) throw error;

      upsertMessage(formatMessage(data, meId));

      closeMessageOptions();
      scrollToBottom(true, SCROLL_DELAY, true);
    } catch (err) {
      console.error('Failed to unsend message', err);
      closeMessageOptions();
    }
  };

  const runRequestAction = useCallback(
    async (action: 'accept' | 'decline') => {
      if (!requestDetails) return;

      setRequestActionBusy(true);

      try {
        if (action === 'accept') {
          await acceptSession(requestDetails.requestId);
          Alert.alert('Session accepted', 'The session has been booked in and added to your waiting room.');
        } else {
          await declineSession(requestDetails.requestId);
          Alert.alert('Request declined', 'The session request has been declined and refunded.');
        }

        await loadRequestDetails();
      } catch (err: any) {
        Alert.alert(
          action === 'accept' ? 'Unable to accept request' : 'Unable to decline request',
          err.message ?? 'Please try again.',
        );
      } finally {
        setRequestActionBusy(false);
      }
    },
    [loadRequestDetails, requestDetails],
  );

  const confirmAcceptRequest = useCallback(() => {
    if (!requestDetails) return;

    Alert.alert(
      'Accept session request',
      `Book this session for ${formatSessionDateTime(requestDetails.scheduledStart)}?`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Accept',
          onPress: () => {
            void runRequestAction('accept');
          },
        },
      ],
    );
  }, [requestDetails, runRequestAction]);

  const confirmDeclineRequest = useCallback(() => {
    Alert.alert(
      'Decline session request',
      'This will decline the booking and refund the mentee.',
      [
        { text: 'Keep request', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            void runRequestAction('decline');
          },
        },
      ],
    );
  }, [runRequestAction]);

  const handleRootLayout = (_e: LayoutChangeEvent) => {
    measureRootInWindow();
    scrollToBottom(false, 30, true);
  };

  const handleInputContentSizeChange = (
    _e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    scrollToBottom(false, 30, true);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const wasNearBottom = isNearBottomRef.current;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

    if (!wasNearBottom && isNearBottomRef.current) {
      void markVisibleMessagesRead();
    }
  };

  return (
    <View
      ref={rootRef}
      onLayout={handleRootLayout}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <BackButton />
          <TouchableOpacity
            style={styles.headerProfileBlock}
            activeOpacity={0.8}
            disabled={!otherId}
            onPress={() => {
              if (!otherId) return;
              router.push({
                pathname: '/(app)/Mentor/profile-view',
                params: { userId: otherId },
              });
            }}
          >
            <View style={styles.headerAvatar}>
              {otherProfile?.photo_url ? (
                <Image source={{ uri: otherProfile.photo_url }} style={styles.headerAvatarImage} />
              ) : (
                <Text style={styles.headerAvatarInitial}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.headerTextBlock}>
              <ScreenHeader
                title={displayName}
                subtitle="Mentee conversation"
                logo={false}
              />
            </View>
          </TouchableOpacity>
        </View>

        {requestDetails ? (
          <View style={[styles.requestPanel, { backgroundColor: theme.card, borderColor: theme.border ?? '#d9d3c3' }]}>
            <View style={styles.requestPanelHeader}>
              <View style={[styles.requestStatusBadge, getRequestStatusBadgeStyle(requestDetails.status)]}>
                <Text style={styles.requestStatusBadgeText}>{getRequestStatusLabel(requestDetails.status)}</Text>
              </View>
              <Text style={styles.requestPanelTime}>{formatSessionDateTime(requestDetails.scheduledStart)}</Text>
            </View>

            <Text style={[styles.requestPanelDescription, { color: theme.text }]}>
              {requestDetails.description?.trim() || 'No booking notes were included with this request.'}
            </Text>

            {requestDetails.status === 'requested' ? (
              <View style={styles.requestPanelActions}>
                <TouchableOpacity
                  style={[styles.requestActionButton, styles.requestActionButtonDanger]}
                  activeOpacity={0.8}
                  onPress={confirmDeclineRequest}
                  disabled={requestActionBusy}
                >
                  <Text style={styles.requestActionButtonDangerText}>
                    {requestActionBusy ? 'Working...' : 'Decline'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.requestActionButton, styles.requestActionButtonPrimary, requestActionBusy && styles.requestActionButtonDisabled]}
                  activeOpacity={0.8}
                  onPress={confirmAcceptRequest}
                  disabled={requestActionBusy}
                >
                  <Text style={styles.requestActionButtonPrimaryText}>
                    {requestActionBusy ? 'Working...' : 'Accept'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.requestPanelNote}>{getRequestStatusNote(requestDetails.status)}</Text>
            )}
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onLayout={() => {
            scrollToBottom(false, 50, true);
          }}
          onContentSizeChange={() => {
            scrollToBottom(false, 20, true);
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: listBottomSpacer }} />}
          ListEmptyComponent={
            blockedNotice ? (
              <View style={styles.blockedState}>
                <Text style={[styles.blockedText, { color: theme.text }]}>{blockedNotice}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              theme={theme}
              otherMembership={otherMembership}
              onLongPress={handleMessageLongPress}
            />
          )}
        />

        <View
          onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
          style={[
            styles.composerWrap,
            {
              bottom: composerBottom,
            },
          ]}
        >
          <View style={[styles.composer, { backgroundColor: theme.card }]}>
            {blockedNotice ? (
              <Text style={[styles.blockedComposerText, { color: theme.text }]}>{blockedNotice}</Text>
            ) : null}
            {!blockedNotice ? (
              <>
            {replyingToMessage ? (
              <View style={styles.replyPreview}>
                <View style={styles.replyAccent} />
                <View style={styles.replyTextWrap}>
                  <Text style={[styles.replyLabel, { color: theme.text }]}>Replying to</Text>
                  <Text numberOfLines={1} style={[styles.replySnippet, { color: theme.text }]}>
                    {replyingToMessage.text}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setReplyingToMessage(null)}
                  style={styles.replyDismiss}
                >
                  <Text style={styles.replyDismissText}>x</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.composerRow}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={
                  editingMessageId
                    ? 'Edit message...'
                    : replyingToMessage
                      ? 'Write a reply...'
                      : 'Message...'
                }
                placeholderTextColor="#7f8186"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={2000}
                returnKeyType="default"
                textAlignVertical="top"
                onFocus={() => {
                  isNearBottomRef.current = true;
                  measureRootInWindow();
                  scrollToBottom(false, 80, true);
                }}
                onContentSizeChange={handleInputContentSizeChange}
              />

              <TouchableOpacity
                style={[styles.sendButton, { opacity: input.trim() ? 1 : 0.5 }]}
                activeOpacity={0.8}
                onPress={handleSend}
                disabled={!input.trim()}
              >
                <Text style={styles.sendButtonText}>
                  {editingMessageId ? 'Save' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <Modal
        visible={selectedMessage !== null}
        transparent
        animationType="fade"
        onRequestClose={closeMessageOptions}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={closeMessageOptions}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={[styles.modalCard, { backgroundColor: theme.card }]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>Message options</Text>
            <TouchableOpacity style={styles.modalAction} onPress={handleCopyMessage}>
              <Text style={[styles.modalActionText, { color: theme.text }]}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalAction} onPress={handleReplyMessage}>
              <Text style={[styles.modalActionText, { color: theme.text }]}>Reply</Text>
            </TouchableOpacity>
            {selectedMessage?.from === 'me' ? (
              <TouchableOpacity style={styles.modalAction} onPress={handleEditMessage}>
                <Text style={[styles.modalActionText, { color: theme.text }]}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            {selectedMessage?.from === 'me' ? (
              <TouchableOpacity style={styles.modalAction} onPress={handleUnsendMessage}>
                <Text style={[styles.modalActionText, styles.modalActionDanger]}>Unsend</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.modalCancel} onPress={closeMessageOptions}>
              <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

type MessageBubbleProps = {
  message: Message;
  theme: AppTheme;
  otherMembership?: Pick<ThreadMembership, 'last_delivered_message_id' | 'last_read_message_id'> | null;
  onLongPress?: (message: Message) => void;
};

function MessageBubble({ message, theme, otherMembership, onLongPress }: MessageBubbleProps) {
  const isMe = message.from === 'me';
  const timeColor = isMe ? 'rgba(255,255,255,0.72)' : '#8a8f98';
  const replyPreviewColor = isMe ? 'rgba(255,255,255,0.18)' : '#d9dce3';
  const replyTextColor = isMe ? 'rgba(255,255,255,0.82)' : '#5c6470';
  const receiptState = isMe
    ? getOutgoingReceiptState(message.id, otherMembership, message.sendState)
    : null;
  const receiptLabel = receiptState ? getReceiptStateLabel(receiptState) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={() => onLongPress?.(message)}
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
          isMe ? styles.bubbleMe : [styles.bubbleThem, { backgroundColor: theme.card }],
          message.deleted && styles.deletedBubble,
        ]}
      >
        {message.replyTo ? (
          <View
            style={[
              styles.replyBubble,
              { backgroundColor: replyPreviewColor },
            ]}
          >
            <Text style={[styles.replyBubbleLabel, { color: replyTextColor }]}>
              {message.replyTo.from === 'me' ? 'You' : 'Reply'}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.replyBubbleText, { color: replyTextColor }]}
            >
              {message.replyTo.text}
            </Text>
          </View>
        ) : null}
        <Text
          style={[
            styles.bubbleText,
            {
              color: message.deleted ? '#8a8f98' : isMe ? '#fff' : theme.text,
              fontStyle: message.deleted ? 'italic' : 'normal',
            },
          ]}
        >
          {message.text}
        </Text>

        <View style={styles.metaRow}>
          {message.edited && !message.deleted ? (
            <Text style={[styles.editedText, { color: timeColor }]}>Edited</Text>
          ) : null}
          {isMe && receiptLabel ? (
            <Text style={[styles.receiptText, { color: timeColor }]}>{receiptLabel}</Text>
          ) : null}
          <Text style={[styles.bubbleTime, { color: timeColor }]}>{message.time}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getReceiptStateLabel(state: MessageReceiptState) {
  switch (state) {
    case 'sending':
      return 'Sending';
    case 'delivered':
      return 'Delivered';
    case 'read':
      return 'Read';
    case 'failed':
      return 'Failed';
    default:
      return 'Sent';
  }
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

function getRequestStatusLabel(status: MentorRequestStatus) {
  switch (status) {
    case 'scheduled':
      return 'Accepted';
    case 'cancelled':
      return 'Declined';
    case 'done':
      return 'Completed';
    default:
      return 'Pending';
  }
}

function getRequestStatusNote(status: MentorRequestStatus) {
  switch (status) {
    case 'scheduled':
      return 'This session is booked in. It will appear in the waiting room near the start time.';
    case 'cancelled':
      return 'This request has been declined. The mentee has been refunded.';
    case 'done':
      return 'This session has already been completed.';
    default:
      return 'This request is waiting for your decision.';
  }
}

function getRequestStatusBadgeStyle(status: MentorRequestStatus) {
  switch (status) {
    case 'scheduled':
      return styles.requestStatusBadgeSuccess;
    case 'cancelled':
      return styles.requestStatusBadgeWarning;
    case 'done':
      return styles.requestStatusBadgeNeutral;
    default:
      return styles.requestStatusBadgePending;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  container: {
    ...commonStyles.screen,
    flex: 1,
    paddingHorizontal: 18,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  headerProfileBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    flex: 1,
  },

  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },

  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },

  headerAvatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  headerTextBlock: {
    flex: 1,
  },

  requestPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  requestPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  requestStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  requestStatusBadgePending: {
    backgroundColor: '#f3ede2',
  },
  requestStatusBadgeSuccess: {
    backgroundColor: '#e4f3ea',
  },
  requestStatusBadgeWarning: {
    backgroundColor: '#faecec',
  },
  requestStatusBadgeNeutral: {
    backgroundColor: '#eceff4',
  },
  requestStatusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5f5848',
  },
  requestPanelTime: {
    fontSize: 12,
    color: '#777',
    flexShrink: 1,
    textAlign: 'right',
  },
  requestPanelDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  requestPanelActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestActionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestActionButtonPrimary: {
    backgroundColor: '#333f5c',
  },
  requestActionButtonPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  requestActionButtonDanger: {
    backgroundColor: '#faecec',
  },
  requestActionButtonDangerText: {
    color: '#b43f3f',
    fontSize: 13,
    fontWeight: '700',
  },
  requestActionButtonDisabled: {
    opacity: 0.7,
  },
  requestPanelNote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6b6f78',
  },

  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  blockedState: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.8,
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
    borderBottomLeftRadius: 4,
  },

  deletedBubble: {
    opacity: 0.75,
  },

  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  replyBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  replyBubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyBubbleText: {
    fontSize: 12,
    lineHeight: 16,
  },

  metaRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  editedText: {
    fontSize: 10,
    marginRight: 6,
  },

  receiptText: {
    fontSize: 10,
    marginRight: 6,
  },

  bubbleTime: {
    fontSize: 10,
  },

  composerWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    backgroundColor: 'transparent',
  },

  composer: {
    alignItems: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
  },
  blockedComposerText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.85,
  },

  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000014',
  },
  replyAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 999,
    backgroundColor: '#968c6c',
    marginRight: 10,
  },
  replyTextWrap: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replySnippet: {
    fontSize: 13,
    opacity: 0.72,
  },
  replyDismiss: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  replyDismissText: {
    fontSize: 16,
    color: '#8a8f98',
    fontWeight: '600',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    maxHeight: 120,
  },

  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#968c6c',
    alignSelf: 'flex-end',
  },

  sendButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 24, 0.38)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    borderRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  modalTitle: {
    fontSize: 13,
    opacity: 0.65,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalAction: {
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000014',
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalActionDanger: {
    color: '#c43b3b',
  },
  modalCancel: {
    paddingTop: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
