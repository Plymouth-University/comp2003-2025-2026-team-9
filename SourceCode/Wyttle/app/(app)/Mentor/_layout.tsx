import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';

export default function MentorLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <MentorBottomNav />
    </View>
  );
}
