import * as Crypto from 'expo-crypto';

import { supabase } from './supabase';

const ensuredThreadMembershipIds = new Set<number>();
const localReceiptOverrides = new Map<
  number,
  { last_delivered_message_id: string | null; last_read_message_id: string | null }
>();
const localReceiptListeners = new Set<(threadId: number) => void>();

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

function normalizeMessageId(messageId: string | number | null | undefined): number | null {
  if (messageId == null) return null;

  const normalized = typeof messageId === 'number' ? messageId : Number(messageId);
  if (!Number.isFinite(normalized)) {
    return null;
  }

  return normalized;
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

function emitLocalReceiptUpdate(threadId: number) {
  localReceiptListeners.forEach((listener) => {
    try {
      listener(threadId);
    } catch (error) {
      console.warn('Local receipt listener failed', error);
    }
  });
}

function recordLocalReceiptOverride(params: {
  threadId: number;
  deliveredMessageId?: string | number | null;
  readMessageId?: string | number | null;
}) {
  const { threadId, deliveredMessageId = null, readMessageId = null } = params;
  const existing = localReceiptOverrides.get(threadId) ?? {
    last_delivered_message_id: null,
    last_read_message_id: null,
  };

  const nextDeliveredMessageId = normalizeMessageId(deliveredMessageId);
  const nextReadMessageId = normalizeMessageId(readMessageId);

  const mergedDeliveredMessageId =
    nextDeliveredMessageId == null
      ? existing.last_delivered_message_id
      : hasCursorReachedMessage(String(existing.last_delivered_message_id ?? ''), String(nextDeliveredMessageId))
        ? existing.last_delivered_message_id
        : String(nextDeliveredMessageId);

  const mergedReadMessageId =
    nextReadMessageId == null
      ? existing.last_read_message_id
      : hasCursorReachedMessage(String(existing.last_read_message_id ?? ''), String(nextReadMessageId))
        ? existing.last_read_message_id
        : String(nextReadMessageId);

  localReceiptOverrides.set(threadId, {
    last_delivered_message_id: mergedDeliveredMessageId,
    last_read_message_id: mergedReadMessageId,
  });
  emitLocalReceiptUpdate(threadId);
}

function applyLocalReceiptOverride(
  membership: ThreadMembership | undefined,
  threadId: number,
  userId: string,
): ThreadMembership | undefined {
  const override = localReceiptOverrides.get(threadId);
  if (!override) return membership;

  const baseMembership: ThreadMembership =
    membership ??
    ({
      thread_id: threadId,
      user_id: userId,
      last_delivered_message_id: null,
      last_read_message_id: null,
      last_seen_at: null,
      updated_at: null,
    } as ThreadMembership);

  return {
    ...baseMembership,
    last_delivered_message_id:
      override.last_delivered_message_id && !hasCursorReachedMessage(baseMembership.last_delivered_message_id, override.last_delivered_message_id)
        ? override.last_delivered_message_id
        : baseMembership.last_delivered_message_id,
    last_read_message_id:
      override.last_read_message_id && !hasCursorReachedMessage(baseMembership.last_read_message_id, override.last_read_message_id)
        ? override.last_read_message_id
        : baseMembership.last_read_message_id,
  };
}

export function subscribeToLocalReceiptUpdates(listener: (threadId: number) => void): () => void {
  localReceiptListeners.add(listener);
  return () => {
    localReceiptListeners.delete(listener);
  };
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

async function upsertOwnThreadMembershipReceipt(params: {
  threadId: number;
  deliveredMessageId?: string | number | null;
  readMessageId?: string | number | null;
}): Promise<void> {
  const { threadId, deliveredMessageId = null, readMessageId = null } = params;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error('Not authenticated');

  const normalizedDeliveredMessageId = normalizeMessageId(deliveredMessageId);
  const normalizedReadMessageId = normalizeMessageId(readMessageId);

  const { data: existing, error: existingError } = await supabase
    .from('thread_memberships')
    .select('last_delivered_message_id, last_read_message_id')
    .eq('thread_id', threadId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  const nextDeliveredMessageId =
    normalizedDeliveredMessageId == null
      ? normalizeMessageId(existing?.last_delivered_message_id ?? null)
      : Math.max(
          normalizedDeliveredMessageId,
          normalizeMessageId(existing?.last_delivered_message_id ?? null) ?? normalizedDeliveredMessageId,
        );

  const nextReadMessageId =
    normalizedReadMessageId == null
      ? normalizeMessageId(existing?.last_read_message_id ?? null)
      : Math.max(
          normalizedReadMessageId,
          normalizeMessageId(existing?.last_read_message_id ?? null) ?? normalizedReadMessageId,
        );

  const { error: upsertError } = await supabase.from('thread_memberships').upsert(
    {
      thread_id: threadId,
      user_id: user.id,
      last_delivered_message_id: nextDeliveredMessageId,
      last_read_message_id: nextReadMessageId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'thread_id,user_id' },
  );

  if (upsertError) throw upsertError;
}

export async function ensureThreadMemberships(threadId: number): Promise<void> {
  if (ensuredThreadMembershipIds.has(threadId)) {
    return;
  }

  const { error } = await supabase.rpc('ensure_thread_memberships', {
    p_thread_id: threadId,
  });

  if (error) throw error;
  ensuredThreadMembershipIds.add(threadId);
}

export async function ensureThreadMembershipsForIds(threadIds: number[]): Promise<void> {
  const uniqueIds = Array.from(
    new Set(
      threadIds.filter(
        (threadId) => Number.isFinite(threadId) && !ensuredThreadMembershipIds.has(threadId),
      ),
    ),
  );
  if (uniqueIds.length === 0) return;

  await Promise.allSettled(uniqueIds.map((threadId) => ensureThreadMemberships(threadId)));
}

export async function fetchThreadMemberships(threadId: number): Promise<ThreadMembership[]> {
  const { data, error } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('thread_id', threadId);

  if (error) throw error;

  const memberships = (data as ThreadMembership[]) ?? [];
  if (memberships.length > 0) {
    ensuredThreadMembershipIds.add(threadId);
    return memberships;
  }

  await ensureThreadMemberships(threadId);

  const { data: ensuredData, error: ensuredError } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('thread_id', threadId);

  if (ensuredError) throw ensuredError;

  const ensuredMemberships = (ensuredData as ThreadMembership[]) ?? [];
  if (ensuredMemberships.length > 0) {
    ensuredThreadMembershipIds.add(threadId);
  }

  return ensuredMemberships;
}

export async function fetchUserThreadMembershipMap(
  threadIds: number[],
  userId: string,
): Promise<Record<number, ThreadMembership>> {
  const uniqueIds = Array.from(new Set(threadIds.filter((threadId) => Number.isFinite(threadId))));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('user_id', userId)
    .in('thread_id', uniqueIds);

  if (error) throw error;

  const membershipMap: Record<number, ThreadMembership> = {};
  ((data as ThreadMembership[]) ?? []).forEach((membership) => {
    membershipMap[membership.thread_id] = membership;
    ensuredThreadMembershipIds.add(membership.thread_id);
  });

  const missingThreadIds = uniqueIds.filter((threadId) => !membershipMap[threadId]);
  if (missingThreadIds.length === 0) {
    return membershipMap;
  }

  await ensureThreadMembershipsForIds(missingThreadIds);

  const { data: ensuredData, error: ensuredError } = await supabase
    .from('thread_memberships')
    .select('thread_id, user_id, last_delivered_message_id, last_read_message_id, last_seen_at, updated_at')
    .eq('user_id', userId)
    .in('thread_id', missingThreadIds);

  if (ensuredError) throw ensuredError;

  ((ensuredData as ThreadMembership[]) ?? []).forEach((membership) => {
    membershipMap[membership.thread_id] = membership;
    ensuredThreadMembershipIds.add(membership.thread_id);
  });

  uniqueIds.forEach((threadId) => {
    const mergedMembership = applyLocalReceiptOverride(membershipMap[threadId], threadId, userId);
    if (mergedMembership) {
      membershipMap[threadId] = mergedMembership;
    }
  });

  return membershipMap;
}

export async function markThreadDelivered(
  threadId: number,
  messageId: string | number | null | undefined,
): Promise<void> {
  const normalizedMessageId = normalizeMessageId(messageId);
  if (normalizedMessageId == null) return;
  recordLocalReceiptOverride({
    threadId,
    deliveredMessageId: normalizedMessageId,
  });

  const { error } = await supabase.rpc('mark_thread_delivered', {
    p_thread_id: threadId,
    p_message_id: normalizedMessageId,
  });

  if (error) {
    console.warn('mark_thread_delivered RPC failed, falling back to direct membership update', error);
  }

  await upsertOwnThreadMembershipReceipt({
    threadId,
    deliveredMessageId: normalizedMessageId,
  });
}

export async function markThreadRead(
  threadId: number,
  messageId: string | number | null | undefined,
): Promise<void> {
  const normalizedMessageId = normalizeMessageId(messageId);
  if (normalizedMessageId == null) return;
  recordLocalReceiptOverride({
    threadId,
    deliveredMessageId: normalizedMessageId,
    readMessageId: normalizedMessageId,
  });

  const { error } = await supabase.rpc('mark_thread_read', {
    p_thread_id: threadId,
    p_message_id: normalizedMessageId,
  });

  if (error) {
    console.warn('mark_thread_read RPC failed, falling back to direct membership update', error);
  }

  await upsertOwnThreadMembershipReceipt({
    threadId,
    deliveredMessageId: normalizedMessageId,
    readMessageId: normalizedMessageId,
  });
}

export async function sendThreadMessage(params: {
  threadId: number;
  body: string;
  replyToMessageId?: string | number | null;
  clientId?: string | null;
}): Promise<SentMessageRow> {
  const {
    threadId,
    body,
    replyToMessageId = null,
    clientId = createMessageClientId(),
  } = params;
  const normalizedReplyToMessageId = normalizeMessageId(replyToMessageId);

  const { data, error } = await supabase
    .rpc('send_message', {
      p_thread_id: threadId,
      p_body: body,
      p_reply_to_message_id: normalizedReplyToMessageId,
      p_client_id: clientId,
    })
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to send message');
  }

  return data as SentMessageRow;
}
