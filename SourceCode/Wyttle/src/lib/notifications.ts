import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { getCurrentUser, supabase } from './supabase';

export type NotificationPreferences = {
  push_enabled: boolean;
  notify_new_message: boolean;
  notify_incoming_like: boolean;
  notify_mutual_connection: boolean;
  notify_mentor_request_updates: boolean;
  notify_session_reminder_1h: boolean;
  notify_session_reminder_15m: boolean;
  notify_session_starting_now: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  notify_new_message: true,
  notify_incoming_like: true,
  notify_mutual_connection: true,
  notify_mentor_request_updates: true,
  notify_session_reminder_1h: true,
  notify_session_reminder_15m: true,
  notify_session_starting_now: true,
};

const PREFERENCE_COLUMNS =
  'push_enabled, notify_new_message, notify_incoming_like, notify_mutual_connection, notify_mentor_request_updates, notify_session_reminder_1h, notify_session_reminder_15m, notify_session_starting_now';

type NotificationRouteData = {
  route?: string | null;
  params?: Record<string, string>;
  eventType?: string;
  recipientRole?: string;
};

function withPreferenceDefaults(
  prefs: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(prefs ?? {}),
  };
}

function isMissingSchemaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  return (
    message.includes('relation') && message.includes('does not exist')
  ) || message.includes('column') && message.includes('does not exist');
}

function getProjectId(): string | undefined {
  const fromEasConfig = (Constants as any).easConfig?.projectId as string | undefined;
  const fromExpoExtra = (Constants.expoConfig?.extra as any)?.eas?.projectId as string | undefined;
  return fromEasConfig ?? fromExpoExtra;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#968c6c',
  });
}

async function resolveUserId(userId?: string): Promise<string | null> {
  if (userId) return userId;
  try {
    const user = await getCurrentUser();
    return user.id;
  } catch {
    return null;
  }
}

function toStringParams(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (typeof value === 'object') continue;
    out[key] = String(value);
  }
  return out;
}

function extractRouteData(data: Record<string, unknown>): NotificationRouteData {
  const route = typeof data.route === 'string' ? data.route : null;

  let parsedParams: Record<string, string> = {};
  if (typeof data.params === 'string') {
    try {
      parsedParams = toStringParams(JSON.parse(data.params));
    } catch {
      parsedParams = {};
    }
  } else {
    parsedParams = toStringParams(data.params);
  }

  for (const [key, value] of Object.entries(data)) {
    if (key === 'route' || key === 'params') continue;
    if (value == null || typeof value === 'object') continue;
    if (!parsedParams[key]) parsedParams[key] = String(value);
  }

  return {
    route,
    params: parsedParams,
    eventType: typeof data.event_type === 'string' ? data.event_type : undefined,
    recipientRole: typeof data.recipient_role === 'string' ? data.recipient_role : undefined,
  };
}

function getFallbackRoute(eventType?: string, recipientRole?: string): string | null {
  const role = recipientRole === 'mentor' ? 'mentor' : 'member';

  switch (eventType) {
    case 'new_message':
      // Without route params, the chat screens cannot open a specific thread.
      // Land on connections so the unread conversation is still reachable.
      return role === 'mentor' ? '/(app)/Mentor/connections' : '/(app)/Mentee/connections';
    case 'incoming_like':
    case 'mutual_connection':
      return role === 'mentor' ? '/(app)/Mentor/connections' : '/(app)/Mentee/connections';
    case 'mentor_request_new':
      return '/(app)/Mentor/connections';
    case 'mentor_request_scheduled':
      return '/(app)/Mentee/mentor-hub';
    case 'mentor_request_declined':
      return '/(app)/Mentee/connections';
    case 'mentor_rate_change_approved':
    case 'mentor_rate_change_rejected':
      return '/(app)/Mentor/settings';
    case 'session_reminder_1h':
    case 'session_reminder_15m':
    case 'session_starting_now':
      return role === 'mentor' ? '/(app)/Mentor/waiting-room' : '/(app)/Mentee/mentor-hub';
    default:
      return null;
  }
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  const routeData = extractRouteData(data);
  const fallbackRoute = getFallbackRoute(routeData.eventType, routeData.recipientRole);
  const pathname = routeData.route ?? fallbackRoute;
  if (!pathname) return;

  try {
    router.push({
      pathname: pathname as any,
      params: routeData.params ?? {},
    });
  } catch (error) {
    console.warn('Failed to handle notification tap routing', error);
  }
}

export function configureNotificationDisplayBehavior() {
  if (Platform.OS === 'web') return;
  void ensureAndroidNotificationChannel().catch((error) => {
    console.warn('Failed to configure Android notification channel', error);
  });
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function attachNotificationResponseListener(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationResponse(response);
  });

  return () => {
    subscription.remove();
  };
}

export async function handleLastNotificationResponse() {
  if (Platform.OS === 'web') return;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;
    handleNotificationResponse(response);

    const clearLastNotificationResponseAsync = (Notifications as any)
      .clearLastNotificationResponseAsync as (() => Promise<void>) | undefined;
    if (typeof clearLastNotificationResponseAsync === 'function') {
      await clearLastNotificationResponseAsync();
    }
  } catch (error) {
    console.warn('Failed to process last notification response', error);
  }
}

export async function ensureNotificationPreferences(userId?: string): Promise<NotificationPreferences> {
  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return DEFAULT_NOTIFICATION_PREFERENCES;

  const payload = {
    user_id: resolvedUserId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error && !isMissingSchemaError(error)) {
    console.warn('Failed to ensure notification preferences', error);
  }

  return getNotificationPreferences(resolvedUserId);
}

export async function getNotificationPreferences(userId?: string): Promise<NotificationPreferences> {
  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return DEFAULT_NOTIFICATION_PREFERENCES;

  const { data, error } = await supabase
    .from('notification_preferences')
    .select(PREFERENCE_COLUMNS)
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  if (error) {
    if (!isMissingSchemaError(error)) {
      console.warn('Failed to load notification preferences', error);
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return withPreferenceDefaults(data as Partial<NotificationPreferences> | null);
}

export async function updateNotificationPreferences(
  partial: Partial<NotificationPreferences>,
  userId?: string,
): Promise<NotificationPreferences> {
  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return DEFAULT_NOTIFICATION_PREFERENCES;

  const current = await getNotificationPreferences(resolvedUserId);
  const merged = withPreferenceDefaults({ ...current, ...partial });

  const payload = {
    user_id: resolvedUserId,
    ...merged,
  };

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error && !isMissingSchemaError(error)) {
    throw error;
  }

  return merged;
}

async function savePushToken(resolvedUserId: string, token: string) {
  const extendedPayload = {
    user_id: resolvedUserId,
    token,
    platform: Platform.OS,
    app_id: Constants.expoConfig?.slug ?? Constants.expoConfig?.name ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const { error: extendedError } = await supabase
    .from('expo_push_tokens')
    .upsert(extendedPayload, { onConflict: 'user_id,token' });

  if (extendedError) {
    if (isMissingSchemaError(extendedError)) {
      const { error: fallbackError } = await supabase
        .from('expo_push_tokens')
        .upsert({ user_id: resolvedUserId, token }, { onConflict: 'user_id,token' });

      if (fallbackError && !isMissingSchemaError(fallbackError)) {
        console.warn('Failed to save push token', fallbackError);
      }
    } else {
      console.warn('Failed to save push token', extendedError);
    }
  }
}

export async function registerPushToken(userId?: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return null;

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  let token: string;
  try {
    const projectId = getProjectId();
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch (error) {
    console.warn('Failed to fetch Expo push token', error);
    return null;
  }

  await savePushToken(resolvedUserId, token);

  return token;
}

export function attachPushTokenListener(userId?: string): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  const addPushTokenListener = (Notifications as any).addPushTokenListener as
    | ((listener: (token: { data: string }) => void) => { remove: () => void })
    | undefined;

  if (typeof addPushTokenListener !== 'function') {
    return () => {};
  }

  const subscription = addPushTokenListener((token) => {
    void (async () => {
      const resolvedUserId = await resolveUserId(userId);
      if (!resolvedUserId) return;
      await savePushToken(resolvedUserId, token.data);
    })().catch((error) => {
      console.warn('Failed to sync refreshed push token', error);
    });
  });

  return () => {
    subscription.remove();
  };
}

export async function unregisterPushToken(userId?: string): Promise<void> {
  if (!Device.isDevice) return;

  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return;

  const projectId = getProjectId();
  let token: string | null = null;
  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch {
    token = null;
  }

  const deleteQuery = supabase.from('expo_push_tokens').delete().eq('user_id', resolvedUserId);
  const { error } = token
    ? await deleteQuery.eq('token', token)
    : await deleteQuery;

  if (error && !isMissingSchemaError(error)) {
    console.warn('Failed to unregister push token', error);
  }
}

export async function initializeNotificationsForUser(userId?: string) {
  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return;

  await ensureNotificationPreferences(resolvedUserId);
  await registerPushToken(resolvedUserId);
}
