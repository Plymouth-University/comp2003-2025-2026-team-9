import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { setThemeOverride } from '@/hooks/theme-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavigationHistory } from '../../../src/lib/navigation-history';
import { supabase, uploadProfilePhoto } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

export default function MenteeSettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { resetHistory } = useNavigationHistory();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', user.id)
        .maybeSingle();

      setPhotoUrl(profile?.photo_url ?? null);
    })();
  }, []);

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const uri = result.assets[0].uri;

    try {
      const newUrl = await uploadProfilePhoto(uri);
      setPhotoUrl(newUrl);
    } catch (e) {
      console.warn('Failed to update profile photo', e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear any in-app navigation history so back from auth cannot
    // jump into stale member routes after logging out.
    resetHistory('/');
    router.replace({ pathname: '/', params: { from: 'logout' } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Settings"
        subtitle="Profile options, accessibility, account, tokens, and notifications will live here."
      />

      <View style={styles.profileSection}>
        <Image
          source={
            photoUrl
              ? { uri: photoUrl }
              : { uri: 'https://placehold.co/96x96?text=Me' }
          }
          style={styles.avatar}
        />
        <TouchableOpacity onPress={handleChangePhoto}>
          <Text style={[styles.changePhotoText, { color: theme.tint }]}>Change profile photo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.themeSection}>
        <Text style={[styles.themeLabel, { color: theme.text }]}>Appearance</Text>
        <View style={styles.themeButtonsRow}>
          <TouchableOpacity
            style={[
              styles.themeChip,
              colorScheme !== 'dark' && styles.themeChipActive,
            ]}
            onPress={() => setThemeOverride('light')}
          >
            <Text
              style={[
                styles.themeChipText,
                colorScheme !== 'dark' && styles.themeChipTextActive,
              ]}
            >
              Light
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeChip,
              colorScheme === 'dark' && styles.themeChipActive,
            ]}
            onPress={() => setThemeOverride('dark')}
          >
            <Text
              style={[
                styles.themeChipText,
                colorScheme === 'dark' && styles.themeChipTextActive,
              ]}
            >
              Dark
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#1F2940',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  profileSection: {
    marginTop: 24,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d9d9d9',
  },
  changePhotoText: {
    fontWeight: '600',
  },
  themeSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  themeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  themeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c6c1ae',
  },
  themeChipActive: {
    backgroundColor: '#333f5c',
    borderColor: '#333f5c',
  },
  themeChipText: {
    fontSize: 13,
    color: '#333f5c',
  },
  themeChipTextActive: {
    color: '#fff',
  },
});
