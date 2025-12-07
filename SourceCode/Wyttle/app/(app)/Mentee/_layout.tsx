import React from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MenteeBottomNav from '../../../src/components/nav/MenteeBottomNav';

export default function MenteeLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <MenteeBottomNav />
    </View>
  );
}
