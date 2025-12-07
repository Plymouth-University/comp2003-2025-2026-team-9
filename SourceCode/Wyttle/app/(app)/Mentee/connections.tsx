import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MenteeConnectionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connections</Text>
      <Text style={styles.subtitle}>
        This will list your matches and chats.
      </Text>
      {/* Later: FlatList of matches pulled from peer_matches */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555' },
});
