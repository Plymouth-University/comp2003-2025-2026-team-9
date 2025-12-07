import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import { router } from 'expo-router';

export default function MentorSettingsScreen() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>
        Profile options, accessibility, switch account, and notifications will
        live here.
      </Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingBottom: 90 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 20 },
  button: {
    marginTop: 20,
    backgroundColor: '#1F2940',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
