// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const MAX_EVENTS_PER_RUN = 100;
const EXPO_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

type NotificationEventRow = {
  id: number;
  event_type: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown> | null;
  attempt_count: number;
};

type NotificationPreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  notify_new_message: boolean;
  notify_incoming_like: boolean;
  notify_mutual_connection: boolean;
  notify_mentor_request_updates: boolean;
  notify_session_reminder_1h: boolean;
  notify_session_reminder_15m: boolean;
  notify_session_starting_now: boolean;
};

type ProfileRow = {
  id: string;
  role: 'member' | 'mentor' | 'admin' | null;
  full_name: string | null;
};

type TokenRow = {
  user_id: string;
  token: string;
};

type OutgoingMessage = {
  to: string;
  sound: 'default';
  title: string;
  body: string;
  data: Record<string, unknown>;
  channelId: 'default';
  priority: 'high';
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function chunkArray<T>(items: T[], size: number): T[][];
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function preferenceKeyForEvent(eventType: string): keyof NotificationPreferenceRow | null {
  switch (eventType) {
    case 'new_message':
      return 'notify_new_message';
    case 'incoming_like':
      return 'notify_incoming_like';
    case 'mutual_connection':
      return 'notify_mutual_connection';
    case 'mentor_request_new':
    case 'mentor_request_scheduled':
    case 'mentor_request_declined':
      return 'notify_mentor_request_updates';
    case 'session_reminder_1h':
      return 'notify_session_reminder_1h';
    case 'session_reminder_15m':
      return 'notify_session_reminder_15m';
    case 'session_starting_now':
      return 'notify_session_starting_now';
    default:
      return null;
  }
}

function fallbackRoute(eventType: string, recipientRole: string | null | undefined): string | null {
  const role = recipientRole === 'mentor' ? 'mentor' : 'member';
  switch (eventType) {
    case 'new_message':
      return role === 'mentor' ? '/(app)/Mentor/chat' : '/(app)/Mentee/chat';
    case 'incoming_like':
    case 'mutual_connection':
      return role === 'mentor' ? '/(app)/Mentor/connections' : '/(app)/Mentee/connections';
    case 'mentor_request_new':
      return '/(app)/Mentor/connections';
    case 'mentor_request_scheduled':
    case 'mentor_request_declined':
      return '/(app)/Mentee/mentor-hub';
    case 'session_reminder_1h':
    case 'session_reminder_15m':
    case 'session_starting_now':
      return role === 'mentor' ? '/(app)/Mentor/waiting-room' : '/(app)/Mentee/mentor-hub';
    default:
      return null;
  }
}

function friendlyCopy(event: NotificationEventRow, actorName: string | null): { title: string; body: string } {
  const payload = event.payload ?? {};
  const name = actorName ?? (typeof payload.other_name === 'string' ? payload.other_name : null) ?? 'Someone';

  switch (event.event_type) {
    case 'new_message':
      return {
        title: event.title ?? 'New message 💬',
        body: event.body ?? `${name} sent you a message.`,
      };
    case 'incoming_like':
      return {
        title: event.title ?? 'New connection request 👋',
        body: event.body ?? `${name} wants to connect with you.`,
      };
    case 'mutual_connection':
      return {
        title: event.title ?? 'You made a new connection 🎉',
        body: event.body ?? `You and ${name} are now connected.`,
      };
    case 'mentor_request_new':
      return {
        title: event.title ?? 'New mentor session request 📅',
        body: event.body ?? `${name} sent a mentorship request.`,
      };
    case 'mentor_request_scheduled':
      return {
        title: event.title ?? 'Session confirmed ✅',
        body: event.body ?? `${name} accepted your request.`,
      };
    case 'mentor_request_declined':
      return {
        title: event.title ?? 'Session request update',
        body: event.body ?? `${name} declined your request.`,
      };
    case 'session_reminder_1h':
      return {
        title: event.title ?? 'Session in 1 hour ⏰',
        body: event.body ?? 'Your mentorship session starts in about 1 hour.',
      };
    case 'session_reminder_15m':
      return {
        title: event.title ?? 'Session in 15 minutes 🔔',
        body: event.body ?? 'Quick heads up — your mentorship session starts in 15 minutes.',
      };
    case 'session_starting_now':
      return {
        title: event.title ?? 'Session starting now 🎥',
        body: event.body ?? 'Your mentorship session is starting now.',
      };
    default:
      return {
        title: event.title ?? 'New update',
        body: event.body ?? 'You have a new notification.',
      };
  }
}

function buildNotificationData(
  event: NotificationEventRow,
  recipientRole: string | null | undefined,
  actorName: string | null,
): Record<string, unknown> {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const routeFromPayload = typeof payload.route === 'string' ? payload.route : null;
  const route = routeFromPayload ?? fallbackRoute(event.event_type, recipientRole);

  const params: Record<string, string> = {};
  const threadId = payload.thread_id;
  const requestId = payload.request_id;
  const otherId = payload.other_user_id ?? event.actor_user_id;
  const otherName = (typeof payload.other_name === 'string' ? payload.other_name : null) ?? actorName;
  const videoLink = payload.video_link;

  if (threadId != null) params.threadId = String(threadId);
  if (requestId != null) params.requestId = String(requestId);
  if (otherId != null) params.otherId = String(otherId);
  if (otherName) params.name = otherName;
  if (videoLink != null) params.roomUrl = String(videoLink);

  return {
    ...payload,
    event_type: event.event_type,
    recipient_role: recipientRole ?? 'member',
    route,
    params,
  };
}

function isPushAllowed(event: NotificationEventRow, preference: NotificationPreferenceRow | undefined): boolean {
  if (!preference) return true;
  if (!preference.push_enabled) return false;

  const key = preferenceKeyForEvent(event.event_type);
  if (!key) return true;
  return Boolean(preference[key]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const body = req.method === 'POST' ? await req.json().catch(() => null) : null;
  const requestedLimit = typeof body?.limit === 'number' ? body.limit : MAX_EVENTS_PER_RUN;
  const limit = Math.max(1, Math.min(MAX_EVENTS_PER_RUN, requestedLimit));

  const nowIso = new Date().toISOString();
  const { data: events, error: eventsError } = await admin
    .from('notification_events')
    .select('id, event_type, recipient_user_id, actor_user_id, title, body, payload, attempt_count')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (eventsError) {
    return new Response(JSON.stringify({ error: eventsError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const queue = (events ?? []) as NotificationEventRow[];
  if (queue.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, sent: 0, skipped: 0, failed: 0 }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const recipientIds = Array.from(new Set(queue.map((e) => e.recipient_user_id)));
  const actorIds = Array.from(
    new Set(queue.map((e) => e.actor_user_id).filter((id): id is string => Boolean(id))),
  );
  const allProfileIds = Array.from(new Set([...recipientIds, ...actorIds]));

  const [prefsResult, tokensResult, profilesResult] = await Promise.all([
    admin
      .from('notification_preferences')
      .select(
        'user_id, push_enabled, notify_new_message, notify_incoming_like, notify_mutual_connection, notify_mentor_request_updates, notify_session_reminder_1h, notify_session_reminder_15m, notify_session_starting_now',
      )
      .in('user_id', recipientIds),
    admin
      .from('expo_push_tokens')
      .select('user_id, token')
      .in('user_id', recipientIds),
    admin
      .from('profiles')
      .select('id, role, full_name')
      .in('id', allProfileIds),
  ]);

  if (prefsResult.error) {
    return new Response(JSON.stringify({ error: prefsResult.error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (tokensResult.error) {
    return new Response(JSON.stringify({ error: tokensResult.error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (profilesResult.error) {
    return new Response(JSON.stringify({ error: profilesResult.error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const preferenceByUser = new Map(
    (prefsResult.data as NotificationPreferenceRow[] | null)?.map((row) => [row.user_id, row]) ?? [],
  );
  const tokenRows = (tokensResult.data as TokenRow[] | null) ?? [];
  const tokensByUser = tokenRows.reduce<Map<string, string[]>>((acc, row) => {
    const existing = acc.get(row.user_id) ?? [];
    existing.push(row.token);
    acc.set(row.user_id, existing);
    return acc;
  }, new Map());

  const profileById = new Map(
    (profilesResult.data as ProfileRow[] | null)?.map((row) => [row.id, row]) ?? [],
  );

  const messagesToSend: Array<{ eventId: number; token: string; message: OutgoingMessage }> = [];
  const skippedEventIds = new Set<number>();
  const failedEventInfo = new Map<number, string>();

  for (const event of queue) {
    const preference = preferenceByUser.get(event.recipient_user_id);
    if (!isPushAllowed(event, preference)) {
      skippedEventIds.add(event.id);
      continue;
    }

    const tokens = tokensByUser.get(event.recipient_user_id) ?? [];
    if (tokens.length === 0) {
      skippedEventIds.add(event.id);
      continue;
    }

    const recipientProfile = profileById.get(event.recipient_user_id);
    const actorProfile = event.actor_user_id ? profileById.get(event.actor_user_id) : undefined;
    const copy = friendlyCopy(event, actorProfile?.full_name ?? null);
    const data = buildNotificationData(event, recipientProfile?.role, actorProfile?.full_name ?? null);

    for (const token of tokens) {
      messagesToSend.push({
        eventId: event.id,
        token,
        message: {
          to: token,
          sound: 'default',
          title: copy.title,
          body: copy.body,
          data,
          channelId: 'default',
          priority: 'high',
        },
      });
    }
  }

  const sentEventIds = new Set<number>();
  const invalidTokens = new Set<string>();

  for (const batch of chunkArray(messagesToSend, EXPO_BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch.map((item) => item.message)),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      for (const item of batch) {
        failedEventInfo.set(item.eventId, `Expo send failed: ${response.status} ${errorBody}`);
      }
      continue;
    }

    const payload = await response.json();
    const tickets = Array.isArray(payload?.data) ? payload.data : [];

    const deliveryRows: Array<Record<string, unknown>> = [];

    tickets.forEach((ticket: any, index: number) => {
      const source = batch[index];
      if (!source) return;

      const status = ticket?.status === 'ok' ? 'ok' : 'error';
      const errorMessage =
        status === 'error'
          ? ticket?.message ?? ticket?.details?.error ?? 'Unknown Expo push error'
          : null;

      if (status === 'ok') {
        sentEventIds.add(source.eventId);
      } else {
        failedEventInfo.set(source.eventId, errorMessage ?? 'Unknown Expo push error');
      }

      if (ticket?.details?.error === 'DeviceNotRegistered') {
        invalidTokens.add(source.token);
      }

      deliveryRows.push({
        event_id: source.eventId,
        recipient_user_id: queue.find((e) => e.id === source.eventId)?.recipient_user_id,
        token: source.token,
        status,
        expo_ticket_id: ticket?.id ?? null,
        error: errorMessage,
        details: ticket?.details ?? {},
      });
    });

    if (deliveryRows.length > 0) {
      const { error: insertDeliveryError } = await admin
        .from('notification_deliveries')
        .insert(deliveryRows);
      if (insertDeliveryError) {
        console.warn('Failed to insert notification delivery rows', insertDeliveryError.message);
      }
    }
  }

  if (invalidTokens.size > 0) {
    const { error: deleteTokenError } = await admin
      .from('expo_push_tokens')
      .delete()
      .in('token', Array.from(invalidTokens));
    if (deleteTokenError) {
      console.warn('Failed to remove invalid Expo tokens', deleteTokenError.message);
    }
  }

  if (skippedEventIds.size > 0) {
    await admin
      .from('notification_events')
      .update({ status: 'skipped', sent_at: new Date().toISOString() })
      .in('id', Array.from(skippedEventIds));
  }

  if (sentEventIds.size > 0) {
    await admin
      .from('notification_events')
      .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      .in('id', Array.from(sentEventIds));
  }

  const failedIds = Array.from(
    new Set(
      Array.from(failedEventInfo.keys()).filter((id) => !sentEventIds.has(id) && !skippedEventIds.has(id)),
    ),
  );

  for (const failedId of failedIds) {
    const original = queue.find((e) => e.id === failedId);
    if (!original) continue;
    const nextAttempts = (original.attempt_count ?? 0) + 1;
    const terminalFailure = nextAttempts >= MAX_ATTEMPTS;

    await admin
      .from('notification_events')
      .update({
        status: terminalFailure ? 'failed' : 'pending',
        attempt_count: nextAttempts,
        last_error: failedEventInfo.get(failedId) ?? 'Unknown delivery error',
      })
      .eq('id', failedId);
  }

  return new Response(
    JSON.stringify({
      processed: queue.length,
      sent: sentEventIds.size,
      skipped: skippedEventIds.size,
      failed: failedIds.length,
      invalidTokensRemoved: invalidTokens.size,
    }),
    { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
  );
});
