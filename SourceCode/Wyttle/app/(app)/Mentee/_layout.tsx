import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MenteeBottomNav from '../../../src/components/nav/MenteeBottomNav';

export default function MenteeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {/* Main tab screens: fade between tabs for a softer change */}
        <Stack.Screen name="connections" />
        <Stack.Screen name="discovery" />
        <Stack.Screen name="mentor-hub" />
        <Stack.Screen name="settings" />
        {/* Other screens (e.g. chat) will also use fade animation */}
      </Stack>
      <MenteeBottomNav />
    </View>
  );
}
