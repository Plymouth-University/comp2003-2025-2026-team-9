import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase, getCurrentUser } from './supabase';

export async function registerPushToken() {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  const user = await getCurrentUser();

  await supabase
    .from('expo_push_tokens')
    .upsert({ user_id: user.id, token }, { onConflict: 'user_id,token' });
}