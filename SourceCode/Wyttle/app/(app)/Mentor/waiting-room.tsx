import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { commonStyles } from '../../../src/styles/common';

export default function MentorWaitingRoomScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Video"
        highlight="Waiting Room"
        subtitle="Here mentors will go online and join upcoming video calls."
      />
      {/* Later: toggle “Available” and join call UI */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
});
