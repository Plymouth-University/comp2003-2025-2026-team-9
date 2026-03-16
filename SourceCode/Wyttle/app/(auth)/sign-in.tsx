import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { AuthBackButton } from '@/components/ui/AuthBackButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Toast } from '@/components/ui/Toast';
import type { ToastVariant } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font } from '../../src/lib/fonts';
import { listTotpFactors } from '../../src/lib/mfa';
import { initializeNotificationsForUser } from '../../src/lib/notifications';

const oauthProviders = [
  {
    id: 'google',
    label: 'Google',
    icon: require('../../assets/icons/google.png'),
  },
  {
    id: 'apple',
    label: 'Apple',
    icon: require('../../assets/icons/apple.png'),
  },
  {
    id: 'linkedin_oidc',
    label: 'LinkedIn',
    icon: require('../../assets/icons/linkedin.png'),
  },
] as const;

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string; from?: string; expired?: string }>();
  const roleParam = typeof params.role === 'string' ? params.role : undefined;
  const fromLogout = params.from === 'logout';
  const expired = typeof params.expired === 'string' ? params.expired : undefined;

  useEffect(() => {
    if (expired) {
      setMsgVariant('error');
      setMsg('Session expired. Please sign in again.');
    }
  }, [expired]);
  const isMentor = roleParam === 'mentor';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [pendingMfaFactorId, setPendingMfaFactorId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgVariant, setMsgVariant] = useState<ToastVariant>('error');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const completePostSignInRouting = async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMsg(userError?.message ?? 'Could not load user after sign-in.');
      return;
    }
    const user = userData.user;

    // 3) Look up their profile to determine role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setMsg(profileError.message);
      return;
    }

    const role = profile?.role ?? 'member';
    const approvalStatus = profile?.approval_status ?? 'pending';

    // Route unapproved users to the pending screen
    if (approvalStatus !== 'approved' && role !== 'admin') {
      router.replace('/(auth)/pending-approval');
      return;
    }

    try {
      await initializeNotificationsForUser(user.id);
    } catch (notificationError) {
      console.warn('Failed to initialize push notifications after sign-in', notificationError);
    }

    // 4) Route based on role
    if (role === 'mentor') {
      router.replace('/(app)/Mentor/connections'); // mentor area
    } else {
      router.replace('/(app)/Mentee/connections');    // mentee/member area
    }
  };

  const maybeRequireTwoFactor = async () => {
    const { data: assuranceData, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError) {
      throw assuranceError;
    }

    if (assuranceData.nextLevel !== 'aal2' || assuranceData.currentLevel === 'aal2') {
      return false;
    }

    const factors = await listTotpFactors();
    const verifiedFactor = factors.find((factor) => String(factor.status ?? '').toLowerCase() === 'verified');

    if (!verifiedFactor) {
      throw new Error(
        'Two-factor authentication is enabled on this account, but no verified authenticator was found. Disable and re-enable 2FA in Settings.',
      );
    }

    setPendingMfaFactorId(verifiedFactor.id);
    setMfaCode('');
    setMsgVariant('success');
    setMsg('Enter the 6-digit code from your authenticator app to finish signing in.');
    return true;
  };

  const onSignIn = async () => {
    setMsgVariant('error');
    setMsg(null);
    setIsSigningIn(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setMsg(error.message);
        return;
      }

      const needsTwoFactor = await maybeRequireTwoFactor();
      if (needsTwoFactor) {
        return;
      }

      await completePostSignInRouting();
    } catch (error: any) {
      setMsg(error?.message ?? 'Unable to sign in right now.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    const trimmedCode = mfaCode.trim();

    if (!pendingMfaFactorId) {
      setMsgVariant('error');
      setMsg('No two-factor challenge is waiting to be verified.');
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      setMsgVariant('error');
      setMsg('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setMsgVariant('error');
    setMsg(null);
    setIsVerifyingMfa(true);

    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingMfaFactorId,
        code: trimmedCode,
      });

      if (error) {
        setMsg(error.message);
        return;
      }

      setPendingMfaFactorId(null);
      setMfaCode('');
      await completePostSignInRouting();
    } catch (error: any) {
      setMsg(error?.message ?? 'Unable to verify your authenticator code right now.');
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleCancelTwoFactor = async () => {
    setPendingMfaFactorId(null);
    setMfaCode('');
    setMsg(null);
    await supabase.auth.signOut().catch(() => {});
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'linkedin_oidc') => {
    try {
      setMsg(null);

      // Build the deep-link URL that Supabase will redirect back to
      const redirectTo = Linking.createURL('/sign-in');

      // signInWithOAuth with PKCE returns a URL we need to open ourselves
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo,
          skipBrowserRedirect: true, // prevents auto-opening; we use WebBrowser instead
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      // Open the OAuth page in an in-app browser
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== 'success' || !result.url) {
        // User cancelled or the flow didn't complete
        return;
      }

      // Extract the auth code from the callback URL and exchange it for a session
      const parsedUrl = Linking.parse(result.url);
      const code = parsedUrl.queryParams?.code as string | undefined;

      if (!code) {
        setMsg('Authentication failed — no authorisation code received.');
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;

      const needsTwoFactor = await maybeRequireTwoFactor();
      if (needsTwoFactor) {
        return;
      }

      // Session is now active — look up the user's profile and route them
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMsg(userError?.message ?? 'Could not load user after sign-in.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, approval_status')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profileError) {
        setMsg(profileError.message);
        return;
      }

      // New OAuth user — no profile yet. Send them to the role chooser
      // with details pre-filled from their OAuth provider.
      if (!profile) {
        const meta = userData.user.user_metadata ?? {};
        const oauthParams = new URLSearchParams({
          oauthName: meta.full_name ?? meta.name ?? '',
          oauthEmail: userData.user.email ?? '',
          oauthAvatar: meta.avatar_url ?? meta.picture ?? '',
        }).toString();

        router.replace(`/(auth)/sign-up?${oauthParams}` as any);
        return;
      }

      const role = profile.role ?? 'member';
      const approvalStatus = profile.approval_status ?? 'pending';

      if (approvalStatus !== 'approved' && role !== 'admin') {
        router.replace('/(auth)/pending-approval');
        return;
      }

      try {
        await initializeNotificationsForUser(userData.user.id);
      } catch (notificationError) {
        console.warn('Failed to initialize push notifications after OAuth sign-in', notificationError);
      }

      if (role === 'mentor') {
        router.replace('/(app)/Mentor/connections');
      } else {
        router.replace('/(app)/Mentee/connections');
      }
    } catch (error: any) {
      setMsg(error?.message ?? 'Unable to start social login right now.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View
        style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            {!fromLogout && <AuthBackButton style={styles.headerBackButton} />}
            <Logo size={96} style={styles.logo} />
            <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
            <ThemedText
              style={[styles.subText, { color: '#968c6c' }, font('GlacialIndifference', '800')]}
            >
              {isMentor ? 'Mentor' : roleParam === 'member' ? '' : 'Sign in'}
            </ThemedText>
          </View>

        <View style={styles.form}>
          <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>EMAIL</ThemedText>
          <TextInput
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            style={[
              styles.input,
              { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text },
            ]}
            placeholderTextColor={theme.placeholder}
            onChangeText={setEmail}
            value={email}
          />

          <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>PASSWORD</ThemedText>
          <View style={styles.passwordField}>
            <TextInput
              placeholder="Password"
              secureTextEntry={!showPassword}
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text },
              ]}
              placeholderTextColor={theme.placeholder}
              onChangeText={setPassword}
              value={password}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <IconSymbol
                name={showPassword ? 'eye.slash' : 'eye'}
                size={20}
                color="#333f5c"
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/(auth)/forgot-password')}
          >
          <Text style={[styles.forgotPasswordText, { color: theme.tint }]}>Forgot password?</Text>
          </TouchableOpacity>

          {pendingMfaFactorId ? (
            <>
              <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>
                AUTHENTICATOR CODE
              </ThemedText>
              <TextInput
                placeholder="123456"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={6}
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text },
                ]}
                placeholderTextColor={theme.placeholder}
                onChangeText={setMfaCode}
                value={mfaCode}
              />

              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
                onPress={handleVerifyTwoFactor}
                disabled={isVerifyingMfa}
              >
                <Text style={styles.primaryButtonText}>
                  {isVerifyingMfa ? 'Verifying code...' : 'Verify 2FA code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => {
                  void handleCancelTwoFactor();
                }}
                disabled={isVerifyingMfa}
              >
                <Text style={[styles.secondaryActionText, { color: theme.tint }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.spacer} />
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
                onPress={onSignIn}
                disabled={isSigningIn}
              >
                <Text style={styles.primaryButtonText}>
                  {isSigningIn
                    ? 'Signing in...'
                    : isMentor
                      ? 'Sign in as mentor'
                      : roleParam === 'member'
                        ? 'Sign in as member'
                        : 'Sign in'}
                </Text>
              </TouchableOpacity>

              <View style={styles.oauthContainer}>
                <View style={styles.oauthButtonsRow}>
                  {oauthProviders.map((provider) => (
                    <TouchableOpacity
                      key={provider.id}
                      style={styles.oauthButton}
                      onPress={() => handleOAuthSignIn(provider.id)}
                    >
                      <Image source={provider.icon} style={styles.oauthButtonIcon} resizeMode="contain" />
                      <View style={styles.oauthButtonTextWrapper}>
                        <Text style={styles.oauthButtonText}>Continue with {provider.label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* ⬇️ New footer: Sign-up entry point */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.text }]}>Don&apos;t have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={[styles.footerLink, { color: theme.tint }]}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast
        visible={!!msg}
        message={msg ?? ''}
        variant={msgVariant}
        onDismiss={() => {
          setMsg(null);
          setMsgVariant('error');
        }}
      />
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
    paddingBottom: 48,
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
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 2,
    color: '#8f8e8e',
    alignContent: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    marginBottom: 4,
    marginTop: 18,
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
    marginTop: 18,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '500',
    opacity: 0.8,
  },
  form: {
    gap: 12,
  },
  input: {
    ...commonStyles.input,
  },
  primaryButton: {
    ...commonStyles.primaryButton,
    marginTop: 8,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
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
  passwordToggleText: {
    fontSize: 14,
    color: '#333f5c',
    fontWeight: '600',
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButton: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: '#c00',
    marginTop: 4,
  },
  footer: {
    marginTop: 36,
    paddingTop: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
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
  oauthContainer: {
    marginTop: 18,
    gap: 12,
  },
  oauthButtonsRow: {
    gap: 10,
  },
  oauthButton: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#c6c1ae',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  oauthButtonIcon: {
    width: 20,
    height: 20,
  },
  oauthButtonTextWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthButtonText: {
    color: '#333f5c',
    fontWeight: '600',
    fontSize: 13,
  },
  // When there is no BackButton (e.g. after logout), we reserve the
  // same vertical space so the logo/title don't jump upwards and
  // stay comfortably below the dynamic island.
  noBackTopSpacer: {
    height: 52,
    marginBottom: 8,
  },
});
