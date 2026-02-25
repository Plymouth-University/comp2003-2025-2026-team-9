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
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { font } from '../../src/lib/fonts';
import type { Profile } from '../../src/lib/supabase';
import { disconnectPeer, getCurrentUser, supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';

import { ThemedText } from '@/components/themed-text';
import { BackButton } from '@/components/ui/BackButton';
import { useTextSize } from '@/hooks/theme-store';

const DEFAULT_SESSION_MINUTES = 60;

export default function ProfileViewScreen() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === 'string' ? params.userId : null;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const textSize = useTextSize();

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

  // Animated heights for iOS inline pickers
  const datePickerHeight = React.useRef(new Animated.Value(0)).current;
  const timePickerHeight = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Animated.timing(datePickerHeight, {
      toValue: showDatePicker ? 180 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showDatePicker, datePickerHeight]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    Animated.timing(timePickerHeight, {
      toValue: showTimePicker ? 140 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showTimePicker, timePickerHeight]);

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
            'id, full_name, title, industry, bio, photo_url, role, location, skills, interests, work_experience, mentor_session_rate',
          )
          .eq('id', userId)
          .single();
        if (cancelled) return;
        if (profileError) {
          console.error('Failed to load profile', profileError);
          setError(profileError.message ?? 'Failed to load profile');
          return;
        }
        setProfile(data as Profile);

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

      // 2) Create mentor request (drives mentor chat list)
      const { data: req, error: reqError } = await supabase
        .from('mentor_requests')
        .insert({
          mentee: me.id,
          mentor: userId,
          thread_id: thread.id,
          status: 'scheduled',
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          tokens_cost: 0,
        })
        .select('id')
        .single();

      if (reqError || !req) {
        console.error('Failed to create mentor request', reqError);
        setBookingError(reqError?.message ?? 'Failed to create booking');
        setBookingLoading(false);
        return;
      }

      // 3) Add to mentor calendar (prevents overlap via DB constraint)
      const { error: calError } = await supabase.from('calendar').insert({
        mentor_id: userId,
        mentee_id: me.id,
        type: 'session',
        title: 'Session',
        start_at: scheduledStart.toISOString(),
        end_at: scheduledEnd.toISOString(),
      });

      if (calError) {
        console.error('Failed to create calendar event', calError);
        setBookingError(calError.message ?? 'That time is unavailable');
        setBookingLoading(false);
        return;
      }

      setBookingModalVisible(false);
      setBookingDate('');
      setBookingTime('');
      Alert.alert('Booked', 'Your session has been booked.');
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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
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
        <ScrollView contentContainerStyle={[styles.scrollContent, {alignItems: 'stretch'}]} showsVerticalScrollIndicator={false}>
          {/* <ScreenHeader title="Profile" align='left' /> */}

          {/* Top cover image (large) */}
          <View
            style={styles.topImageWrapper}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              // store measured width (only update if changed to avoid extra rerenders)
              if (w && w !== imageWrapperWidth) setImageWrapperWidth(w);
            }}
          >
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.topImage} resizeMode="cover" />
            ) : (
              <View style={styles.topImagePlaceholder}>
                <ThemedText style={[styles.avatarInitial, font('GlacialIndifference', '700')]}>
                  {firstName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            
            {/* Floating back button */}
            <BackButton style={styles.floatingBackButton} />
          </View>

          <View style={styles.subPicContainter}>
          {/* Packed chips: build rows so full/half/quarter combine predictably */}
          {/* chips container sized to fill the padded container width */}
          <View style={{ width: '100%' }}>
            {(() => {
              const rows = buildChipRows(profile);
              return rows.map((row, ri) => {
                // compute row total to decide centering behaviour
                const rowSum = row.reduce((acc, it) => acc + (it.size === 'full' ? 100 : it.size === 'half' ? 50 : 25), 0);
                const justify = rowSum < 100 ? 'center' : 'space-between';

                // small consistent gap when centered
                const centeredGap = 4;

                return (
                  <View
                    key={`row-${ri}`}
                    style={[
                      styles.packedRow,
                      { justifyContent: justify, width: '100%' } // row fills container width
                    ]}
                  >
                    {row.map((chip) => {
                      const sizeStyle = chip.size === 'quarter' ? styles.chipQuarter
                        : chip.size === 'half' ? styles.chipHalf
                        : styles.chipFull;

                      const centeredSpacingStyle = justify === 'center' ? { marginHorizontal: centeredGap / 2 } : {};

                      return (
                        <View
                          key={chip.key}
                          style={[
                            styles.chipBadge,
                            sizeStyle,
                            centeredSpacingStyle,
                            chip.key === 'location' ? styles.chipBadgeLocation : undefined,
                            chip.key === 'industry' ? styles.chipBadgeIndustry : undefined,
                          ]}
                        >

                          {chip.key === 'location' && (
                            <Ionicons name="location" size={14} color="#333333" style={{ marginRight: 4 }} />
                          )}
                          {chip.key === 'industry' && (
                            <Ionicons name="business-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                          )}
                          {chip.key === 'title' && (
                            <Ionicons name="briefcase-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                          )}
                          <ThemedText style={[
                            styles.chipBadgeText, 
                            font('GlacialIndifference', '400'),
                            chip.key === 'location' ? { color: '#333333' } : undefined,
                          
                          
                            
                          ]}>
                            {chip.text}
                          </ThemedText>
                        </View>
                      );
                    })}
                  </View>
                );
              });
            })()}
          </View>

          {/* Name (larger) */}
          <ThemedText
            style={[
              styles.nameLarge,
              font('GlacialIndifference', '800'),
              { color: theme.text, fontSize: 32 * textSize }, // 32px base * scale
            ]}
          >
            {profile.full_name ?? 'Member'}
          </ThemedText>

          {/* About section header */}
          <ThemedText
            style={[
              styles.aboutTitle,
              font('GlacialIndifference', '800'),
              //{ color: theme.text },
            ]}
          >
            About Me
          </ThemedText>

          {/* Bio */}
          {profile.bio ? (
            <ThemedText
              style={[
                styles.sectionBody,
                font('GlacialIndifference', '400'),
              ]}
            >
              {profile.bio}
            </ThemedText>
          ) : null}

          {/* Work Experience */}
          {(profile as any).work_experience ? (
            <View style={styles.section}>
              <ThemedText
                style={[
                  styles.sectionTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                Work Experience
              </ThemedText>
              <ThemedText
                style={[
                  styles.sectionBody,
                  font('GlacialIndifference', '400'),
                ]}
              >
                {(profile as any).work_experience}
              </ThemedText>
            </View>
          ) : null}

          {(Array.isArray((profile as any).skills) && (profile as any).skills.length > 0) && (
            <View style={styles.section}>
              <ThemedText
                style={[
                  styles.sectionTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                Skills / Study
              </ThemedText>
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
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionTitle,
                  font('GlacialIndifference', '800'),
                  { color: theme.text },
                ]}
              >
                Interests / hobbies
              </Text>
              <View style={styles.chipRow}>
                {(profile as any).interests.map((s: string) => (
                  <View key={s} style={styles.chip}>
                    <Text style={styles.chipText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {canShowBooking && (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => {
                setBookingError(null);
                setBookingModalVisible(true);
              }}
            >
              <Text style={styles.bookButtonTitle}>Book session</Text>
              <Text style={styles.bookButtonSubtitle}>Choose a date & time</Text>
            </TouchableOpacity>
          )}

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
                  style={styles.bookingPickerButton}
                >
                  <Text style={styles.bookingPickerText}>{bookingDate || 'Select a date'}</Text>
                </TouchableOpacity>
                {/* iOS: inline spinner below the Date button and above the Time section */}
                {Platform.OS === 'ios' && (
                  <Animated.View
                    style={{
                      overflow: 'hidden',
                      height: datePickerHeight,
                      opacity: datePickerHeight.interpolate({ inputRange: [0, 180], outputRange: [0, 1] }),
                    }}
                  >
                    {showDatePicker && (
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
                  </Animated.View>
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
                  style={styles.bookingPickerButton}
                >
                  <Text style={styles.bookingPickerText}>{bookingTime || 'Select a time'}</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <Animated.View
                    style={{
                      overflow: 'hidden',
                      height: timePickerHeight,
                      opacity: timePickerHeight.interpolate({ inputRange: [0, 140], outputRange: [0, 1] }),
                    }}
                  >
                    {showTimePicker && (
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
                  </Animated.View>
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
          </View>
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  subPicContainter: {
    paddingTop: 12,
    paddingHorizontal: 18,
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
    alignItems: 'center',
    paddingBottom: 120,
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
    // Top large image
  topImageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 0,
    overflow: 'visible',
    marginBottom: 12,
    backgroundColor: '#e9e9e9',
    alignSelf: 'stretch',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    // Android shadow
    elevation: 8,
  },
  floatingBackButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  bookingPickerText: {
    color: '#222',
    fontWeight: '600',
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
