import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
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
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font } from '../../src/lib/fonts';
import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

const RECOVERY_LINK_INVALID_MESSAGE =
  'This reset link is invalid or expired. Request a new link and try again.';

function readParamsFromUrl(url: string): URLSearchParams {
  const params = new URLSearchParams();

  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) {
    const hashIndex = url.indexOf('#', queryIndex);
    const queryString = url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
    if (queryString) {
      const queryParams = new URLSearchParams(queryString);
      queryParams.forEach((value, key) => params.set(key, value));
    }
  }

  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    const fragment = url.slice(hashIndex + 1);
    if (fragment) {
      const fragmentParams = new URLSearchParams(fragment);
      fragmentParams.forEach((value, key) => params.set(key, value));
    }
  }

  return params;
}

export default function ResetPassword() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isLinkReady, setIsLinkReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);

  const canSubmit =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !isSaving &&
    !isCheckingLink &&
    isLinkReady &&
    !isUpdated;

  useEffect(() => {
    let isMounted = true;

    const applyRecoveryUrl = async (url: string) => {
      const params = readParamsFromUrl(url);
      const type = params.get('type');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const code = params.get('code');

      if (type !== 'recovery' && !code) {
        return false;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) {
          return true;
        }

        if (exchangeError) {
          setIsLinkReady(false);
          setLinkError(exchangeError.message || RECOVERY_LINK_INVALID_MESSAGE);
        } else {
          setIsLinkReady(true);
          setLinkError(null);
        }
        setIsCheckingLink(false);
        return true;
      }

      if (!accessToken || !refreshToken) {
        if (isMounted) {
          setIsLinkReady(false);
          setLinkError(RECOVERY_LINK_INVALID_MESSAGE);
          setIsCheckingLink(false);
        }
        return true;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!isMounted) {
        return true;
      }

      if (sessionError) {
        setIsLinkReady(false);
        setLinkError(sessionError.message || RECOVERY_LINK_INVALID_MESSAGE);
      } else {
        setIsLinkReady(true);
        setLinkError(null);
      }
      setIsCheckingLink(false);
      return true;
    };

    const validateLink = async () => {
      setIsCheckingLink(true);

      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const handled = await applyRecoveryUrl(initialUrl);
          if (handled) {
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (session) {
          setIsLinkReady(true);
          setLinkError(null);
        } else {
          setIsLinkReady(false);
          setLinkError('Open this screen from your reset email link to continue.');
        }
      } catch {
        if (!isMounted) {
          return;
        }
        setIsLinkReady(false);
        setLinkError('Unable to validate your reset link right now. Please request a new one.');
      } finally {
        if (isMounted) {
          setIsCheckingLink(false);
        }
      }
    };

    void validateLink();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!isMounted) {
        return;
      }

      setIsCheckingLink(true);
      void applyRecoveryUrl(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const handleUpdatePassword = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!isLinkReady) {
      setError('Your reset link is not ready. Request a new link and try again.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut().catch(() => {});
      setIsUpdated(true);
    } catch (updatePasswordError: any) {
      setError(updatePasswordError?.message ?? 'Unable to update password right now.');
    } finally {
      setIsSaving(false);
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
              Choose a new password
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
            <Text style={[styles.cardTitle, { color: theme.text }]}>Reset password</Text>
            <Text style={[styles.cardBody, { color: theme.placeholder }]}>
              {isCheckingLink
                ? 'Validating your reset link...'
                : isUpdated
                  ? 'Password updated successfully.'
                  : 'Enter a new password with at least 8 characters.'}
            </Text>

            {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}

            {isUpdated ? (
              <View style={styles.successBox}>
                <Text style={[styles.successTitle, { color: theme.text }]}>All set</Text>
                <Text style={[styles.successText, { color: theme.placeholder }]}>
                  Your password has been updated. Use it on the sign-in screen.
                </Text>
              </View>
            ) : (
              <View style={styles.form}>
                <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>
                  NEW PASSWORD
                </ThemedText>
                <View style={styles.passwordField}>
                  <TextInput
                    placeholder="New password"
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#0d1220' : '#ffffff',
                        borderColor: error ? '#cf5f5f' : theme.tint,
                        color: theme.text,
                      },
                    ]}
                    placeholderTextColor={theme.placeholder}
                    onChangeText={(value) => {
                      setPassword(value);
                      if (error) setError(null);
                    }}
                    value={password}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword((previous) => !previous)}
                  >
                    <IconSymbol
                      name={showPassword ? 'eye.slash' : 'eye'}
                      size={20}
                      color="#333f5c"
                    />
                  </TouchableOpacity>
                </View>

                <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>
                  CONFIRM PASSWORD
                </ThemedText>
                <View style={styles.passwordField}>
                  <TextInput
                    placeholder="Confirm password"
                    secureTextEntry={!showConfirmPassword}
                    textContentType="newPassword"
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      styles.passwordInput,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#0d1220' : '#ffffff',
                        borderColor: error ? '#cf5f5f' : theme.tint,
                        color: theme.text,
                      },
                    ]}
                    placeholderTextColor={theme.placeholder}
                    onChangeText={(value) => {
                      setConfirmPassword(value);
                      if (error) setError(null);
                    }}
                    value={confirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword((previous) => !previous)}
                  >
                    <IconSymbol
                      name={showConfirmPassword ? 'eye.slash' : 'eye'}
                      size={20}
                      color="#333f5c"
                    />
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}

            {isUpdated ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
                onPress={() => router.replace('/(auth)/sign-in')}
              >
                <Text style={styles.primaryButtonText}>Back to sign in</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: canSubmit ? '#968c6c' : '#bdb7a7',
                    opacity: canSubmit ? 1 : 0.7,
                  },
                ]}
                onPress={handleUpdatePassword}
                disabled={!canSubmit}
              >
                <Text style={styles.primaryButtonText}>
                  {isSaving ? 'Updating password...' : 'Update password'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.replace('/(auth)/forgot-password')}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>
                Request a new reset link
              </Text>
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
    marginBottom: 18,
  },
  form: {
    marginBottom: 18,
  },
  labelText: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 2.4,
    marginBottom: 8,
    marginTop: 8,
    color: '#968c6c',
  },
  input: {
    ...commonStyles.input,
    fontSize: 16,
  },
  passwordField: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 72,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 14,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  errorText: {
    marginTop: 8,
    color: '#cf5f5f',
    fontSize: 13,
    lineHeight: 18,
  },
  successBox: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#d8cfbc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#f4efe4',
  },
  successTitle: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
    ...font('SpaceGrotesk', '700'),
  },
  successText: {
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
