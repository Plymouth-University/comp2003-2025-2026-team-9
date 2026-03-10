import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { ThemedText } from '@/components/themed-text';
import { Toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../src/lib/fonts';
import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

export default function PendingApproval() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [msg, setMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, approval_status')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        setMsg(error.message);
        return;
      }

      const status = profile?.approval_status ?? 'pending';

      if (status === 'approved') {
        const role = profile?.role ?? 'member';
        if (role === 'mentor') {
          router.replace('/(app)/Mentor/connections');
        } else {
          router.replace('/(app)/Mentee/connections');
        }
      } else if (status === 'rejected') {
        setMsg('Your application has been declined. Please contact support for more information.');
      } else {
        setMsg('Your account is still under review. Please check back later.');
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Something went wrong.');
    } finally {
      setChecking(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in?from=logout');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Logo size={96} style={styles.logo} />
        <ThemedText style={[styles.appName, font('SpaceGrotesk', '400')]}>WYTTLE</ThemedText>
      </View>

      <View style={styles.content}>
        <ThemedText style={[styles.title, font('GlacialIndifference', '800')]}>
          Account Under Review
        </ThemedText>
        <ThemedText style={[styles.body, { color: theme.text }]}>
          Your sign-up request has been submitted and is awaiting admin approval.
          You'll be able to access the app once your account is approved.
        </ThemedText>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: '#968c6c', opacity: checking ? 0.6 : 1 }]}
          onPress={checkStatus}
          disabled={checking}
        >
          <Text style={styles.primaryButtonText}>
            {checking ? 'Checking...' : 'Check status'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.textButton} onPress={signOut}>
          <Text style={[styles.textButtonLabel, { color: theme.tint }]}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <Toast visible={!!msg} message={msg ?? ''} onDismiss={() => setMsg(null)} />
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
  content: {
    flex: 1,
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
    marginTop: -60,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
    color: '#968c6c',
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    ...commonStyles.primaryButton,
    paddingVertical: 16,
    borderRadius: 10,
  },
  primaryButtonText: {
    ...commonStyles.primaryButtonText,
  },
  textButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  textButtonLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
