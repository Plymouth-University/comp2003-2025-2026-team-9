import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '../src/lib/supabase';

import { ThemedText } from '@/components/themed-text';
import { font } from '../src/lib/fonts';
import { commonStyles } from '../src/styles/common';

export default function Index() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  // If the user already has a session, skip the chooser and go straight to the correct area
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.warn('Failed to load profile role', error);
      }

      const role = profile?.role ?? 'member';

      if (role === 'mentor') {
        router.replace('/(app)/Mentor/connections');
      } else {
        router.replace('/(app)/Mentee/connections');
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.background }}>
      <View style={styles.container}>
        {/* Top: logo + app name */}
        <View style={styles.header}>
          <Logo size={96} style={styles.logo} />
          <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
        </View>

        {/* Middle: buttons centered in remaining space */}
        <View style={styles.middle}>
          <View style={styles.buttonGroup}>
            <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>MEMBER</ThemedText>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#333f5c' }]}
              onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { role: 'member' } })}
            >
              <Text style={styles.primaryButtonText}>Log in</Text>
            </TouchableOpacity>
            <View style={styles.spacer} />
            <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>MENTOR</ThemedText>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
              onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { role: 'mentor' } })}
            >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
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
    ...commonStyles.primaryButton,
    paddingVertical: 24,
    borderRadius: 10,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
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
