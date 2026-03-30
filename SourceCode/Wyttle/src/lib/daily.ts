import Constants from 'expo-constants';

const DAILY_API_URL = 'https://api.daily.co/v1';

const getDailyApiKey = (): string => {
  const key = (Constants.expoConfig?.extra as any)?.dailyApiKey;
  if (!key) throw new Error('Daily.co API key not configured in Expo config extra.dailyApiKey');
  return key;
};

/**
 * Create a temporary Daily.co room for a session.
 * Room expires shortly after the scheduled session ends.
 * Returns the full room URL (e.g. https://your-domain.daily.co/wyttle-123).
 */
export async function createDailyRoom(
  sessionId: number | string,
  scheduledEndIso?: string | null,
): Promise<string> {
  const apiKey = getDailyApiKey();
  const roomName = `wyttle-${sessionId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const minLifetimeSeconds = 45 * 60; // Keep at least enough time for short-notice sessions.
  const scheduledEndSeconds = scheduledEndIso
    ? Math.floor(new Date(scheduledEndIso).getTime() / 1000)
    : null;
  const exp = Math.max(
    nowSeconds + minLifetimeSeconds,
    (scheduledEndSeconds ?? nowSeconds) + 15 * 60, // 15-minute post-session buffer.
  );

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const roomBody = {
    name: roomName,
    privacy: 'public',
    properties: {
      exp,
      max_participants: 2,
      enable_chat: true,
      enable_screenshare: true,
    },
  };

  // Try creating the room
  let res = await fetch(`${DAILY_API_URL}/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify(roomBody),
  });

  // If room already exists, delete it and retry
  if (!res.ok) {
    const body = await res.text();
    if (body.includes('already exists')) {
      await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
        method: 'DELETE',
        headers,
      });
      res = await fetch(`${DAILY_API_URL}/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify(roomBody),
      });
    }
    if (!res.ok) {
      const retryBody = await res.text();
      console.error('Daily.co room creation failed', res.status, retryBody);
      throw new Error(`Failed to create video room: ${res.status}`);
    }
  }

  const data = await res.json();
  return data.url as string;
}
