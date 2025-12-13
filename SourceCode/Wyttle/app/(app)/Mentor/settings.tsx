import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { setThemeOverride } from '@/hooks/theme-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavigationHistory } from '../../../src/lib/navigation-history';
import { supabase, uploadProfilePhoto } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';

// Declare constants for layout animation
export default function MentorSettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { resetHistory } = useNavigationHistory();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  
  const [openSection, setOpenSection] = useState<string | null>(null);

  
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);

  // Accessibility demo state (text size)
  const [largeText, setLargeText] = useState<boolean>(false);



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

  // Toggle dropdown sections
  function toggleSection(id: string) {
    if (Platform.OS !== 'web') {
      // enable smooth layout
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpenSection((prev) => (prev === id ? null : id));
  }

  // Reusable component for rendering dropdowns
  function SettingsDropdown({
    id,
    title,
    children,
  }: {
    id: string;
    title: string;
    children?: React.ReactNode;
  }) {
    const open = openSection === id;

    return (
      <View style={[styles.dropdownContainer, { backgroundColor: theme.card }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => toggleSection(id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={[styles.sectionHeader, { borderBottomColor: theme.text + '0F' }]}
        >
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            {title}
          </ThemedText>

          {/* icon rotates based on open/closed state */}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.text}
            style={styles.chevron}
          />
        </TouchableOpacity>

        {/* Show items only if the section is open */}
        {open ? <View style={styles.itemsContainer}>{children}</View> : null}
      </View>
    );
  }

  // Handlers used by toggles and accessibility items
  function handleOpenTextSize() {
    setLargeText((s) => !s);
  }

  function toggleHighContrast() {
    setThemeOverride(colorScheme === 'dark' ? 'light' : 'dark');
  }

  function handleTogglePush(enabled: boolean) {
    setPushEnabled(enabled);
  }

  function handleToggleEmail(enabled: boolean) {
    setEmailEnabled(enabled);
  }
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
          subtitle="Profile options, accessibility, switch account, and notifications will live here."
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

      {/* Settings dropdowns */}
      <SettingsDropdown id="profiles" title="Profile Options">
        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/(app)/profile')}>
          <ThemedText style={styles.itemText}>View profile</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/(app)/profile' as any)}>
          <ThemedText style={styles.itemText}>Edit profile</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/(app)/profile' as any)}>
          <ThemedText style={styles.itemText}>Manage public info</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>

      <SettingsDropdown id="accessibility" title="Accessibility">
        <TouchableOpacity style={styles.itemRow} onPress={() => handleOpenTextSize()}>
          <ThemedText style={styles.itemText}>Text size</ThemedText>
          <ThemedText style={styles.itemSubText}>{largeText ? 'Large' : 'Default'}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.itemRow} onPress={() => toggleHighContrast()}>
          <ThemedText style={styles.itemText}>High contrast (theme)</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>

      <SettingsDropdown id="notifications" title="Notifications">
        <View style={styles.itemRowWithSwitch}>
          <ThemedText style={styles.itemText}>Push notifications</ThemedText>
          <Switch value={pushEnabled} onValueChange={handleTogglePush} />
        </View>

        <View style={styles.itemRowWithSwitch}>
          <ThemedText style={styles.itemText}>Email notifications</ThemedText>
          <Switch value={emailEnabled} onValueChange={handleToggleEmail} />
        </View>
      </SettingsDropdown>

      {/* Switch accounts */}
      <SettingsDropdown id="switch_accounts" title="Switch Accounts">
        <TouchableOpacity style={styles.itemRow} onPress={handleLogout}>
          <ThemedText style={styles.itemText}>Sign out</ThemedText>
        </TouchableOpacity>


      {/* Add account */}
        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/(auth)/sign-up' as any)}>
          <ThemedText style={styles.itemText}>Add account</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>
      </KeyboardAwareScrollView>
    </View>
  );
}

 

{/* Style sheets */}

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
  dropdownContainer: {
  marginBottom: 12,
  marginTop: 8,
  borderRadius: 10,
  overflow: 'hidden',
},
sectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingVertical: 16,
  paddingHorizontal: 12,
  borderBottomWidth: 1,
},
sectionTitle: {
  fontSize: 16,
},
chevron: {
  marginLeft: 12,
},
itemsContainer: {
  paddingVertical: 6,
},
itemRow: {
  paddingVertical: 14,
  paddingHorizontal: 12,
  flexDirection: 'row',
  alignItems: 'center',
},
itemText: {
  fontSize: 15,
},
itemSubText: {
  marginLeft: 'auto',
  fontSize: 13,
},
itemRowWithSwitch: {
  paddingVertical: 14,
  paddingHorizontal: 12,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
});


