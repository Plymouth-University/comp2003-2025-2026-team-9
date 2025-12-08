import { router } from 'expo-router';
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
  Image,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { supabase, uploadProfilePhoto } from '../../src/lib/supabase';
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
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const onSignUp = async () => {
  if (!fullName || !email || !password || !confirmPassword || !expertise) {
    setMsg('Please fill in all required fields.');
    return;
  }

  if (password !== confirmPassword) {
    setMsg('Passwords do not match.');
    return;
  }

  setMsg(null);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'mentor',              // metadata
        fullName,
        expertise,
        experienceYears: experienceYears || null,
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

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: fullName,
    role: 'mentor',
    bio: expertise,
    // can add extra columns later if we extend the schema
  });

  if (profileError) {
    setMsg(profileError.message);
    return;
  }

  // If they picked an avatar, upload it and update photo_url.
  if (avatarUri) {
    try {
      await uploadProfilePhoto(avatarUri);
    } catch (e) {
      console.warn('Failed to upload profile photo', e);
    }
  }

  // Send mentors to their main app area (Mentor connections tab)
  router.replace('/(app)/Mentor/connections');
};


  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        > 
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
    paddingHorizontal: 24,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#8f8e8e',
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333f5c',
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
