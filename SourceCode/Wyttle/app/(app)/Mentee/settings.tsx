import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

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
  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, title, industry, location, bio')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setPhotoUrl(profile.photo_url ?? null);
        setTitle(profile.title ?? '');
        setIndustry(profile.industry ?? '');
        setLocation((profile as any).location ?? '');
        setBio(profile.bio ?? '');
      }
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

  const handleSaveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        title: title.trim() || null,
        industry: industry.trim() || null,
        location: location.trim() || null,
        bio: bio.trim() || null,
      })
      .eq('id', user.id);
  };

  const handleUseMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const pos = await Location.getCurrentPositionAsync({});
    const [place] = await Location.reverseGeocodeAsync(pos.coords);

    const friendly = [place.city, place.region, place.country]
      .filter(Boolean)
      .join(', ');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        location: friendly,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      })
      .eq('id', user.id);

    setLocation(friendly);
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={20}
      >
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

          <View style={styles.profileDetailsSection}>
            <Text style={[styles.themeLabel, { color: theme.text }]}>Profile details</Text>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Career / role title"
              placeholderTextColor="#7f8186"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Industry"
              placeholderTextColor="#7f8186"
              value={industry}
              onChangeText={setIndustry}
            />
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Location"
              placeholderTextColor="#7f8186"
              value={location}
              onChangeText={setLocation}
            />
            <TouchableOpacity style={styles.locationButton} onPress={handleUseMyLocation}>
              <Text style={styles.locationButtonText}>Use my current location</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.textArea, { color: theme.text }]}
              placeholder="Short bio"
              placeholderTextColor="#7f8186"
              value={bio}
              onChangeText={setBio}
              multiline
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Save profile</Text>
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
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
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
  profileDetailsSection: {
    marginTop: 16,
  },
  textInput: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  textArea: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#333f5c',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  locationButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  locationButtonText: {
    fontSize: 12,
    color: '#333f5c',
    textDecorationLine: 'underline',
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
