import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';

export type ThreadMembership = {
  thread_id: number;
  user_id: string;
  last_delivered_message_id: string | null;
  last_read_message_id: string | null;
  last_seen_at: string | null;
  updated_at?: string | null;
};

export type MessageReceiptState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type SentMessageRow = {
  id: string | number;
  sender: string;
  body: string;
  inserted_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_message_id?: string | number | null;
  client_id?: string | null;
};

export function createMessageClientId(): string {
  return Crypto.randomUUID();
}

export function compareMessageIds(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const left = String(a);
  const right = String(b);

  if (left.length !== right.length) {
    return left.length - right.length;
  }

  return left.localeCompare(right);
}

export function hasCursorReachedMessage(
  cursorMessageId?: string | null,
  messageId?: string | null,
): boolean {
  if (!cursorMessageId || !messageId) return false;
  return compareMessageIds(cursorMessageId, messageId) >= 0;
}

export function getOutgoingReceiptState(
  messageId: string | null | undefined,
  membership: Pick<ThreadMembership, 'last_delivered_message_id' | 'last_read_message_id'> | null | undefined,
  sendState: MessageReceiptState | null | undefined,
): MessageReceiptState {
  if (sendState === 'sending' || sendState === 'failed') {
    return sendState;
  }

  if (membership?.last_read_message_id && hasCursorReachedMessage(membership.last_read_message_id, messageId)) {
    return 'read';
  }

  if (
    membership?.last_delivered_message_id &&
    hasCursorReachedMessage(membership.last_delivered_message_id, messageId)
  ) {
    return 'delivered';
  }

  return 'sent';
}

export function getLatestIncomingMessageId<T extends { id: string; from: 'me' | 'them' }>(
  messages: T[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.from === 'them') {
      return message.id;
    }
  }

  return null;
}

export function getOtherParticipantMembership(
  memberships: ThreadMembership[],
  currentUserId: string | null,
): ThreadMembership | null {
  if (!currentUserId) return null;
  return memberships.find((membership) => membership.user_id !== currentUserId) ?? null;
}

export async function ensureThreadMemberships(threadId: number): Promise<void> {
  const { error } = await supabase.rpc('ensure_thread_memberships', {
    p_thread_id: threadId,
  });

  if (error) throw error;
}

export async function ensureThreadMembershipsForIds(threadIds: number[]): Promise<void> {
  const uniqueIds = Array.from(new Set(threadIds.filter((threadId) => Number.isFinite(threadId))));
  if (uniqueIds.length === 0) return;

  await Promise.allSettled(uniqueIds.map((threadId) => ensureThreadMemberships(threadId)));
}

export async function fetchThreadMemberships(threadId: number): Promise<ThreadMembership[]> {
  await ensureThreadMemberships(threadId);

  const { data, error } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('thread_id', threadId);

  if (error) throw error;
  return (data as ThreadMembership[]) ?? [];
}

export async function fetchUserThreadMembershipMap(
  threadIds: number[],
  userId: string,
): Promise<Record<number, ThreadMembership>> {
  const uniqueIds = Array.from(new Set(threadIds.filter((threadId) => Number.isFinite(threadId))));
  if (uniqueIds.length === 0) return {};

  await ensureThreadMembershipsForIds(uniqueIds);

  const { data, error } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('user_id', userId)
    .in('thread_id', uniqueIds);

  if (error) throw error;

  const membershipMap: Record<number, ThreadMembership> = {};
  ((data as ThreadMembership[]) ?? []).forEach((membership) => {
    membershipMap[membership.thread_id] = membership;
  });

  return membershipMap;
}

export async function markThreadDelivered(
  threadId: number,
  messageId: string | null | undefined,
): Promise<void> {
  if (!messageId) return;

  const { error } = await supabase.rpc('mark_thread_delivered', {
    p_thread_id: threadId,
    p_message_id: messageId,
  });

  if (error) throw error;
}

export async function markThreadRead(
  threadId: number,
  messageId: string | null | undefined,
): Promise<void> {
  if (!messageId) return;

  const { error } = await supabase.rpc('mark_thread_read', {
    p_thread_id: threadId,
    p_message_id: messageId,
  });

  if (error) throw error;
}

export async function sendThreadMessage(params: {
  threadId: number;
  body: string;
  replyToMessageId?: string | null;
  clientId?: string | null;
}): Promise<SentMessageRow> {
  const {
    threadId,
    body,
    replyToMessageId = null,
    clientId = createMessageClientId(),
  } = params;

  const { data, error } = await supabase
    .rpc('send_message', {
      p_thread_id: threadId,
      p_body: body,
      p_reply_to_message_id: replyToMessageId,
      p_client_id: clientId,
    })
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to send message');
  }

  return data as SentMessageRow;
}
