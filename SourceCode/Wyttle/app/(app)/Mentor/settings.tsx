import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
import { SvgXml } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { setTextSize, setThemeOverride, useTextSize } from '@/hooks/theme-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { TextInput } from 'react-native';
import OnboardingOverlay from '../../../src/components/OnboardingOverlay';
import { getAppVersion, getAppVersionLabel } from '../../../src/lib/app-version';
import { font } from '../../../src/lib/fonts';
import {
  disableTotpFactor,
  enrollTotp,
  getTotpQrImageUrl,
  getTotpQrSvg,
  listTotpFactors,
  type TotpEnrollment,
  verifyTotpEnrollment,
} from '../../../src/lib/mfa';
import { useNavigationHistory } from '../../../src/lib/navigation-history';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferences,
  type NotificationPreferences,
  registerPushToken,
  unregisterPushToken,
  updateNotificationPreferences,
} from '../../../src/lib/notifications';
import { MENTOR_STEPS } from '../../../src/lib/onboarding';
import {
  type BlockedUserProfile,
  deleteMyAccount,
  fetchMyBlockedUsers,
  submitBugReport,
  supabase,
  unblockUser,
  uploadProfilePhoto,
} from '../../../src/lib/supabase';
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
  const passwordIconColor = colorScheme === 'dark' ? '#cfd3ff' : '#333f5c';
  const { resetHistory } = useNavigationHistory();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  //const [tokensBalance, setTokensBalance] = useState<number | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAcknowledgementsModal, setShowAcknowledgementsModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [bugReportTitle, setBugReportTitle] = useState('');
  const [bugReportDescription, setBugReportDescription] = useState('');
  const [isSubmittingBugReport, setIsSubmittingBugReport] = useState(false);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isDeleteAccountSectionOpen, setIsDeleteAccountSectionOpen] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserProfile[]>([]);
  const [blockedUsersLoading, setBlockedUsersLoading] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [isTwoFactorSectionOpen, setIsTwoFactorSectionOpen] = useState(false);
  const [isTwoFactorBusy, setIsTwoFactorBusy] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [activeTotpFactorId, setActiveTotpFactorId] = useState<string | null>(null);
  const [pendingTotpEnrollment, setPendingTotpEnrollment] = useState<TotpEnrollment | null>(null);
  const totpQrSvg = getTotpQrSvg(pendingTotpEnrollment?.qrCode);
  const totpQrImageUrl = !totpQrSvg ? getTotpQrImageUrl(pendingTotpEnrollment?.uri) : null;

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
      //setTokensBalance(profile?.tokens_balance ?? null);
      setNotificationPrefs(prefs);
    })();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setBlockedUsersLoading(true);
      const users = await fetchMyBlockedUsers();
      setBlockedUsers(users);
    } catch (error) {
      console.error('Failed to load blocked users', error);
    } finally {
      setBlockedUsersLoading(false);
    }
  };

  useEffect(() => {
    void loadBlockedUsers();
  }, []);

  const handleUnblockUser = async (user: BlockedUserProfile) => {
    Alert.alert(
      'Unblock user',
      `Unblock ${user.full_name ?? 'this user'}? They may appear again across discovery, chats, and booking flows.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              setUnblockingUserId(user.id);
              await unblockUser(user.id);
              await loadBlockedUsers();
            } catch (error) {
              console.error('Failed to unblock user', error);
              Alert.alert('Error', 'Could not unblock this user right now.');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ],
    );
  };

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
        // mentors: ignore the "looking_for" field in this settings screen
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
  // Handle the user logging out of their account.
  const handleLogout = async () => {
      await unregisterPushToken();
      await supabase.auth.signOut();
      resetHistory('/');
      router.replace({ pathname: '/', params: { from: 'logout' } });
    };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account and related profile data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyAccount();
              await unregisterPushToken();
              await supabase.auth.signOut().catch(() => {});
              resetHistory('/');
              router.replace({ pathname: '/', params: { from: 'logout' } });
            } catch (error: any) {
              Alert.alert(
                'Delete account failed',
                error?.message ?? 'Unable to delete your account right now.',
              );
            }
          },
        },
      ],
    );
  };

  const refreshTwoFactorState = async () => {
    const factors = await listTotpFactors();
    const active = factors.find((f) => String(f.status ?? '').toLowerCase() === 'verified') ?? null;
    setActiveTotpFactorId(active?.id ?? null);
  };

  const handleStartTwoFactorSetup = async () => {
    try {
      setIsTwoFactorBusy(true);
      const enrollment = await enrollTotp();
      setPendingTotpEnrollment(enrollment);
      setTwoFactorCode('');
    } catch (error: any) {
      Alert.alert('2FA setup failed', error?.message ?? 'Unable to start 2FA setup right now.');
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    if (!pendingTotpEnrollment) return;
    const code = twoFactorCode.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }

    try {
      setIsTwoFactorBusy(true);
      await verifyTotpEnrollment(pendingTotpEnrollment.factorId, code);
      await refreshTwoFactorState();
      setPendingTotpEnrollment(null);
      setTwoFactorCode('');
      Alert.alert('2FA enabled', 'Two-factor authentication is now active on your account.');
    } catch (error: any) {
      Alert.alert('Verification failed', error?.message ?? 'Unable to verify that code.');
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleDisableTwoFactor = async () => {
    if (!activeTotpFactorId) return;
    try {
      setIsTwoFactorBusy(true);
      await disableTotpFactor(activeTotpFactorId);
      await refreshTwoFactorState();
      setPendingTotpEnrollment(null);
      setTwoFactorCode('');
      Alert.alert('2FA disabled', 'Two-factor authentication has been removed.');
    } catch (error: any) {
      Alert.alert('Disable failed', error?.message ?? 'Unable to disable 2FA right now.');
    } finally {
      setIsTwoFactorBusy(false);
    }
  };

  const handleCopyTwoFactorSecret = async () => {
    const secret = pendingTotpEnrollment?.secret ?? pendingTotpEnrollment?.uri;
    if (!secret) return;

    try {
      await Clipboard.setStringAsync(secret);
      Alert.alert('Copied', 'The 2FA setup key has been copied to your clipboard.');
    } catch {
      Alert.alert(
        'Clipboard unavailable',
        'Clipboard support is not available in this build yet. Rebuild the app to enable copy, or enter the key manually for now.',
      );
    }
  };

  const handleSubmitBugReport = async () => {
    const trimmedDescription = bugReportDescription.trim();

    if (!trimmedDescription) {
      Alert.alert('Missing details', 'Please describe the bug before submitting.');
      return;
    }

    try {
      setIsSubmittingBugReport(true);

      await submitBugReport({
        title: bugReportTitle,
        description: trimmedDescription,
        sourceScreen: 'Mentor settings acknowledgements',
        platform: Platform.OS,
        appVersion: getAppVersion(),
        context: {
          entry_point: 'acknowledgements_modal',
        },
      });

      setBugReportTitle('');
      setBugReportDescription('');
      setShowBugReportModal(false);
      Alert.alert('Thanks', 'Bug report submitted.');
    } catch (error: any) {
      Alert.alert('Submit failed', error?.message ?? 'Could not submit bug report right now.');
    } finally {
      setIsSubmittingBugReport(false);
    }
  };

  const handleChangePassword = async () => {
    const trimmedCurrentPassword = currentPassword.trim();
    const trimmedPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmNewPassword.trim();

    if (!trimmedCurrentPassword || !trimmedPassword || !trimmedConfirmPassword) {
      Alert.alert('Missing password', 'Enter your current password and confirm your new password.');
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert('Password too short', 'Your new password must be at least 6 characters long.');
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      Alert.alert('Passwords do not match', 'Make sure both password fields match.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new Error('Unable to verify your current password for this account.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: trimmedCurrentPassword,
      });

      if (signInError) {
        throw new Error('Your current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({ password: trimmedPassword });

      if (error) {
        throw error;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setIsPasswordSectionOpen(false);
      Alert.alert('Password updated', 'Your password has been changed successfully.');
    } catch (error: any) {
      Alert.alert('Password update failed', error?.message ?? 'Unable to update your password right now.');
    } finally {
      setIsUpdatingPassword(false);
    }
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

  useEffect(() => {
    if (!isTwoFactorSectionOpen) return;
    void refreshTwoFactorState().catch((error) => {
      console.warn('Failed to load MFA factors', error);
    });
  }, [isTwoFactorSectionOpen]);

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
                pathname: '/(app)/Mentor/profile-view' as any,
                params: { userId: user.id, navOrigin: 'settings' },
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

              {/* 'I am looking for' removed for mentors */}

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>Save profile</Text>
              </TouchableOpacity>
            </View>
            
          )}
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
        id="account-management"
        title="Account Management"
        icon="shield-outline"
        openSection={openSection}
        toggleSection={toggleSection}
        theme={theme}
      >
        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => setIsPasswordSectionOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isPasswordSectionOpen }}
        >
          <ThemedText
            darkColor="#cfd3ff"
            style={[
              styles.itemText,
              font('GlacialIndifference', '400'),
              { flex: 1 },
            ]}
          >
            Change password
          </ThemedText>
          <Ionicons
            name={isPasswordSectionOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.text}
            style={{ opacity: 0.4 }}
          />
        </TouchableOpacity>

        {isPasswordSectionOpen && (
          <View style={styles.accountSubsection}>
            <View style={styles.accountFieldGroup}>
              <Text style={[styles.themeLabel, styles.accountFieldLabel, { color: theme.text }]}>Current password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.textInput, styles.passwordInput, { color: theme.text }]}
                  placeholder="Enter current password"
                  placeholderTextColor="#7f8186"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowCurrentPassword((prev) => !prev)}
                >
                  <IconSymbol
                    name={showCurrentPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={passwordIconColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.accountFieldGroup}>
              <Text style={[styles.themeLabel, styles.accountFieldLabel, { color: theme.text }]}>New password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.textInput, styles.passwordInput, { color: theme.text }]}
                  placeholder="Enter new password"
                  placeholderTextColor="#7f8186"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword((prev) => !prev)}
                >
                  <IconSymbol
                    name={showNewPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={passwordIconColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.accountFieldGroup}>
              <Text style={[styles.themeLabel, styles.accountFieldLabel, { color: theme.text }]}>Confirm new password</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={[styles.textInput, styles.passwordInput, { color: theme.text }]}
                  placeholder="Confirm new password"
                  placeholderTextColor="#7f8186"
                  value={confirmNewPassword}
                  onChangeText={setConfirmNewPassword}
                  secureTextEntry={!showConfirmNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowConfirmNewPassword((prev) => !prev)}
                >
                  <IconSymbol
                    name={showConfirmNewPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={passwordIconColor}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                styles.passwordSaveButton,
                isUpdatingPassword && { opacity: 0.6 },
              ]}
              onPress={handleChangePassword}
              disabled={isUpdatingPassword}
            >
              <Text style={styles.saveButtonText}>
                {isUpdatingPassword ? 'Updating...' : 'Update password'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => setIsTwoFactorSectionOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isTwoFactorSectionOpen }}
        >
          <ThemedText
            darkColor="#cfd3ff"
            style={[
              styles.itemText,
              font('GlacialIndifference', '400'),
              { flex: 1 },
            ]}
          >
            Two-factor authentication
          </ThemedText>
          <Ionicons
            name={isTwoFactorSectionOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={theme.text}
            style={{ opacity: 0.4 }}
          />
        </TouchableOpacity>
        {isTwoFactorSectionOpen && (
          <View style={styles.accountSubsection}>
            <ThemedText style={styles.twoFactorStatusText}>
              <Text style={{ color: theme.text }}>2FA status: </Text>
              <Text style={{ color: activeTotpFactorId ? theme.text : '#dc2626' }}>
                {activeTotpFactorId ? 'enabled' : 'not enabled'}
              </Text>
            </ThemedText>
            {!activeTotpFactorId && !pendingTotpEnrollment && (
              <TouchableOpacity
                style={[styles.saveButton, styles.passwordSaveButton, isTwoFactorBusy && { opacity: 0.6 }]}
                onPress={handleStartTwoFactorSetup}
                disabled={isTwoFactorBusy}
              >
                <Text style={styles.saveButtonText}>
                  {isTwoFactorBusy ? 'Starting...' : 'Start 2FA setup'}
                </Text>
              </TouchableOpacity>
            )}
            {pendingTotpEnrollment && !activeTotpFactorId && (
              <View style={styles.accountFieldGroup}>
                <ThemedText style={[styles.twoFactorHelperText, { color: theme.text }]}>
                  Scan this QR code with your authenticator app, or use the secret manually, then
                  enter the 6-digit code.
                </ThemedText>
                {totpQrSvg && (
                  <View style={styles.twoFactorQrWrapper}>
                    <SvgXml xml={totpQrSvg} width={168} height={168} />
                  </View>
                )}
                {!totpQrSvg && totpQrImageUrl && (
                  <View style={styles.twoFactorQrWrapper}>
                    <Image source={{ uri: totpQrImageUrl }} style={styles.twoFactorQrImage} />
                  </View>
                )}
                <View style={styles.twoFactorSecretRow}>
                  <Text selectable style={[styles.twoFactorSecretText, { color: theme.text }]}>
                    {pendingTotpEnrollment.secret ?? pendingTotpEnrollment.uri ?? 'Secret unavailable'}
                  </Text>
                  <TouchableOpacity
                    style={styles.twoFactorCopyButton}
                    onPress={handleCopyTwoFactorSecret}
                    accessibilityRole="button"
                    accessibilityLabel="Copy 2FA setup key"
                  >
                    <Ionicons name="copy-outline" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput, styles.twoFactorCodeInput, { color: theme.text }]}
                  placeholder="123456"
                  placeholderTextColor="#7f8186"
                  keyboardType="number-pad"
                  value={twoFactorCode}
                  onChangeText={setTwoFactorCode}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.saveButton, styles.passwordSaveButton, isTwoFactorBusy && { opacity: 0.6 }]}
                  onPress={handleVerifyTwoFactor}
                  disabled={isTwoFactorBusy}
                >
                  <Text style={styles.saveButtonText}>
                    {isTwoFactorBusy ? 'Verifying...' : 'Verify and enable 2FA'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {activeTotpFactorId && (
              <TouchableOpacity
                style={[styles.deleteAccountButton, isTwoFactorBusy && { opacity: 0.6 }]}
                onPress={handleDisableTwoFactor}
                disabled={isTwoFactorBusy}
              >
                <Ionicons name="shield-outline" size={18} color="#fff" />
                <Text style={styles.deleteAccountButtonText}>
                  {isTwoFactorBusy ? 'Disabling...' : 'Disable 2FA'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.itemRow}
          onPress={() => setShowBlockedUsersModal(true)}
        >
          <ThemedText
            darkColor="#cfd3ff"
            style={[
              styles.itemText,
              font('GlacialIndifference', '400'),
              { flex: 1 },
            ]}
          >
            Blocked users
          </ThemedText>
          <Ionicons name="chevron-forward" size={18} color={theme.text} style={{ opacity: 0.4 }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.itemRow}
          onPress={handleLogout}
        >
          <ThemedText
            darkColor="#f3b4b4"
            style={[
              styles.itemText,
              styles.dangerItemText,
              font('GlacialIndifference', '400'),
              { flex: 1 },
            ]}
          >
            Log out
          </ThemedText>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.itemRow, styles.dangerItemRow]}
          onPress={() => setIsDeleteAccountSectionOpen((prev) => !prev)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isDeleteAccountSectionOpen }}
        >
          <ThemedText
            darkColor="#f3b4b4"
            style={[
              styles.itemText,
              styles.dangerItemText,
              font('GlacialIndifference', '400'),
              { flex: 1 },
            ]}
          >
            Delete account
          </ThemedText>
          <Ionicons
            name={isDeleteAccountSectionOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#dc2626"
          />
        </TouchableOpacity>

        {isDeleteAccountSectionOpen && (
          <View style={styles.deleteAccountSubsection}>
            

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.deleteAccountButtonText}>Continue to delete account</Text>
            </TouchableOpacity>
          </View>
        )}

      </SettingsDropdown>

      {/* Replay tutorial button - hide while editing profile inside the Profiles dropdown */}
      {!(isEditingProfile && openSection === 'profiles') && (
        <View
          style={[
            styles.footerReplay,
            { paddingBottom: 24 + insets.bottom + 56 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.replayButton,
              pressed && styles.replayButtonPressed,
            ]}
            onPress={() => setShowOnboarding(true)}
            android_ripple={{ color: '#00000008' }}
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.text} />
            <ThemedText darkColor="#cfd3ff" style={[
              styles.replayButtonText,
              { marginLeft: 8 },
            ]}>Replay Introduction</ThemedText>
          </Pressable>


          <Pressable
            style={({ pressed }) => [
              styles.replayButton,
              pressed && styles.replayButtonPressed,
            ]}
            onPress={() => setShowAcknowledgementsModal(true)}
            android_ripple={{ color: '#00000008' }}
          >
            <Ionicons name="ribbon-outline" size={18} color={theme.text} />
            <ThemedText darkColor="#cfd3ff" style={[
              styles.replayButtonText,
              { marginLeft: 8 },
            ]}>Acknowledgements</ThemedText>
          </Pressable>
          
          <Pressable
            style={({ pressed }) => [
              styles.replayButton,
              pressed && styles.replayButtonPressed,
            ]}
            onPress={() => setShowBugReportModal(true)}
            android_ripple={{ color: '#00000008' }}
          >
            <Ionicons name="bug-outline" size={18} color="#c43b3b" />
            <ThemedText darkColor="#f3b4b4" style={[
              styles.replayButtonText,
              { marginLeft: 8 },
            ]}>Notice any bugs?</ThemedText>
          </Pressable>



          <Text style={[styles.versionText, { color: theme.placeholder }]}>{getAppVersionLabel()}</Text>
        </View>
      )}
      </KeyboardAwareScrollView>
      <Modal
        visible={showBlockedUsersModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlockedUsersModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBlockedUsersModal(false)}>
          <Pressable
            style={[styles.modalCard, styles.blockedUsersModalCard, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText
              style={[styles.modalTitle, { color: theme.text }, font('GlacialIndifference', '400')]}
            >
              Blocked users
            </ThemedText>

            <ScrollView
              style={styles.blockedUsersModalList}
              contentContainerStyle={styles.blockedUsersModalContent}
              showsVerticalScrollIndicator={false}
            >
              {blockedUsersLoading ? (
                <Text style={[styles.blockedUsersHint, { color: theme.text }]}>Loading blocked users...</Text>
              ) : blockedUsers.length === 0 ? (
                <Text style={[styles.blockedUsersHint, { color: theme.text }]}>You have not blocked anyone.</Text>
              ) : (
                blockedUsers.map((user) => (
                  <View key={user.id} style={styles.blockedUserRow}>
                    <View style={styles.blockedUserInfo}>
                      <View style={styles.blockedAvatar}>
                        {user.photo_url ? (
                          <Image source={{ uri: user.photo_url }} style={styles.blockedAvatarImage} />
                        ) : (
                          <Text style={styles.blockedAvatarText}>
                            {(user.full_name ?? 'U').charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.blockedUserName, { color: theme.text }]}>
                        {user.full_name ?? 'Unknown user'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.unblockButton,
                        unblockingUserId === user.id ? { opacity: 0.6 } : null,
                      ]}
                      onPress={() => handleUnblockUser(user)}
                      disabled={unblockingUserId === user.id}
                    >
                      <Text style={styles.unblockButtonText}>
                        {unblockingUserId === user.id ? 'Unblocking...' : 'Unblock'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: '#333f5c' }]}
              onPress={() => setShowBlockedUsersModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={showAcknowledgementsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAcknowledgementsModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAcknowledgementsModal(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText
              style={[styles.modalTitle, { color: theme.text }, font('GlacialIndifference', '400')]}
            >
              Acknowledgements
            </ThemedText>
            <TouchableOpacity
              style={styles.acknowledgementRow}
              onPress={() => Linking.openURL('https://iconscout.com/')}
            >
              <Ionicons name="logo-ionic" size={18} color={theme.tint} />
              <ThemedText
                darkColor="#cfd3ff"
                style={[styles.itemText, font('GlacialIndifference', '400'), { marginLeft: 8, flex: 1 }]}
              >
                Unicons by IconScout
              </ThemedText>
              <Ionicons name="open-outline" size={16} color={theme.text} style={{ opacity: 0.4 }} />
            </TouchableOpacity>
            <View style={styles.acknowledgementRow}>
              <Ionicons name="musical-notes-outline" size={18} color={theme.tint} />
              <ThemedText
                darkColor="#cfd3ff"
                style={[styles.itemText, font('GlacialIndifference', '400'), { marginLeft: 8, flex: 1 }]}
              >
                Sound Effect by ...
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: '#333f5c' }]}
              onPress={() => setShowAcknowledgementsModal(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showBugReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBugReportModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBugReportModal(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.background }]}
            onPress={(event) => event.stopPropagation()}
          >
            <ThemedText
              style={[styles.modalTitle, { color: theme.text }, font('GlacialIndifference', '400')]}
            >
              Report a Bug
            </ThemedText>

            <TextInput
              value={bugReportTitle}
              onChangeText={setBugReportTitle}
              placeholder="Short title (optional)"
              placeholderTextColor={theme.placeholder}
              style={[
                styles.bugReportInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              maxLength={120}
            />

            <TextInput
              value={bugReportDescription}
              onChangeText={setBugReportDescription}
              placeholder="What happened? What did you expect?"
              placeholderTextColor={theme.placeholder}
              style={[
                styles.bugReportTextArea,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              multiline
              textAlignVertical="top"
              maxLength={1200}
            />

            <Text style={[styles.bugReportHint, { color: theme.placeholder }]}>
              Basic report only. No follow-up inbox inside the app yet.
            </Text>

            <View style={styles.bugReportActions}>
              <TouchableOpacity
                style={styles.bugReportCancelButton}
                onPress={() => setShowBugReportModal(false)}
                disabled={isSubmittingBugReport}
              >
                <Text style={[styles.bugReportCancelButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.bugReportSubmitButton,
                  isSubmittingBugReport ? { opacity: 0.6 } : null,
                ]}
                onPress={handleSubmitBugReport}
                disabled={isSubmittingBugReport}
              >
                <Text style={styles.bugReportSubmitButtonText}>
                  {isSubmittingBugReport ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>






      <OnboardingOverlay
        visible={showOnboarding}
        steps={MENTOR_STEPS}
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
  footerActions: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerReplay: {
    marginTop: 20,
    alignItems: 'flex-start',
    gap: 12,
  },
  versionText: {
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
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
  dangerItemText: {
    color: '#dc2626',
  },
  logoutButton: {
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
    color: '#5b6480',
    fontWeight: '600',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 22,
    textAlign: 'center',
  },
  modalCloseButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
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
  accountSubsection: {
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: 12,
    gap: 12,
  },
  accountFieldGroup: {
    gap: 6,
  },
  twoFactorStatusText: {
    fontSize: 13,
    lineHeight: 18,
  },
  twoFactorHelperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  twoFactorSecretText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    paddingVertical: 8,
  },
  twoFactorSecretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  twoFactorCopyButton: {
    padding: 6,
  },
  twoFactorQrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  twoFactorQrImage: {
    width: 168,
    height: 168,
  },
  twoFactorCodeInput: {
    letterSpacing: 6,
    textAlign: 'center',
  },
  accountFieldLabel: {
    marginBottom: 0,
  },
  blockedUsersHint: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
  blockedUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  blockedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  blockedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blockedAvatarImage: {
    width: '100%',
    height: '100%',
  },
  blockedAvatarText: {
    color: '#fff',
    fontWeight: '700',
  },
  blockedUserName: {
    fontSize: 15,
    flexShrink: 1,
  },
  unblockButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#333f5c',
  },
  unblockButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  blockedUsersModalCard: {
    maxHeight: '70%',
  },
  blockedUsersModalList: {
    maxHeight: 360,
  },
  blockedUsersModalContent: {
    gap: 12,
  },
  dangerItemRow: {
    paddingVertical: 14,
  },
  deleteAccountSubsection: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 12,
  },
  deleteAccountHelperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  deleteAccountButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteAccountButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  passwordField: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 72,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  passwordSaveButton: {
    alignSelf: 'stretch',
  },
  acknowledgementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  bugReportInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  bugReportTextArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 120,
  },
  bugReportHint: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -6,
  },
  bugReportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  bugReportCancelButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#0000001a',
  },
  bugReportCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bugReportSubmitButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#333f5c',
  },
  bugReportSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
