import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';

export default function MentorLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Main tab screens: fade between tabs for a softer change */}
        <Stack.Screen name="connections" options={{ animation: 'fade' }} />
        <Stack.Screen name="waiting-room" options={{ animation: 'fade' }} />
        <Stack.Screen name="calendar" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ animation: 'fade' }} />
        {/* Other screens (e.g. chat) will use default slide animation */}
      </Stack>
      <MentorBottomNav />
    </View>
  );
}
