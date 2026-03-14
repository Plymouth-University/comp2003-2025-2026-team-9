import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { AuthBackButton } from '@/components/ui/AuthBackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font } from '../../src/lib/fonts';
import { commonStyles } from '../../src/styles/common';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.header}>
        <AuthBackButton style={styles.headerBackButton} />
        <Logo size={96} style={styles.logo} />
        <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
        <ThemedText
          style={[styles.subText, { color: '#968c6c' }, font('GlacialIndifference', '800')]}
        >
          Password recovery
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: '#c6c1ae' }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Mock recovery page</Text>
        <Text style={[styles.cardBody, { color: theme.text }]}>
          This is a placeholder for the password reset flow. We can swap this for a real email
          recovery form whenever you want to connect it to Supabase.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <Text style={styles.primaryButtonText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  headerBackButton: {
    position: 'absolute',
    top: 0,
    left: 0,
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
    textAlign: 'center',
    marginTop: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  primaryButton: {
    ...commonStyles.primaryButton,
    marginTop: 8,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
  },
});
