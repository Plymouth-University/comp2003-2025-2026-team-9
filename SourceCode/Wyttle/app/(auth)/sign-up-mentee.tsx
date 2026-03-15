import { router, useLocalSearchParams } from 'expo-router';
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

import * as ImagePicker from 'expo-image-picker';

import { supabase, uploadProfilePhoto } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

import { Logo } from '@/components/Logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { AuthBackButton } from '@/components/ui/AuthBackButton';
import { Toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';
import { initializeNotificationsForUser } from '../../src/lib/notifications';

export default function SignUpMember() {
  const insets = useSafeAreaInsets();

  // OAuth pre-fill params (empty strings for normal sign-up)
  const { oauthName, oauthEmail, oauthAvatar } = useLocalSearchParams<{
    oauthName?: string;
    oauthEmail?: string;
    oauthAvatar?: string;
  }>();
  const isOAuth = !!(oauthName || oauthEmail || oauthAvatar);

  const [fullName, setFullName] = useState(oauthName ?? '');
  const [email, setEmail] = useState(oauthEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [goals, setGoals] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(oauthAvatar || null);
  const [msg, setMsg] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setMsg('Permission to access photos is required to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSignUp = async () => {
  if (!fullName) {
    setMsg('Please enter your name.');
    return;
  }

  if (!isOAuth) {
    // Normal sign-up: validate email & password
    if (!email || !password || !confirmPassword) {
      setMsg('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setMsg('Passwords do not match.');
      return;
    }
  }

  setMsg(null);

  let userId: string;

  if (isOAuth) {
    // OAuth user is already signed in — just grab the existing session user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setMsg(userError?.message ?? 'OAuth session expired. Please sign in again.');
      return;
    }
    userId = userData.user.id;
  } else {
    // Normal email/password sign-up
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'member',
          fullName,
          goals: goals || null,
        },
      },
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setMsg('Sign up succeeded, but no user returned. Check email confirmation settings.');
      return;
    }
    userId = user.id;
  }

  // Create / update profile row in the DB
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: fullName,
    role: 'member',
    bio: goals || null,
    photo_url: (isOAuth && oauthAvatar) ? oauthAvatar : null,
    approval_status: 'pending',
  });

  if (profileError) {
    setMsg(profileError.message);
    return;
  }

  // Insert an application row so admins have context for the review
  const effectiveEmail = isOAuth ? (oauthEmail ?? '') : email;
  const { error: appError } = await supabase.from('applications').insert({
    user_email: effectiveEmail,
    user_type: 'member',
    name: fullName,
    goals: goals || null,
    status: 'pending',
  });
  if (appError) {
    console.warn('Failed to insert application row', appError);
  }

  // If they picked / changed an avatar (local file), upload it.
  // Skip upload for OAuth URLs (they're already remote).
  if (avatarUri && !avatarUri.startsWith('http')) {
    try {
      await uploadProfilePhoto(avatarUri);
    } catch (e) {
      console.warn('Failed to upload profile photo', e);
    }
  }

  try {
    await initializeNotificationsForUser(userId);
  } catch (notificationError) {
    console.warn('Failed to initialize push notifications after sign-up', notificationError);
  }

  // Route to pending approval screen instead of the main app
  router.replace('/(auth)/pending-approval');
};


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: theme.background, paddingBottom: insets.bottom }]}> 
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
              Member sign up
            </ThemedText>
          </View>

      <View style={styles.form}>
        <TouchableOpacity style={styles.avatarPicker} onPress={handlePickAvatar}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarPlaceholderText}>Add profile photo</Text>
          )}
        </TouchableOpacity>

        <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>FULL NAME</ThemedText>
        <TextInput
          placeholder="Full name"
          autoCapitalize="words"
          style={[styles.input, { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text }]}
          placeholderTextColor={theme.placeholder}
          onChangeText={setFullName}
          value={fullName}
        />

        {/* Hide email & password fields for OAuth users — they're already authenticated */}
        {!isOAuth && (
          <>
            <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>EMAIL</ThemedText>
            <TextInput
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text }]}
              placeholderTextColor={theme.placeholder}
              onChangeText={setEmail}
              value={email}
            />

            <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>PASSWORD</ThemedText>
            <View style={styles.passwordField}>
              <TextInput
                placeholder="Password"
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text }]}
                placeholderTextColor={theme.placeholder}
                onChangeText={setPassword}
                value={password}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            <ThemedText
              style={[styles.labelText, font('GlacialIndifference', '400')]}
            >
              CONFIRM PASSWORD
            </ThemedText>
            <View style={styles.passwordField}>
              <TextInput
                placeholder="Confirm password"
                secureTextEntry={!showConfirmPassword}
                style={[styles.input, styles.passwordInput, { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text }]}
                placeholderTextColor={theme.placeholder}
                onChangeText={setConfirmPassword}
                value={confirmPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <ThemedText
          style={[styles.labelText, font('GlacialIndifference', '400')]}
        >
          GOALS (OPTIONAL)
        </ThemedText>
        <TextInput
          placeholder="What would you like to get out of mentoring?"
          style={[styles.input, styles.multilineInput, { backgroundColor: theme.card, borderColor: theme.tint, color: theme.text }]}
          placeholderTextColor={theme.placeholder}
          multiline
          numberOfLines={3}
          onChangeText={setGoals}
          value={goals}
        />

        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#333f5c' }]}
          onPress={onSignUp}
        >
          <Text style={styles.primaryButtonText}>Create member account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.text }]}>Want to sign up as a mentor instead?</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up-mentor')}>
          <Text style={[styles.footerLink, { color: theme.tint }]}>Sign up as a mentor</Text>
        </TouchableOpacity>
      </View>

        <Toast
          visible={!!msg}
          message={msg ?? ''}
          variant="error"
          onDismiss={() => setMsg(null)}
        />
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
    paddingBottom: 32,
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
    color: '#8f8e8e',
    textAlign: 'center',
    marginTop: 12,
  },
  form: {
    gap: 12,
  },
  labelText: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 2,
    color: '#8f8e8e',
    textAlign: 'center',
    marginBottom: 4,
    marginTop: 18,
  },
  input: {
    ...commonStyles.input,
  },
  multilineInput: {
    textAlignVertical: 'top',
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
  spacer: {
    height: 24,
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 24,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  avatarPicker: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholderText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
