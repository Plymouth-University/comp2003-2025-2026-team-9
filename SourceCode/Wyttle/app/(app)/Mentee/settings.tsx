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
import { setThemeOverride, setTextSize, useTextSize } from '@/hooks/theme-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavigationHistory } from '../../../src/lib/navigation-history';
import { supabase, uploadProfilePhoto } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';
import { TextInput } from 'react-native';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';


// Reusable component for rendering dropdowns
function SettingsDropdown({
  id,
  title,
  children,
  openSection,
  toggleSection,
  theme,
}: {
  id: string;
  title: string;
  children?: React.ReactNode;
  openSection: string | null;
  toggleSection: (id: string) => void;
  theme: any;
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

// Declare constants for layout animation
export default function MenteeSettingsScreen() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(false);
  const textSize = useTextSize();

  const [title, setTitle] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [workExperience, setWorkExperience] = useState('');
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { resetHistory } = useNavigationHistory();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [tokensBalance, setTokensBalance] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, tokens_balance')
        .eq('id', user.id)
        .maybeSingle();

      setPhotoUrl(profile?.photo_url ?? null);
      setTokensBalance(profile?.tokens_balance ?? null);
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

    

    const fetchAndPrefillProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
  
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('title, industry, location, bio, skills, work_experience')
          .eq('id', user.id)
          .maybeSingle();
  
        if (error) {
          console.warn('Failed to load profile for editing', error);
          return;
        }
  
        // If any of these are undefined then fall back to empty string so inputs are controlled
        setTitle(profile?.title ?? '');
        setIndustry(profile?.industry ?? '');
        setLocation(profile?.location ?? '');
        setBio(profile?.bio ?? '');
        setWorkExperience(profile?.work_experience ?? '');  
        setSkills(profile?.skills ?? []); 
      } catch (err) {
        console.warn('Error fetching profile for edit', err);
      }
    };
  
    const toggleEditProfile = async () => {
      // If opening the editor, set state, then prefill.
      if (!isEditingProfile) {
        setIsEditingProfile(true);
        await fetchAndPrefillProfile();
      } else {
        // closing editor
        setIsEditingProfile(false);
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
  

  // Handlers used by toggles and accessibility items
  function handleTogglePush(enabled: boolean) {
    setPushEnabled(enabled);
  }

  function handleToggleEmail(enabled: boolean) {
    setEmailEnabled(enabled);
  }
 
  function handleBuyTokensPlaceholder() {
    router.push('/(app)/Mentee/buy-tokens' as any);
  }
 
  const handleSaveProfile = async () => {
    //Behaviour: Null is ignored, whitespace clears field.
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Build update object only with trimmed non-empty values
    const updates: { [k: string]: any } = {};

    // If trimmed value is empty, set to null to clear the field
    if (title.length > 0) {
      updates.title = title.trim().length > 0 ? title.trim() : null;
    }
    if (industry.length > 0) {
      updates.industry = industry.trim().length > 0 ? industry.trim() : null;
    }
    if (location.length > 0) {
      updates.location = location.trim().length > 0 ? location.trim() : null;
    }
    if (bio.length > 0) {
      updates.bio = bio.trim().length > 0 ? bio.trim() : null;
    }
    if (workExperience.length > 0) { 
      updates.work_experience = workExperience.trim().length > 0 ? workExperience.trim() : null;
    }
    if (skills.length > 0) {
      updates.skills = skills;
    }

    // If there is nothing to update close editor
    if (Object.keys(updates).length === 0) {
      setIsEditingProfile(false);
      return;
    }

    try {
    await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
      console.log('Profile updated successfully');

    } catch (err) {
    console.warn('Failed to save profile', err);
    } finally {
    // close editor after save
    setIsEditingProfile(false);
    }
  };
 

  const handleUseMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted')  return;

    const pos = await Location.getCurrentPositionAsync({});
    const [place] = await Location.reverseGeocodeAsync(pos.coords);
    const friendly = [place?.city, place?.region, place?.country]
      .filter(Boolean)
      .join(', ');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        location: friendly || null,
        latitude: pos.coords.latitude, 
        longitude: pos.coords.longitude,
      })
      .eq('id', user.id);

    setLocation(friendly || '');
  };


  {/*Functio to handle the user logging out of their account*/}
  const handleLogout = async () => {
      await supabase.auth.signOut();
      resetHistory('/');
      router.replace({ pathname: '/', params: { from: 'logout' } });
    };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={false}
        extraScrollHeight={20}
      >
        <ScreenHeader
          title="Settings"
          subtitle="Profile options, accessibility, switch account, and notifications will live here. Null is ignored, whitespace clears fields"
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

      {/* Settings dropdowns */}
      <SettingsDropdown 
        id="profiles" 
        title="Profile Options"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <TouchableOpacity
          style={styles.itemRow}
          onPress={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              router.push({
                pathname: '/(app)/Mentee/profile-view',
                params: { userId: user.id },
              });
            }
          }}
        >
          <ThemedText style={styles.itemText}>View profile</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.itemRow}
          onPress={toggleEditProfile}
          accessibilityRole="button"
          accessibilityState={{ expanded: isEditingProfile }}
        >
        
          <ThemedText style={styles.itemText}>Edit profile</ThemedText>
        </TouchableOpacity>
          {isEditingProfile && (
            <View style={styles.profileDetailsSection}>
              <Text style={[styles.themeLabel, { color: theme.text }]}>Profile details</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Career / Role Title"
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
                placeholder="Short Bio"
                placeholderTextColor="#7f8186"
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={500}
              />

              {/* Work Experience text input */}
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Previous work experience"
                placeholderTextColor="#7f8186"
                value={workExperience}
                onChangeText={setWorkExperience}
              />


              {/* Skills Section */}
              {/* Display existing skill tags */}
<View style={styles.skillsContainer}>
  {skills.map((skill, index) => (
    <View key={index} style={styles.skillChip}>
      <Text style={styles.skillText}>{skill}</Text>
      <TouchableOpacity
        onPress={() => setSkills(skills.filter((_, i) => i !== index))}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={18} color="#666" />
      </TouchableOpacity>
    </View>
  ))}
</View>

{/* Add new skill input */}
<View style={styles.addSkillRow}>
  <TextInput
    style={[styles.skillInput, { color: theme.text }]}
    placeholder="Add a skill (max 5)"
    placeholderTextColor="#7f8186"
    value={newSkill}
    onChangeText={setNewSkill}
    onSubmitEditing={() => {
      if (newSkill.trim() && !skills.includes(newSkill.trim()) && skills.length < 5) {
        setSkills([...skills, newSkill.trim()]);
        setNewSkill('');
      }
    }}
  />
  <TouchableOpacity
    style={styles.addSkillButton}
    onPress={() => {
      if (newSkill.trim() && !skills.includes(newSkill.trim()) && skills.length < 5) {
        setSkills([...skills, newSkill.trim()]);
        setNewSkill('');
      }
    }}
  >
    <Ionicons name="add-circle" size={28} color="#333f5c" />
  </TouchableOpacity>
</View>
              

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>Save profile</Text>
              </TouchableOpacity>
            </View>
            
          )}

        <TouchableOpacity style={styles.itemRow} onPress={() => router.push('/(app)/Mentee/profile-view' as any)}>
          <ThemedText style={styles.itemText}>Manage public info</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>

      <SettingsDropdown 
        id="tokens" 
        title="Tokens"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <View style={styles.itemRow}>
          <ThemedText style={styles.itemText}>
            Token balance: {tokensBalance ?? 0}
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.itemRow} onPress={handleBuyTokensPlaceholder}>
          <ThemedText style={styles.itemText}>Buy tokens (coming soon)</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>

      <SettingsDropdown 
        id="accessibility" 
        title="Accessibility"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <View style={styles.itemRow}>
          <ThemedText style={styles.itemText}>Text size</ThemedText>
          <View style={styles.sliderContainer}>
            <ThemedText style={styles.sliderValue}>{textSize}px</ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={12}
              maximumValue={24}
              step={1}
              value={textSize}
              onValueChange={setTextSize}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E5E5EA"
              thumbTintColor="#007AFF"
            />
          </View>
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

      </SettingsDropdown>

      <SettingsDropdown 
        id="notifications" 
        title="Notifications"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
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
      <SettingsDropdown 
        id="switch_accounts" 
        title="Switch Accounts"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
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
profileDetailsSection: {
  paddingHorizontal: 12,
  paddingVertical: 8,
  gap: 10,
},
textInput: {
  borderWidth: 1,
  borderColor: '#c6c1ae',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
},
textArea: {
  borderWidth: 1,
  borderColor: '#c6c1ae',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 15,
  minHeight: 90,
  textAlignVertical: 'top',
},
locationButton: {
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 10,
  backgroundColor: '#1F2940',
},
locationButtonText: {
  color: '#fff',
  fontWeight: '600',
  textAlign: 'center',
},
saveButton: {
  paddingVertical: 14,
  borderRadius: 10,
  backgroundColor: '#333f5c',
  alignItems: 'center',
},
saveButtonText: {
  color: '#fff',
  fontWeight: '700',
},
skillsContainer: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginBottom: 8,
},
skillChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#e0e0e0',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  gap: 6,
},
skillText: {
  fontSize: 14,
  color: '#333',
},
addSkillRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
skillInput: {
  flex: 1,
  borderWidth: 1,
  borderColor: '#c6c1ae',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 15,
},
addSkillButton: {
  padding: 4,
},
charCounter: {
  fontSize: 12,
  color: '#666',
  textAlign: 'right',
  marginTop: 4,
},
limitText: {
  fontSize: 12,
  color: '#d32f2f',
  marginTop: 4,
},
sliderContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  flex: 1,
  marginLeft: 12,
},
slider: {
  flex: 1,
  height: 40,
},
sliderValue: {
  fontSize: 14,
  minWidth: 45,
  textAlign: 'right',
},
});


