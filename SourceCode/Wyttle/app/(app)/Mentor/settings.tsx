import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { setTextSize, setThemeOverride, useTextSize } from '@/hooks/theme-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { TextInput } from 'react-native';
import OnboardingOverlay from '../../../src/components/OnboardingOverlay';
import { font } from '../../../src/lib/fonts';
import { useNavigationHistory } from '../../../src/lib/navigation-history';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  getNotificationPreferences,
  registerPushToken,
  unregisterPushToken,
  updateNotificationPreferences,
} from '../../../src/lib/notifications';
import { MENTEE_STEPS } from '../../../src/lib/onboarding';
import { supabase, uploadProfilePhoto } from '../../../src/lib/supabase';
import { commonStyles } from '../../../src/styles/common';


// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Reusable component for rendering dropdowns
function SettingsDropdown({
  id,
  title,
  icon,
  children,
  openSection,
  toggleSection,
  theme,
}: {
  id: string;
  title: string;
  icon?: string;
  children?: React.ReactNode;
  openSection: string | null;
  toggleSection: (id: string) => void;
  theme: any;
}) {
  const open = openSection === id;
  const animatedHeight = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (open && contentHeight > 0 && isReady) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: contentHeight,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } else if (!open && isReady) {
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [open, contentHeight, isReady]);

  return (
    <View style={[styles.dropdownContainer, { backgroundColor: 'transparent' }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleSection(id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.sectionHeaderRow}
      >
        <View style={[styles.headerContentRow, { flex: 1, borderBottomWidth: 1, borderBottomColor: theme.text + '22' }]}> 
          {icon && (
            <Ionicons
              name={icon as any}
              size={22}
              color={theme.text}
              style={styles.headerIcon}
            />
          )}
          <ThemedText
            type="defaultSemiBold"
            style={[styles.sectionTitle, font('GlacialIndifference', '400')]}
          >
            {title}
          </ThemedText>
        </View>

        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={theme.text}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {/* Hidden view to measure content height */}
      <View
        style={[styles.measureContainer, { position: 'absolute', opacity: 0, left: 0, right: 0 }]}
        onLayout={(e) => {
          const height = e.nativeEvent.layout.height;
          if (height > 0) {
            setContentHeight(height);
            if (!isReady) {
              setIsReady(true);
            }
          }
        }}
      >
        <View style={styles.itemsContainer}>
          {children}
        </View>
      </View>

      {/* Animated dropdown content */}
      {isReady && (
        <Animated.View
          style={[
            styles.animatedContainer,
            {
              height: animatedHeight,
              opacity: animatedOpacity,
              left: 0,
              right: 0,
              width: '100%',
            },
          ]}
        >
          <View style={styles.itemsContainer}>
            {children}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// Declare constants for layout animation
export default function MenteeSettingsScreen() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<keyof NotificationPreferences | null>(null);
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
  const [lookingFor, setLookingFor] = useState('');
  const [tokensBalance, setTokensBalance] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, tokens_balance')
        .eq('id', user.id)
        .maybeSingle();
      const prefs = await getNotificationPreferences(user.id);

      setPhotoUrl(profile?.photo_url ?? null);
      setTokensBalance(profile?.tokens_balance ?? null);
      setNotificationPrefs(prefs);
    })();
  }, []);

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
          .select('title, industry, location, bio, skills, work_experience, looking_for')
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
        const rawLf = (profile as any)?.looking_for;
        if (Array.isArray(rawLf)) {
          setLookingFor(rawLf.filter(Boolean).join(', '));
        } else if (typeof rawLf === 'string') {
          setLookingFor(rawLf);
        } else {
          setLookingFor('');
        } 
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
    setOpenSection((prev) => (prev === id ? null : id));
  }
  

  const handleNotificationToggle = async (
    key: keyof NotificationPreferences,
    enabled: boolean,
  ) => {
    const previous = notificationPrefs;
    const next = { ...notificationPrefs, [key]: enabled };
    setNotificationPrefs(next);
    setSavingPreferenceKey(key);

    try {
      await updateNotificationPreferences({ [key]: enabled } as Partial<NotificationPreferences>);

      if (key === 'push_enabled') {
        if (enabled) {
          await registerPushToken();
        } else {
          await unregisterPushToken();
        }
      }
    } catch (error) {
      console.warn(`Failed to update notification preference: ${key}`, error);
      setNotificationPrefs(previous);
    } finally {
      setSavingPreferenceKey(null);
    }
  };
 
  function handleBuyTokensPlaceholder() {
    router.push('/(app)/Mentee/buy-tokens' as any);
  }
 
  const handleSaveProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Build update object - trim values and set to null if empty
    const updates: { [k: string]: any } = {
      title: title.trim().length > 0 ? title.trim() : null,
      industry: industry.trim().length > 0 ? industry.trim() : null,
      location: location.trim().length > 0 ? location.trim() : null,
      bio: bio.trim().length > 0 ? bio.trim() : null,
      work_experience: workExperience.trim().length > 0 ? workExperience.trim() : null,
      skills: skills.length > 0 ? skills : null,
      looking_for: lookingFor.trim().length > 0 ? lookingFor.trim() : null,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (error) {
        console.error('Failed to save profile:', error);
      } else {
        console.log('Profile updated successfully');
      }
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
      await unregisterPushToken();
      await supabase.auth.signOut();
      resetHistory('/');
      router.replace({ pathname: '/', params: { from: 'logout' } });
    };

  const notificationOptions: { key: keyof NotificationPreferences; label: string }[] = [
    { key: 'push_enabled', label: 'Push notifications' },
    { key: 'notify_new_message', label: 'New messages' },
    { key: 'notify_incoming_like', label: 'Incoming connection requests' },
    { key: 'notify_mutual_connection', label: 'Mutual connections' },
    { key: 'notify_mentor_request_updates', label: 'Mentor request updates' },
    { key: 'notify_session_reminder_1h', label: 'Session reminder (1 hour)' },
    { key: 'notify_session_reminder_15m', label: 'Session reminder (15 minutes)' },
    { key: 'notify_session_starting_now', label: 'Session starting now' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.background, minHeight: '100%' }]}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={false}
        extraScrollHeight={20}
      >
        <ScreenHeader
          title="Settings"
          subtitle="Manage your profile, preferences, and notifications."
        />

        {/* Settings dropdowns */}
        <SettingsDropdown 
        id="profiles" 
        title="Profile Options"
        icon="person-outline"
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
                pathname: '/(app)/Mentee/profile-view' as any,
                params: { userId: user.id },
              });
            }
          }}
        >
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
            { flex: 1 },
          ]}>View profile</ThemedText>
          <Ionicons name="chevron-forward" size={18} color={theme.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.itemRow}
          onPress={toggleEditProfile}
          accessibilityRole="button"
          accessibilityState={{ expanded: isEditingProfile }}
        >
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
            { flex: 1 },
          ]}>Edit profile</ThemedText>
          <Ionicons name={isEditingProfile ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
          {isEditingProfile && (
            <View style={styles.profileDetailsSection}>
              <Text style={[styles.themeLabel, { color: theme.text }]}>Profile details</Text>
              
              <View style={styles.profilePhotoSection}>
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
              
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Career / Role Title</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Career / Role Title"
                placeholderTextColor="#7f8186"
                value={title}
                onChangeText={setTitle}
              />
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Industry</Text>
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Industry"
                placeholderTextColor="#7f8186"
                value={industry}
                onChangeText={setIndustry}
              />
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Location</Text>
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


              <Text style={[styles.fieldLabel, { color: theme.text }]}>Bio</Text>
              <TextInput
                style={[styles.textArea, { color: theme.text }]}
                placeholder="Short Bio"
                placeholderTextColor="#7f8186"
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={500}
              />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Work Experience</Text>
              {/* Work Experience text input */}
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Previous work experience"
                placeholderTextColor="#7f8186"
                value={workExperience}
                onChangeText={setWorkExperience}
              />


              <Text style={[styles.fieldLabel, { color: theme.text }]}>Skills</Text>
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

              <Text style={[styles.fieldLabel, { color: theme.text }]}>I am looking for</Text>
              {/* Looking For Section */}
              <TextInput
                style={[styles.textArea, { color: theme.text }]}
                placeholder="I am looking for..."
                placeholderTextColor="#7f8186"
                value={lookingFor}
                onChangeText={setLookingFor}
                multiline
                maxLength={500}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>Save profile</Text>
              </TouchableOpacity>
            </View>
            
          )}
      </SettingsDropdown>

      <SettingsDropdown 
        id="tokens" 
        title="Tokens"
        icon="wallet-outline"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <View style={styles.itemRow}>
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
          ]}>Token balance: {tokensBalance ?? 0}</ThemedText>
        </View>
        <TouchableOpacity style={styles.itemRow} onPress={handleBuyTokensPlaceholder}>
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
          ]}>Buy tokens (coming soon)</ThemedText>
        </TouchableOpacity>
      </SettingsDropdown>

      <SettingsDropdown 
        id="accessibility" 
        title="Accessibility"
        icon="eye-outline"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <View style={styles.itemRow}>
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
          ]}>Text size</ThemedText>
          <View style={styles.sliderContainer}>
            <ThemedText style={styles.sliderValue}>{Math.round(textSize * 100)}%</ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={0.8}
              maximumValue={1.2}
              step={0.05}
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
                  colorScheme !== 'dark'
                    ? { color: '#fff' }
                    : { color: theme.text },
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
                  colorScheme === 'dark'
                    ? { color: '#fff' }
                    : { color: theme.text },
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
        icon="notifications-outline"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        {notificationOptions.map((item) => {
          const isMaster = item.key === 'push_enabled';
          const rowDisabled = !isMaster && !notificationPrefs.push_enabled;
          const switchDisabled = savingPreferenceKey != null || rowDisabled;

          return (
            <View key={item.key} style={styles.itemRowWithSwitch}>
              <ThemedText
                style={[
                  styles.itemText,
                  font('GlacialIndifference', '400'),
                  rowDisabled ? { opacity: 0.45 } : null,
                ]}
              >
                {item.label}
              </ThemedText>
              <Switch
                value={notificationPrefs[item.key]}
                onValueChange={(enabled) => handleNotificationToggle(item.key, enabled)}
                disabled={switchDisabled}
              />
            </View>
          );
        })}
      </SettingsDropdown>

      {/* Replay tutorial moved to bottom-left near logout button */}

      <SettingsDropdown
        id="acknowledgements"
        title="Acknowledgements"
        icon="ribbon-outline"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <TouchableOpacity
          style={styles.acknowledgementRow}
          onPress={() => Linking.openURL('https://iconscout.com/')}
        >
          <Ionicons name="logo-ionic" size={18} color={theme.tint} />
          <ThemedText darkColor="#cfd3ff" style={[
            styles.itemText,
            font('GlacialIndifference', '400'),
            { marginLeft: 8, flex: 1 },
          ]}>
            Unicons by IconScout
          </ThemedText>
          <Ionicons name="open-outline" size={16} color={theme.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>
      </SettingsDropdown>

      {/* Replay tutorial & Log out buttons - hide while editing profile inside the Profiles dropdown */}
      {!(isEditingProfile && openSection === 'profiles') && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.replayButton,
              { left: 18, bottom: 24 + insets.bottom + 56 },
              pressed && styles.replayButtonPressed,
            ]}
            onPress={() => setShowOnboarding(true)}
            android_ripple={{ color: '#00000008' }}
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.text} />
            <ThemedText darkColor="#cfd3ff" style={[
              styles.replayButtonText,
              { marginLeft: 8 },
            ]}>Replay tutorial</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              { right: 18, bottom: 24 + insets.bottom + 56 },
              pressed && styles.logoutButtonPressed,
            ]}
            onPress={handleLogout}
            android_ripple={{ color: '#00000008' }}
          >
            <ThemedText style={styles.logoutButtonText}>Log out</ThemedText>
          </Pressable>
        </>
      )}
      </KeyboardAwareScrollView>
      <OnboardingOverlay
        visible={showOnboarding}
        steps={MENTEE_STEPS}
        onComplete={() => setShowOnboarding(false)}
      />
    </View>
  );
}

 

{/* Style sheets */}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    position: 'relative',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
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
  profilePhotoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
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
    paddingHorizontal: 12,
  },
  themeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
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
  borderRadius: 12,
  overflow: 'hidden',
  borderWidth: 0,
  borderColor: 'transparent',
  shadowColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
},
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    width: '100%',
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  headerIcon: {
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 16,
    paddingBottom: 0,
    marginBottom: 0,
  },
  chevron: {
    marginLeft: 12,
  },
animatedContainer: {
  overflow: 'hidden',
},
measureContainer: {
  position: 'absolute',
  opacity: 0,
  zIndex: -1,
},
  itemsContainer: {
    paddingVertical: 4,
  },
  itemRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#00000006',
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
  logoutButton: {
  position: 'absolute',
  right: 18,
  bottom: 24,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 10,
  alignItems: 'center',
  justifyContent: 'center',
},
  logoutButtonPressed: {
    backgroundColor: '#00000006',
    borderRadius: 10,
  },
logoutButtonText: {
  color: '#dc2626',
  fontWeight: '700',
  fontSize: 16,
},
  replayButton: {
    position: 'absolute',
    left: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  replayButtonPressed: {
    backgroundColor: '#00000006',
    borderRadius: 10,
  },
  replayButtonText: {
    color: '#333f5c',
    fontWeight: '600',
    fontSize: 14,
  },
replayTutorialRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  paddingHorizontal: 12,
  marginTop: 8,
  borderTopWidth: 1,
  borderTopColor: '#00000010',
},
acknowledgementRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
},
});


