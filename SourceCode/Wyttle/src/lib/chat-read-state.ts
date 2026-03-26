import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'chat:last-read-message-id:';
const listeners = new Set<(threadId: number) => void>();

function getThreadKey(threadId: number | string) {
  return `${KEY_PREFIX}${threadId}`;
}

function compareMessageIds(a?: string | null, b?: string | null): number {
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

function emit(threadId: number) {
  listeners.forEach((listener) => {
    try {
      listener(threadId);
    } catch (error) {
      console.warn('Local chat read listener failed', error);
    }
  });
}

export async function getLastReadMessageId(threadId: number | string): Promise<string | null> {
  return AsyncStorage.getItem(getThreadKey(threadId));
}

export async function getLastReadMessageIdMap(
  threadIds: number[],
): Promise<Record<number, string | null>> {
  if (threadIds.length === 0) return {};

  const uniqueThreadIds = Array.from(new Set(threadIds));
  const entries = await AsyncStorage.multiGet(uniqueThreadIds.map((threadId) => getThreadKey(threadId)));

  const result: Record<number, string | null> = {};
  entries.forEach(([key, value]) => {
    const threadId = Number(key.replace(KEY_PREFIX, ''));
    result[threadId] = value;
  });

  return result;
}

export async function markThreadReadLocally(
  threadId: number | string,
  messageId: string | number | null | undefined,
): Promise<void> {
  if (messageId == null) return;

  const threadKey = getThreadKey(threadId);
  const nextMessageId = String(messageId);
  const existingMessageId = await AsyncStorage.getItem(threadKey);

  if (compareMessageIds(existingMessageId, nextMessageId) >= 0) {
    return;
  }

  await AsyncStorage.setItem(threadKey, nextMessageId);
  emit(Number(threadId));
}

export function hasLocalReadReached(
  lastReadMessageId: string | null | undefined,
  messageId: string | null | undefined,
): boolean {
  if (!lastReadMessageId || !messageId) return false;
  return compareMessageIds(lastReadMessageId, messageId) >= 0;
}

export function subscribeToLocalReadUpdates(listener: (threadId: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
