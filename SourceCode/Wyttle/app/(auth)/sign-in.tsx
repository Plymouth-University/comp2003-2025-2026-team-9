import { router, useLocalSearchParams } from 'expo-router';
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


export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = typeof params.role === 'string' ? params.role : undefined;
  const isMentor = role === 'mentor';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const onSignIn = async () => {
  setMsg(null);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMsg(error.message);
    return;
  }

  // Optional: log for debugging
  // console.log('Signed in user:', data.user);

  router.replace('/(app)/home');
};


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <BackButton />
      <View style={styles.header}>
              <Logo size={96} style={styles.logo} />
              <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
              <ThemedText style={[styles.subText, { color: '#968c6c' }, font('GlacialIndifference', '800')]}>
          {isMentor ? 'Mentor' : role === 'mentee' ? '' : 'Sign in'}
        </ThemedText>
            </View>
      

      <View style={styles.form}>
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

        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#968c6c' }]}
          onPress={onSignIn}
        >
          
          <Text style={styles.primaryButtonText}>
            {isMentor ? 'Sign in as mentor' : role === 'mentee' ? 'Sign in as mentee' : 'Sign in'}
          </Text>
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
    fontSize: 26,
    lineHeight: 20,
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
  error: {
    color: '#c00',
    marginTop: 4,
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
