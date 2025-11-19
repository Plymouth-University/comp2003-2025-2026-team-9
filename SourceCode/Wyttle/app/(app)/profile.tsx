import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

export default function Profile() {
  const onLogout = async () => {
    if (!__DEV__) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore logout errors for now; navigation is enough for testing
      }
    }
    router.replace('/(auth)/sign-in');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  logoutButton: {
    ...commonStyles.primaryButton,
  },
  logoutText: {
    ...commonStyles.primaryButtonText,
  },
});
