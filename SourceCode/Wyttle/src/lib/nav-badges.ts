import { getLastReadMessageIdMap, hasLocalReadReached } from './chat-read-state';
import { fetchBlockedUserIds, supabase } from './supabase';

type LatestMessageByThread = Record<
  number,
  { id: string; sender: string | null }
>;

export type MenteeNavBadgeCounts = {
  connections: number;
  mentorHub: number;
  trackedThreadIds: number[];
};

export type MentorNavBadgeCounts = {
  connections: number;
  waiting: number;
  trackedThreadIds: number[];
};

async function getLatestMessagesByThread(threadIds: number[]): Promise<LatestMessageByThread> {
  if (threadIds.length === 0) return {};

  const { data, error } = await supabase
    .from('messages')
    .select('id, thread_id, sender, inserted_at')
    .in('thread_id', threadIds)
    .order('inserted_at', { ascending: false });

  if (error) throw error;

  const latestByThread: LatestMessageByThread = {};
  (data ?? []).forEach((message: any) => {
    if (!latestByThread[message.thread_id]) {
      latestByThread[message.thread_id] = {
        id: String(message.id),
        sender: message.sender ?? null,
      };
    }
  });

  return latestByThread;
}

async function getUnreadThreadIds(threadIds: number[], userId: string): Promise<Set<number>> {
  if (threadIds.length === 0) return new Set<number>();

  const [latestByThread, localReadMap] = await Promise.all([
    getLatestMessagesByThread(threadIds),
    getLastReadMessageIdMap(threadIds),
  ]);

  const unreadThreadIds = new Set<number>();

  threadIds.forEach((threadId) => {
    const last = latestByThread[threadId];

    if (!last?.id || !last.sender || last.sender === userId) {
      return;
    }

    if (!hasLocalReadReached(localReadMap[threadId], last.id)) {
      unreadThreadIds.add(threadId);
    }
  });

  return unreadThreadIds;
}

async function getVisibleProfileIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, hidden')
    .in('id', uniqueIds);

  if (error) throw error;

  return new Set(
    (data ?? [])
      .filter((profile: any) => !profile.hidden)
      .map((profile: any) => profile.id as string),
  );
}

export async function getMenteeNavBadgeCounts(userId: string): Promise<MenteeNavBadgeCounts> {
  const blockedIds = new Set(await fetchBlockedUserIds());

  const { data: peerMatches, error: peerMatchesError } = await supabase
    .from('peer_matches')
    .select('thread_id, member_a, member_b')
    .or(`member_a.eq.${userId},member_b.eq.${userId}`);

  if (peerMatchesError) throw peerMatchesError;

  const visiblePeerIds = await getVisibleProfileIds(
    (peerMatches ?? []).map((match: any) => (
      match.member_a === userId ? match.member_b : match.member_a
    )),
  );

  const visiblePeerMatches = (peerMatches ?? []).filter((match: any) => {
    const otherUserId = match.member_a === userId ? match.member_b : match.member_a;
    return !blockedIds.has(otherUserId) && visiblePeerIds.has(otherUserId);
  });

  const peerThreadIds = visiblePeerMatches
    .map((match: any) => match.thread_id)
    .filter((threadId: number | null): threadId is number => threadId != null);

  const { data: mentorRequests, error: mentorRequestsError } = await supabase
    .from('mentor_requests')
    .select('mentor, thread_id, status, scheduled_start')
    .eq('mentee', userId)
    .not('thread_id', 'is', null)
    .in('status', ['requested', 'scheduled', 'cancelled']);

  if (mentorRequestsError) throw mentorRequestsError;

  const visibleMentorIds = await getVisibleProfileIds(
    (mentorRequests ?? []).map((request: any) => request.mentor),
  );

  const visibleMentorRequests = (mentorRequests ?? []).filter(
    (request: any) => !blockedIds.has(request.mentor) && visibleMentorIds.has(request.mentor),
  );

  const mentorThreadIds = visibleMentorRequests
    .map((request: any) => request.thread_id)
    .filter((threadId: number | null): threadId is number => threadId != null);

  const [peerUnreadThreadIds, mentorUnreadThreadIds] = await Promise.all([
    getUnreadThreadIds(peerThreadIds, userId),
    getUnreadThreadIds(mentorThreadIds, userId),
  ]);

  const unreadMentorIds = new Set(
    visibleMentorRequests
      .filter((request: any) => mentorUnreadThreadIds.has(request.thread_id))
      .map((request: any) => request.mentor),
  );

  const mentorHubCount = visibleMentorRequests.filter(
    (request: any) =>
      request.status === 'scheduled' &&
      request.scheduled_start &&
      new Date(request.scheduled_start).getTime() >= Date.now() - 30 * 60 * 1000,
  ).length;

  return {
    connections: peerUnreadThreadIds.size + unreadMentorIds.size,
    mentorHub: mentorHubCount,
    trackedThreadIds: Array.from(new Set([...peerThreadIds, ...mentorThreadIds])),
  };
}

export async function getMentorNavBadgeCounts(userId: string): Promise<MentorNavBadgeCounts> {
  const blockedIds = new Set(await fetchBlockedUserIds());

  const { data: requests, error: requestsError } = await supabase
    .from('mentor_requests')
    .select('mentee, thread_id, status, scheduled_start')
    .eq('mentor', userId)
    .not('thread_id', 'is', null);

  if (requestsError) throw requestsError;

  const visibleMenteeIds = await getVisibleProfileIds(
    (requests ?? []).map((request: any) => request.mentee),
  );

  const visibleRequests = (requests ?? []).filter(
    (request: any) => !blockedIds.has(request.mentee) && visibleMenteeIds.has(request.mentee),
  );
  const threadIds = visibleRequests
    .map((request: any) => request.thread_id)
    .filter((threadId: number | null): threadId is number => threadId != null);

  const unreadThreadIds = await getUnreadThreadIds(threadIds, userId);

  const connectionsCount = visibleRequests.filter((request: any) => {
    const hasPendingBooking = request.status === 'requested';
    const hasUnreadChat = unreadThreadIds.has(request.thread_id);
    return hasPendingBooking || hasUnreadChat;
  }).length;

  const waitingCount = visibleRequests.filter(
    (request: any) =>
      request.status === 'scheduled' &&
      request.scheduled_start &&
      new Date(request.scheduled_start).getTime() >= Date.now() - 30 * 60 * 1000,
  ).length;

  return {
    connections: connectionsCount,
    waiting: waitingCount,
    trackedThreadIds: threadIds,
  };
}
