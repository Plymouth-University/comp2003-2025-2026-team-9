import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MenteeBottomNav from '../../../src/components/nav/MenteeBottomNav';

export default function MenteeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Main tab screens: fade between tabs for a softer change */}
        <Stack.Screen name="connections" options={{ animation: 'fade' }} />
        <Stack.Screen name="discovery" options={{ animation: 'fade' }} />
        <Stack.Screen name="mentor-hub" options={{ animation: 'fade' }} />
        <Stack.Screen name="settings" options={{ animation: 'fade' }} />
        {/* Other screens (e.g. chat) will use default slide animation */}
      </Stack>
      <MenteeBottomNav />
    </View>
  );
}
