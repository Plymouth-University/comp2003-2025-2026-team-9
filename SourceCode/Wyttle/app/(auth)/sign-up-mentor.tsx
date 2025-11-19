import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/BackButton';
import { Toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';

export default function SignUpMentor() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [expertise, setExpertise] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const onSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword || !expertise) {
      setMsg('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setMsg('Passwords do not match.');
      return;
    }

    // In development, skip real sign-up so you can test the post-login UI
    if (__DEV__) {
      setMsg(null);
      router.replace('/(app)/home');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'mentor',
          fullName,
          expertise,
          experienceYears: experienceYears || null,
        },
      },
    });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg(null);
      router.replace('/(app)/home');
    }
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
          Mentor sign up
        </ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>FULL NAME</ThemedText>
        <TextInput
          placeholder="Full name"
          autoCapitalize="words"
          style={styles.input}
          onChangeText={setFullName}
          value={fullName}
        />

        <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>EMAIL</ThemedText>
        <TextInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          onChangeText={setEmail}
          value={email}
        />

        <ThemedText style={[styles.labelText, font('GlacialIndifference', '400')]}>PASSWORD</ThemedText>
        <TextInput
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          onChangeText={setPassword}
          value={password}
        />

        <ThemedText
          style={[styles.labelText, font('GlacialIndifference', '400')]}
        >
          CONFIRM PASSWORD
        </ThemedText>
        <TextInput
          placeholder="Confirm password"
          secureTextEntry
          style={styles.input}
          onChangeText={setConfirmPassword}
          value={confirmPassword}
        />

        <ThemedText
          style={[styles.labelText, font('GlacialIndifference', '400')]}
        >
          AREA OF EXPERTISE
        </ThemedText>
        <TextInput
          placeholder="e.g. Product design, career coaching"
          style={styles.input}
          onChangeText={setExpertise}
          value={expertise}
        />

        <ThemedText
          style={[styles.labelText, font('GlacialIndifference', '400')]}
        >
          YEARS OF EXPERIENCE (OPTIONAL)
        </ThemedText>
        <TextInput
          placeholder="e.g. 5"
          keyboardType="number-pad"
          style={styles.input}
          onChangeText={setExperienceYears}
          value={experienceYears}
        />

        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
          onPress={onSignUp}
        >
          <Text style={styles.primaryButtonText}>Create mentor account</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Want to sign up as a mentee instead?</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-up-mentee')}>
          <Text style={styles.footerLink}>Sign up as a mentee</Text>
        </TouchableOpacity>
      </View>

      <Toast
        visible={!!msg}
        message={msg ?? ''}
        variant="error"
        onDismiss={() => setMsg(null)}
      />
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
  primaryButton: {
    ...commonStyles.primaryButton,
    marginTop: 8,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
  },
  spacer: {
    height: 24,
  },
  footer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#8f8e8e',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333f5c',
  },
});
