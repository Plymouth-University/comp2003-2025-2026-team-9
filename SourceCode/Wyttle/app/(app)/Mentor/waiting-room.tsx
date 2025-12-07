import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MentorWaitingRoomScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Video Waiting Room</Text>
      <Text style={styles.subtitle}>
        Here mentors will go online and join upcoming video calls.
      </Text>
      {/* Later: toggle “Available” and join call UI */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555' },
});
