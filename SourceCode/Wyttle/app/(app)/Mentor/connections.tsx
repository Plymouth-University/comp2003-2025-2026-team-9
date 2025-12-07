import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MentorConnectionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connections</Text>
      <Text style={styles.subtitle}>
        This will show chats and requests from mentees.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555' },
});
