import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { commonStyles } from '../../../src/styles/common';
import { supabase, uploadProfilePhoto } from '../../../src/lib/supabase';

export default function MenteeSettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

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
    router.replace('/(auth)/sign-in');
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
          <Text style={styles.changePhotoText}>Change profile photo</Text>
        </TouchableOpacity>
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
    color: '#1F2940',
    fontWeight: '600',
  },
});
