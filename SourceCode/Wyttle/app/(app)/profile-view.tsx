import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { font } from '../../src/lib/fonts';
import type { Profile } from '../../src/lib/supabase';
import { disconnectPeer, getCurrentUser, supabase } from '../../src/lib/supabase';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/BackButton';
import { useTextSize } from '@/hooks/theme-store';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_SESSION_MINUTES = 30;

export default function ProfileViewScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : null;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const textSize = useTextSize();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [viewerProfile, setViewerProfile] = useState<Profile | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canDisconnect, setCanDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // measured width of the top image wrapper — used to size the chips container exactly
  const [imageWrapperWidth, setImageWrapperWidth] = useState<number | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bookingDateObj, setBookingDateObj] = useState<Date | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'date' | 'time' | null>(null);
  const [tempDate, setTempDate] = useState<Date | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingDescription, setBookingDescription] = useState('');

  // Helpers to format date/time strings used elsewhere in the code
  const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const formatDateYYYYMMDD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const formatTimeHHMM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) {
        setError('Missing user id');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select(
            'id, full_name, title, industry, bio, photo_url, role, location, skills, interests, looking_for, work_experience, mentor_session_rate',
          )
          .eq('id', userId)
          .single();
        if (cancelled) return;
        if (profileError) {
          console.error('Failed to load profile', profileError);
          setError(profileError.message ?? 'Failed to load profile');
          return;
        }
        setProfile(data as unknown as Profile);

        // Check if the current user is matched with this user via peer_matches
        try {
          const me = await getCurrentUser();
          const { data: matches, error: matchError } = await supabase
            .from('peer_matches')
            .select('id')
            .or(
              `and(member_a.eq.${me.id},member_b.eq.${userId}),` +
                `and(member_a.eq.${userId},member_b.eq.${me.id})`,
            );
          if (!matchError && matches && matches.length > 0) {
            setCanDisconnect(true);
          }
        } catch (e) {
          console.warn('Failed to check match status', e);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load profile', err);
        setError(err.message ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const loadViewer = async () => {
      try {
        const me = await getCurrentUser();
        if (!cancelled) setViewerId(me.id);

        // Best-effort profile fetch (some DBs may not have token columns yet)
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', me.id)
          .maybeSingle();

        if (!cancelled && data) {
          setViewerProfile(data as Profile);
        }
      } catch (e) {
        console.warn('Failed to load viewer profile', e);
      }
    };
    loadViewer();
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Member';

  // Heuristic to map chip text length -> size class ('quarter'|'half'|'full')
  // Tweak thresholds to taste. minWidth prevents quarters from becoming unusably small.
  const getChipSize = (text?: string): 'quarter' | 'half' | 'full' => {
    const len = (text ?? '').trim().length;
    if (len === 0) return 'quarter';
    if (len <= 5) return 'quarter'; // short text -> quarter (25%)
    if (len <= 19) return 'half';    // medium text -> half (50%)
    return 'full';                   // long text -> full (100%)
  };

  // Build packed rows so full/half/quarter chips fill rows predictably.
  // Full (100) and half (50) will be prioritized; quarters (25) go later.
  const sizeValue = (size: 'quarter' | 'half' | 'full') => (size === 'full' ? 100 : size === 'half' ? 50 : 25);

  const buildChipRows = (p: Profile | null) => {
    if (!p) return [] as Array<Array<{ key: string; text: string; size: 'quarter'|'half'|'full' }>>;

    const raw: Array<{ key: string; text: string; size: 'quarter'|'half'|'full' }> = [];

    if (p.location) raw.push({ key: 'location', text: p.location, size: getChipSize(p.location) });
    if (p.industry) raw.push({ key: 'industry', text: p.industry, size: getChipSize(p.industry) });
    if (p.title) raw.push({ key: 'title', text: p.title, size: getChipSize(p.title) });

    // sort descending so full then half then quarter
    raw.sort((a, b) => sizeValue(b.size) - sizeValue(a.size));

    // pack into rows greedy: fill current row until adding next would exceed 100
    const rows: Array<typeof raw> = [];
    let current: typeof raw = [];
    let currentSum = 0;
    for (const item of raw) {
      const v = sizeValue(item.size);
      if (currentSum + v <= 100) {
        current.push(item);
        currentSum += v;
      } else {
        // commit current row and start a new one with item
        if (current.length) rows.push(current);
        current = [item];
        currentSum = v;
      }
    }
    if (current.length) rows.push(current);
    return rows;
  };

  const handleDisconnect = async () => {
    if (!userId) return;
    try {
      setDisconnecting(true);
      await disconnectPeer(userId);
      setCanDisconnect(false);
      const dest = viewerProfile?.role === 'mentor'
        ? '/(app)/Mentor/connections'
        : '/(app)/Mentee/connections';
      router.replace(dest as any);
    } catch (err) {
      console.error('Failed to disconnect', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleBookSession = async () => {
    if (!profile || !userId) return;

    if (!bookingDate || !bookingTime) {
      setBookingError('Please enter a date and time');
      return;
    }

    try {
      setBookingLoading(true);
      setBookingError(null);

      const me = await getCurrentUser();

      // Assumes bookingDate is YYYY-MM-DD and bookingTime is HH:MM in local time
      const scheduledStart = new Date(`${bookingDate}T${bookingTime}:00`);
      if (isNaN(scheduledStart.getTime())) {
        setBookingError('Invalid date or time');
        setBookingLoading(false);
        return;
      }

      if (scheduledStart.getTime() < Date.now()) {
        setBookingError('Please choose a time in the future');
        setBookingLoading(false);
        return;
      }

      const scheduledEnd = new Date(scheduledStart.getTime() + DEFAULT_SESSION_MINUTES * 60 * 1000);

      // Check for overlapping sessions on the mentor's calendar
      const { data: overlaps, error: overlapErr } = await supabase
        .from('mentor_requests')
        .select('id')
        .eq('mentor', userId)
        .in('status', ['requested', 'scheduled'])
        .lt('scheduled_start', scheduledEnd.toISOString())
        .gt('scheduled_end', scheduledStart.toISOString());

      if (!overlapErr && overlaps && overlaps.length > 0) {
        setBookingError('This mentor already has a session at that time. Please choose a different slot.');
        setBookingLoading(false);
        return;
      }

      // 1) Create a mentorship thread
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .insert({ type: 'mentorship' })
        .select('id')
        .single();

      if (threadError || !thread) {
        console.error('Failed to create thread', threadError);
        setBookingError(threadError?.message ?? 'Failed to create booking thread');
        setBookingLoading(false);
        return;
      }

      // 2) Create mentor request with status 'requested' so mentor can accept/decline
      const rate: number = profile.mentor_session_rate ?? 0;

      const { data: req, error: reqError } = await supabase
        .from('mentor_requests')
        .insert({
          mentee: me.id,
          mentor: userId,
          thread_id: thread.id,
          status: 'requested',
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          tokens_cost: rate,
          description: bookingDescription.trim() || null,
        })
        .select('id')
        .single();

      if (reqError || !req) {
        console.error('Failed to create mentor request', reqError);
        setBookingError(reqError?.message ?? 'Failed to create booking');
        setBookingLoading(false);
        return;
      }

      // Calendar entry + video link are created when the mentor accepts

      setBookingModalVisible(false);
      setBookingDate('');
      setBookingTime('');
      setBookingDescription('');
      Alert.alert('Request Sent', 'Your session request has been sent to the mentor for approval.');
      setBookingLoading(false);
    } catch (e: any) {
      console.error('Failed to book mentor session', e);
      setBookingError(e.message ?? 'Failed to book session');
      setBookingLoading(false);
    }
  };

  const canShowBooking =
    !!profile &&
    profile.role === 'mentor' &&
    !!viewerId &&
    viewerId !== profile.id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['left', 'right', 'bottom']}>
     <View style={[styles.container]}>
      {/*
      <View style={styles.headerRow}>
        <BackButton /> --Removed, just press navbar icon again, is identical.
        
        <Text
          style={[
            styles.headerTitle,
            font('GlacialIndifference', '800'),
            { color: theme.text },
          ]}
        >
          Profile
        </Text>
      </View>*/}

      
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Text style={{ color: 'red' }}>{error}</Text>
        </View>
      ) : !profile ? (
        <View style={styles.centerContent}>
          <Text>No profile found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: insets.bottom }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          contentInset={{ top: 0, left: 0, right: 0, bottom: 0 }}
          scrollIndicatorInsets={{ top: -0, left: 0, right: 0, bottom: 0 }}
        >
          <View style={[styles.heroSection, { marginTop: -insets.top, height: 460 + insets.top }]}> 
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.topImagePlaceholder}>
                <ThemedText style={[styles.avatarInitial, font('GlacialIndifference', '700')]}> 
                  {firstName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}

            {/* Gradient scrim overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.55)']}
              locations={[0.35, 1]}
              style={styles.heroScrim}
              pointerEvents="none"
            />

            <BackButton style={[styles.floatingBackButton, { top: insets.top + 50 }]} />

            <View style={styles.heroContent}>
              <ThemedText
                style={[
                  styles.heroName,
                  font('GlacialIndifference', '800'),
                  { fontSize: 34 * textSize },
                ]}
              >
                {profile.full_name ?? 'Member'}
              </ThemedText>

              {!!profile.location && (
                <View style={styles.heroMetaRow}>
                  <Ionicons name="location-outline" size={15} color="#fff" />
                  <Text style={[styles.heroMetaText, font('GlacialIndifference', '400')]}> 
                    {profile.location}
                  </Text>
                </View>
              )}

              <View style={styles.heroPillsWrap}>
                {!!profile.industry && (
                  <View style={[styles.heroPill, styles.heroPillSolid]}>
                    <Ionicons name="business-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.heroPillText, font('GlacialIndifference', '400')]}>{profile.industry}</Text>
                  </View>
                )}
                {!!profile.title && (
                  <View style={[styles.heroPill, styles.heroPillGlass]}>
                    <Ionicons name="briefcase-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.heroPillText, font('GlacialIndifference', '400')]}>{profile.title}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <LinearGradient
            colors={[ 'transparent', theme.card ]}
            style={styles.dividerGradient}
            pointerEvents="none"
          />

          <View style={[styles.contentPanel, { backgroundColor: theme.card, paddingBottom: 120 + insets.bottom }]}> 
            <View style={[styles.sectionCard, { backgroundColor: theme.background }]}> 
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="person-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}> 
                  About
                </ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.sectionBody,
                  font('GlacialIndifference', '400'),
                  { color: colorScheme === 'dark' ? 'rgba(248,249,255,0.85)' : '#555' },
                ]}
              >
                {profile.bio?.trim() || 'No bio added yet.'}
              </ThemedText>
            </View>

            {profile.role === 'member' && (() => {
              const raw = (profile as any).looking_for;
              let items: string[] = [];
              if (Array.isArray(raw)) {
                items = raw.filter(Boolean);
              } else if (typeof raw === 'string' && raw.trim()) {
                items = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
              }
              if (items.length === 0) return null;
              return (
                <View style={[styles.sectionCard, colorScheme === 'dark' ? undefined : styles.sectionCardShadow, { backgroundColor: theme.background }]}> 
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="search-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                    <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}>
                      I am looking for...
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {items.map((item: string, i: number) => (
                      <ThemedText
                        key={item}
                        style={[
                          styles.sectionBody,
                          font('GlacialIndifference', '400'),
                          { color: colorScheme === 'dark' ? 'rgba(248,249,255,0.85)' : '#555' },
                        ]}
                      >
                        {item}{i < items.length - 1 ? ',' : ''}
                      </ThemedText>
                    ))}
                  </View>
                </View>
              );
            })()}

            {!!(profile as any).work_experience && (
              <View style={[styles.sectionCard, colorScheme === 'dark' ? undefined : styles.sectionCardShadow, { backgroundColor: theme.background }]}> 
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="briefcase-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                  <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}> 
                    Work Experience
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.sectionBody,
                    font('GlacialIndifference', '400'),
                    { color: colorScheme === 'dark' ? 'rgba(248,249,255,0.85)' : '#555' },
                  ]}
                > 
                  {(profile as any).work_experience}
                </ThemedText>
              </View>
            )}

            {(Array.isArray((profile as any).skills) && (profile as any).skills.length > 0) && (
              <View style={[styles.sectionCard, colorScheme === 'dark' ? undefined : styles.sectionCardShadow, { backgroundColor: theme.background }]}> 
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="school-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                  <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}> 
                    Skills / Study
                  </ThemedText>
                </View>
                <View style={styles.chipRow}>
                  {(profile as any).skills.map((s: string) => (
                    <View key={s} style={styles.chip}>
                      <ThemedText style={[styles.chipText, font('GlacialIndifference', '400')]}>{s}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(Array.isArray((profile as any).interests) && (profile as any).interests.length > 0) && (
              <View style={[styles.sectionCard, colorScheme === 'dark' ? undefined : styles.sectionCardShadow, { backgroundColor: theme.background }]}> 
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="heart-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                  <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}> 
                    Interests / Hobbies
                  </ThemedText>
                </View>
                <View style={styles.chipRow}>
                  {(profile as any).interests.map((s: string) => (
                    <View key={s} style={styles.chip}>
                      <Text style={styles.chipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(canShowBooking || canDisconnect) && (
              <View style={[styles.sectionCard, colorScheme === 'dark' ? undefined : styles.sectionCardShadow, { backgroundColor: theme.background }]}> 
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="flash-outline" size={17} color={theme.text} style={styles.sectionHeaderIcon} />
                  <ThemedText style={[styles.sectionCardTitle, font('GlacialIndifference', '700'), { color: theme.text }]}> 
                    Actions
                  </ThemedText>

                  
                </View>

                {canShowBooking && (
                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => {
                      setBookingError(null);
                      setBookingModalVisible(true);
                    }}
                  >
                    {typeof profile.mentor_session_rate === 'number' && profile.mentor_session_rate > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                          source={require('../../assets/icons/diamond_small.png')}
                          style={styles.bookButtonIcon}
                        />
                        <Text style={styles.bookButtonTitle}>{`${profile.mentor_session_rate} tokens/session`}</Text>
                      </View>
                      
                    ) : (
                      <Text style={styles.bookButtonTitle}>Free session</Text>
                    )}
                    <Text style={styles.bookButtonSubtitle}>Choose a date & time</Text>
                  </TouchableOpacity>
                )}

                {canDisconnect && (
                  <TouchableOpacity
                    style={styles.disconnectButton}
                    onPress={handleDisconnect}
                    disabled={disconnecting}
                  >
                    <ThemedText style={styles.disconnectButtonText}>
                      {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </ThemedText>
                  </TouchableOpacity>
                )}

                {canShowBooking && (
                  <Text style={[styles.actionHintText, { color: colorScheme === 'dark' ? '#d8dbe6' : '#4b5563' }]}>
                    Be polite, respectful and detailed with what you want advice with so the mentor can easily determine if it is something they can assist you with or not
                  </Text>
                )}

              </View>
            )}
          </View>

          <Modal
            visible={bookingModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setBookingModalVisible(false)}
          >
            <View style={styles.bookingOverlay}>
              <View style={[styles.bookingCard, { backgroundColor: theme.card }]}> 
                <ThemedText style={[styles.bookingTitle, font('GlacialIndifference', '800'), { color: theme.text }]}>
                  Book a session
                </ThemedText>

                <Text style={[styles.bookingLabel, { color: theme.text }]}>Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    // initialize picker value from current bookingDate if available
                    const initial = bookingDate ? new Date(`${bookingDate}T00:00:00`) : new Date();
                    setBookingDateObj(initial);
                    if (Platform.OS === 'ios') {
                      // inline spinner under the button
                      setShowDatePicker((s) => !s);
                    } else {
                      // Android: open date dialog then time dialog (two-step)
                      setPickerTarget('date');
                      setShowDatePicker(true);
                    }
                  }}
                  style={[styles.bookingPickerButton, { backgroundColor: theme.tint }]}
                >
                  <Text style={styles.bookingPickerText}>{bookingDate || 'Select a date'}</Text>
                </TouchableOpacity>
                {/* iOS: inline spinner below the Date button and above the Time section */}
                {Platform.OS === 'ios' && showDatePicker && (
                  <DateTimePicker
                    value={bookingDateObj ?? new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(_e, date) => {
                      if (date) {
                        setBookingDateObj(date);
                        setBookingDate(formatDateYYYYMMDD(date));
                      }
                    }}
                  />
                )}

                <Text style={[styles.bookingLabel, { color: theme.text, marginTop: 12 }]}>Time</Text>

                <TouchableOpacity
                  onPress={() => {
                    const now = new Date();
                    // if bookingTime exists, parse it into a Date object for initial value
                    let initial = now;
                    if (bookingTime) {
                      const [hh, mm] = bookingTime.split(':').map((s) => parseInt(s, 10));
                      if (!isNaN(hh) && !isNaN(mm)) {
                        initial = new Date();
                        initial.setHours(hh, mm, 0, 0);
                      }
                    }
                    setBookingDateObj(initial);
                    if (Platform.OS === 'ios') {
                      setShowTimePicker((s) => !s);
                    } else {
                      // on Android, prefer date→time flow; allow opening time dialog directly too
                      setPickerTarget('time');
                      setShowTimePicker(true);
                    }
                  }}
                  style={[styles.bookingPickerButton, { backgroundColor: theme.tint }]}
                >
                  <Text style={styles.bookingPickerText}>{bookingTime || 'Select a time'}</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && showTimePicker && (
                  <DateTimePicker
                    value={bookingDateObj ?? new Date()}
                    mode="time"
                    is24Hour={true}
                    display="spinner"
                    onChange={(_e, date) => {
                      if (date) {
                        setBookingDateObj(date);
                        setBookingTime(formatTimeHHMM(date));
                      }
                    }}
                  />
                )}

                {Platform.OS === 'android' && showDatePicker && pickerTarget === 'date' && (
                  <DateTimePicker
                    value={bookingDateObj ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={(_e, date) => {
                      setShowDatePicker(false);
                      if (!date) return;
                      const merged = new Date(date);
                      // preserve time portion from bookingDateObj if present
                      const base = bookingDateObj ?? new Date();
                      merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
                      setTempDate(merged);
                      setShowTimePicker(true);
                    }}
                  />
                )}

                {Platform.OS === 'android' && showTimePicker && pickerTarget === 'date' && (
                  <DateTimePicker
                    value={tempDate ?? bookingDateObj ?? new Date()}
                    mode="time"
                    display="default"
                    onChange={(_e, date) => {
                      setShowTimePicker(false);
                      if (!date) return;
                      const merged = new Date(tempDate ?? date);
                      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      setBookingDateObj(merged);
                      setBookingDate(formatDateYYYYMMDD(merged));
                      setBookingTime(formatTimeHHMM(merged));
                      setTempDate(null);
                      setPickerTarget(null);
                    }}
                  />
                )}

                {Platform.OS === 'android' && showTimePicker && pickerTarget === 'time' && (
                  <DateTimePicker
                    value={bookingDateObj ?? new Date()}
                    mode="time"
                    display="default"
                    onChange={(_e, date) => {
                      setShowTimePicker(false);
                      if (!date) return;
                      const picked = date;
                      const base = bookingDateObj ?? new Date();
                      const merged = new Date(base);
                      merged.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                      setBookingDateObj(merged);
                      setBookingTime(formatTimeHHMM(merged));
                    }}
                  />
                )}

                <Text style={[styles.bookingLabel, { color: theme.text, marginTop: 12 }]}>Message (optional)</Text>
                <TextInput
                  style={[styles.bookingDescriptionInput, { color: theme.text, borderColor: theme.tint }]}
                  placeholder="What do you need help with?"
                  placeholderTextColor="#999"
                  value={bookingDescription}
                  onChangeText={setBookingDescription}
                  multiline
                  numberOfLines={3}
                />

                {bookingError ? (
                  <Text style={styles.bookingErrorText}>{bookingError}</Text>
                ) : null}

                <View style={styles.bookingButtonsRow}>
                  <TouchableOpacity
                    style={[styles.bookingButton, styles.bookingButtonSecondary]}
                    onPress={() => {
                      setBookingModalVisible(false);
                      setBookingError(null);
                    }}
                    disabled={bookingLoading}
                  >
                    <Text style={styles.bookingButtonSecondaryText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bookingButton, styles.bookingButtonPrimary, { opacity: bookingLoading ? 0.7 : 1 }]}
                    onPress={handleBookSession}
                    disabled={bookingLoading}
                  >
                    <Text style={styles.bookingButtonPrimaryText}>
                      {bookingLoading ? 'Booking…' : 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </ScrollView>
      )}
    </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    marginLeft: 12,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'stretch',
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroSection: {
    width: '100%',
    height: 460,
    position: 'relative',
    backgroundColor: '#10131b',
    overflow: 'visible',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },

  heroContent: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 54,
  },
  heroName: {
    color: '#fff',
    lineHeight: 38,
    marginBottom: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroMetaText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 14,
  },
  heroPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroPillSolid: {
    backgroundColor: '#333f5c',
  },
  heroPillGlass: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroPillText: {
    color: '#fff',
    fontSize: 13,
  },
  bookButtonIcon: {
    width: 14,
    height: 14,
    marginRight: 8,
  },
  contentPanel: {
    width: '100%',
    marginTop: -32,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 120,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  dividerGradient: {
    height: 36,
    width: '100%',
    marginTop: -32,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
  },
  sectionCard: {
    width: '100%',
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    // Border/shadow removed from base style so it can be toggled per-theme
  },
  sectionCardShadow: {
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.4)',
    borderLeftColor: 'rgba(255,255,255,0.25)',
    borderRightColor: 'rgba(0,0,0,0.08)',
    borderBottomColor: 'rgba(0,0,0,0.16)',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  sectionCardTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionHeaderIcon: {
    marginRight: 7,
    marginBottom: 4,
  },
  chipBadgeLocation: {
    backgroundColor: '#edecf1', // Slightly different blue/grey color to distinguish it
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipBadgeIndustry: {
    backgroundColor: '#968c6c', // Slightly different blue/grey color to distinguish it
    flexDirection: 'row',
    alignItems: 'center',
  },
  topImage: {
    width: '100%',
    height: '100%',
    //resizeMode: 'cover', - deprecated, now set via prop
    
  },
  topImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cfcfcf',
  },

  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },

  // ####################################### chips row under the top image
  // rows of packed chips
  packedRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  // base pill style
  chipBadge: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#333f5c',
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    // Android shadow
    elevation: 4,
  },

  // explicit percent widths for reliable wrapping/alignment
  chipQuarter: {
    width: '24%',
    minWidth: 72,
    wordWrap: 'contain',
  },
  chipHalf: {
    width: '49%', // slightly less than 50 to leave space for spacing
    minWidth: 120,
  },
  chipFull: {
    width: '100%',
  },

  // title-large helper if needed
  chipBadgeTitleFull: {
    minWidth: 160,
    paddingHorizontal: 20,
  },

  chipBadgeText: {
    fontSize: 13,
    color: '#ffffff',
    textAlign: 'center',
  },





  // bio text — force left alignment and ensure it stretches to the content width
  sectionBody: {
    fontSize: 14,
    color: '#555',
    textAlign: 'left',
    marginTop: 0,
    alignSelf: 'stretch',
    width: '100%',
    lineHeight: 20,
  },
  

  // larger name and about heading
  nameLarge: {
    marginTop: 18,
    marginBottom: 6,
    textAlign: 'left',
    width: '100%',
    fontWeight: '800',
    lineHeight: 36,
  },
  aboutTitle: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 0,
    alignSelf: 'flex-start',
    width: '100%',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#777',
    marginBottom: 2,
  },
  section: {
    width: '100%',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 2,
  },
  bookButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#333f5c',
  },
  bookButtonTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bookButtonSubtitle: {
    color: '#e0dfd5',
    fontSize: 12,
    marginTop: 2,
  },
  actionHintText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  disconnectButton: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#c43b3b',
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bookingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingCard: {
    width: '88%',
    borderRadius: 18,
    padding: 16,
  },
  bookingTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  bookingLabel: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  bookingInput: {
    borderWidth: 1,
    borderColor: '#c6c1ae',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  bookingErrorText: {
    marginTop: 6,
    color: '#c43b3b',
    fontSize: 12,
  },
  bookingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    columnGap: 8,
  },
  bookingButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  bookingButtonSecondary: {
    borderWidth: 1,
    borderColor: '#968c6c',
    backgroundColor: 'transparent',
  },
  bookingButtonSecondaryText: {
    color: '#968c6c',
    fontSize: 14,
  },
  bookingButtonPrimary: {
    backgroundColor: '#333f5c',
  },
  bookingButtonPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bookingPickerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  bookingPickerText: {
    color: '#fff',
    fontWeight: '600',
  },
  bookingDescriptionInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f0eee5',
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 12,
    color: '#555',
  },
});
