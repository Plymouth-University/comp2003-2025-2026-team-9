import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { AuthBackButton } from '@/components/ui/AuthBackButton';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font } from '../../src/lib/fonts';
import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const normalizedEmail = email.trim();
  const canSubmit = normalizedEmail.length > 0;

  const handleSendResetLink = async () => {
    if (!normalizedEmail) {
      setError('Enter the email address linked to your account.');
      return;
    }

    setError(null);
    setIsSending(true);

    try {
      const redirectTo = Linking.createURL('/reset-password');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        setSubmitted(false);
        return;
      }

      setSubmitted(true);
    } catch (sendError: any) {
      setError(sendError?.message ?? 'Unable to send reset email right now.');
      setSubmitted(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
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

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.card,
                borderColor: colorScheme === 'dark' ? '#293047' : '#c6c1ae',
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.text }]}>Reset your password</Text>
            <Text style={[styles.cardBody, { color: theme.placeholder }]}>
              Enter your account email and we&apos;ll send you a password reset link.
            </Text>

            <View style={styles.form}>
              <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>
                EMAIL
              </ThemedText>
              <TextInput
                placeholder="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={[
                  styles.input,
                  {
                    backgroundColor: colorScheme === 'dark' ? '#0d1220' : '#ffffff',
                    borderColor: error ? '#cf5f5f' : theme.tint,
                    color: theme.text,
                  },
                ]}
                placeholderTextColor={theme.placeholder}
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) setError(null);
                  if (submitted) setSubmitted(false);
                }}
                value={email}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {submitted ? (
                <View
                  style={[
                    styles.infoBox,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#10192b' : '#f4efe4',
                      borderColor: colorScheme === 'dark' ? '#26324d' : '#d8cfbc',
                    },
                  ]}
                >
                  <Text style={[styles.infoTitle, { color: theme.text }]}>Email sent</Text>
                  <Text style={[styles.infoText, { color: theme.placeholder }]}>
                    If an account exists for {normalizedEmail}, a reset email has been sent. Open the link on this device to choose a new password.
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: canSubmit ? '#968c6c' : '#bdb7a7',
                  opacity: canSubmit ? 1 : 0.7,
                },
              ]}
              onPress={handleSendResetLink}
              disabled={!canSubmit || isSending}
            >
              <Text style={styles.primaryButtonText}>
                {isSending ? 'Sending reset link...' : 'Send reset link'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(auth)/sign-in')}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
  },
  scrollContent: {
    flexGrow: 1,
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
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 10,
    ...font('SpaceGrotesk', '700'),
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    marginBottom: 18,
  },
  labelText: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 2.4,
    marginBottom: 8,
    color: '#968c6c',
  },
  input: {
    ...commonStyles.input,
    fontSize: 16,
  },
  errorText: {
    marginTop: 8,
    color: '#cf5f5f',
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  infoTitle: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
    ...font('SpaceGrotesk', '700'),
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    ...commonStyles.primaryButton,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
  },
  secondaryButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 15,
    lineHeight: 20,
    ...font('GlacialIndifference', '700'),
  },
});
