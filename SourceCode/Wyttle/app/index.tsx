import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '../src/lib/supabase';

import { ThemedText } from '@/components/themed-text';
import { font } from '../src/lib/fonts'; // Import the font helper

export default function Index() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  // If the user already has a session, skip the chooser and go straight to the app
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/(app)/home');
      }
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top: logo + app name */}
      <View style={styles.header}>
        <Logo size={96} style={styles.logo} />
        <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
      </View>

      {/* Middle: buttons centered in remaining space */}
      <View style={styles.middle}>
        <View style={styles.buttonGroup}>
          <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>MENTEE</ThemedText>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#333f5c' }]}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.primaryButtonText}>Log in</Text>
          </TouchableOpacity>
          <View style={styles.spacer} />
          <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>MENTOR</ThemedText>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
            onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.primaryButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom: sign up link */}
      <TouchableOpacity
        style={styles.textButton}
        onPress={() => router.push('/(auth)/sign-up')}
      >
        <Text style={[styles.textButtonLabel, { color: theme.tint }]}>Need an account? Register here</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  spacer: {
    height: 56,
  },
  logo: {
    marginBottom: 8,
  },
  appName: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 7,
    color: '#968c6c',
  },
  labelText: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 2,
    color: '#8f8e8e',
    alignContent: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonGroup: {
    width: '100%',
    gap: 12,
    marginTop: -62,
  },
  primaryButton: {
    paddingVertical: 24,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 2,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  textButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
