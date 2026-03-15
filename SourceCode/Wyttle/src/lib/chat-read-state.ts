import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'chat:last-read:';

function getThreadKey(threadId: number | string) {
  return `${KEY_PREFIX}${threadId}`;
}

export async function getLastReadAt(threadId: number | string): Promise<string | null> {
  return AsyncStorage.getItem(getThreadKey(threadId));
}

export async function setLastReadAt(
  threadId: number | string,
  timestamp: string = new Date().toISOString(),
): Promise<void> {
  await AsyncStorage.setItem(getThreadKey(threadId), timestamp);
}
