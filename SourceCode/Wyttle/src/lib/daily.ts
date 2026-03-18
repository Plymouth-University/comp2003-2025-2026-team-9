import Constants from 'expo-constants';

const DAILY_API_URL = 'https://api.daily.co/v1';

const getDailyApiKey = (): string => {
  const key = (Constants.expoConfig?.extra as any)?.dailyApiKey;
  if (!key) throw new Error('Daily.co API key not configured in Expo config extra.dailyApiKey');
  return key;
};

/**
 * Create a temporary Daily.co room for a session.
 * Room expires after 45 minutes (30-min session + 15-min buffer).
 * Returns the full room URL (e.g. https://your-domain.daily.co/wyttle-123).
 */
export async function createDailyRoom(sessionId: number | string): Promise<string> {
  const apiKey = getDailyApiKey();
  const roomName = `wyttle-${sessionId}`;
  const expiresInSeconds = 45 * 60; // 45 minutes

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const roomBody = {
    name: roomName,
    privacy: 'public',
    properties: {
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
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
