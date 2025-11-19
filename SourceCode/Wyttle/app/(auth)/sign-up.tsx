import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/BackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';
import { commonStyles } from '../../src/styles/common';

export default function SignUpRoleChooser() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const onSelectRole = (role: 'mentee' | 'mentor') => {
    const target = role === 'mentee' ? '/(auth)/sign-up-mentee' : '/(auth)/sign-up-mentor';
    router.push(target as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <BackButton />

      <View style={styles.header}>
          <Logo size={96} style={styles.logo} />
          <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
          <ThemedText
            style={[styles.subText, { color: '#968c6c' }, font('GlacialIndifference', '800')]}
          >
            Create your account
          </ThemedText>
        </View>
      <View style={styles.spacer} />
      <View style={styles.content}>
          <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>I am a</ThemedText>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#333f5c' }]}
            onPress={() => onSelectRole('mentee')}
          >
            <Text style={styles.primaryButtonText}>Mentee</Text>
          </TouchableOpacity>
          <View style={styles.spacer} />
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
            onPress={() => onSelectRole('mentor')}
          >
            <Text style={styles.primaryButtonText}>Mentor</Text>
          </TouchableOpacity>
        </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.text }]}>Already have an account?</Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={[styles.footerLink, { color: theme.tint }]}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
  subText: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 1,
    color: '#8f8e8e',
    textAlign: 'center',
    marginTop: 12,
  },
  content: {
    gap: 16,
    marginTop: 24,
  },
  labelText: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 2,
    color: '#8f8e8e',
    textAlign: 'center',
    marginBottom: 4,
  },
  primaryButton: {
    ...commonStyles.primaryButton,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  spacer: {
    height: 46,
  },
});
