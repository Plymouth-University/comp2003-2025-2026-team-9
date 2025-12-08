import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';

export default function MentorLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {/* Main tab screens: fade between tabs for a softer change */}
        <Stack.Screen name="connections" />
        <Stack.Screen name="waiting-room" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="settings" />
        {/* Other screens (e.g. chat) will also use fade animation */}
      </Stack>
      <MentorBottomNav />
    </View>
  );
}
