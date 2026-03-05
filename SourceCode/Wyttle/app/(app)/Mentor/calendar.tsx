import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, UIManager, View, type TouchableOpacityProps } from 'react-native';
import { Calendar as BigCalendar, ICalendarEventBase } from 'react-native-big-calendar';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/lib/supabase';
import { commonStyles } from '@/src/styles/common';
import { router } from 'expo-router';
import { Image } from 'react-native';

type CalendarRow = {
  id: string;
  mentor_id: string;
  mentee_id: string | null;
  type: 'block' | 'session';
  title: string | null;
  start_at: string;
  end_at: string;
};

type CalendarEvent = ICalendarEventBase & {
  id: string;
  type: 'block' | 'session';
  mentor_id: string;
  mentee_id: string | null;
};

//const CALENDAR_HEIGHT = 520;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const pickerAnim = LayoutAnimation.create(
  250,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

export default function MentorCalendarScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const borderColor = isDark ? '#1e2636' : '#e2e4ea';
  const todayHighlightColor = theme.tint;
  const calendarBg = isDark ? '#0d1117' : '#f8f9fc';
  const checkerA = isDark ? '#131a26' : '#f0f2f8';
  const checkerB = isDark ? '#0d1117' : '#f8f9fc';

  const calendarTheme = {
    palette: {
      primary: { main: theme.tint, contrastText: '#fff' },
      nowIndicator: '#ef4444',
      gray: {
        '100': isDark ? '#0d1117' : '#f8f9fc',
        '200': isDark ? '#1e2636' : '#c8ccd4',
        '300': isDark ? '#2a3346' : '#dfe1e6',
        '500': isDark ? '#1e2636' : '#e2e4ea',
        '800': isDark ? '#94a3b8' : '#64748b',
      },
      moreLabel: isDark ? '#94a3b8' : '#64748b',
    },
  } as any;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarHeight, setCalendarHeight] = useState(0);

  type ViewMode = 'day' | '3days' | 'week';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const stepDays: Record<ViewMode, number> = { day: 1, '3days': 3, week: 7 };
  const modeLabels: { key: ViewMode; label: string }[] = [
    { key: 'day', label: 'Day' },
    { key: '3days', label: '3 Day' },
    { key: 'week', label: 'Week' },
  ];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Session detail modal state
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<{
    menteeName: string;
    menteePhoto: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    description: string | null;
    threadId: number | null;
    menteeId: string | null;
    videoLink: string | null;
  } | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);

  const [title, setTitle] = useState('Blocked');
  const [startAt, setStartAt] = useState<Date>(() => new Date());
  const [endAt, setEndAt] = useState<Date>(() => new Date(Date.now() + 60 * 60 * 1000));


  const [visibleStart, setVisibleStart] = useState(new Date());
  const formatMonth = (d: Date) =>
    d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const addDays = (d: Date, days: number) =>
    new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Android-only: two-step date→time flow
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // Month/year picker state (kept in component scope)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => visibleStart.getFullYear());
  const [monthPickerMonth, setMonthPickerMonth] = useState(() => visibleStart.getMonth());
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const minYear = 2020;
  const maxYear = 2035;

  const canSubmit = useMemo(() => endAt > startAt, [startAt, endAt]);

  const loadEvents = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('calendar')
      .select('id, mentor_id, mentee_id, type, title, start_at, end_at')
      .eq('mentor_id', user.id)
      .order('start_at', { ascending: true });

    if (error) {
      console.warn('Failed to load calendar events', error);
      setLoading(false);
      return;
    }

    const mapped = (data as CalendarRow[]).map((row) => ({
      id: row.id,
      title: row.title ?? (row.type === 'block' ? 'Blocked' : 'Session'),
      start: new Date(row.start_at),
      end: new Date(row.end_at),
      type: row.type,
      mentor_id: row.mentor_id,
      mentee_id: row.mentee_id,
    }));

    setEvents(mapped);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    let channel: any | null = null;

    const bootstrap = async () => {
      await loadEvents();

      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) return;

        channel = supabase
          .channel(`mentor-calendar-${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'calendar', filter: `mentor_id=eq.${user.id}` },
            () => {
              if (isMounted) loadEvents();
            },
          )
          .subscribe();
      } catch (e) {
        console.warn('Failed to subscribe to calendar realtime updates', e);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const resetModalState = () => {
    setTitle('Blocked');
    setStartAt(new Date());
    setEndAt(new Date(Date.now() + 60 * 60 * 1000));
    setEditingEvent(null);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const openCreateBlock = () => {
    resetModalState();
    setModalOpen(true);
  };

  const openSessionDetail = async (event: CalendarEvent) => {
    if (event.type !== 'session' || !event.mentee_id) return;
    setSessionDetailLoading(true);
    setSessionModalOpen(true);
    setSessionDetail(null);

    try {
      // Look up the matching mentor_request
      const { data: req } = await supabase
        .from('mentor_requests')
        .select('description, thread_id, video_link')
        .eq('mentor', event.mentor_id)
        .eq('mentee', event.mentee_id)
        .eq('scheduled_start', event.start.toISOString())
        .single();

      // Look up mentee profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, photo_url')
        .eq('id', event.mentee_id)
        .single();

      setSessionDetail({
        menteeName: profile?.full_name ?? 'Mentee',
        menteePhoto: profile?.photo_url ?? null,
        scheduledStart: event.start.toISOString(),
        scheduledEnd: event.end.toISOString(),
        description: req?.description ?? null,
        threadId: req?.thread_id ?? null,
        menteeId: event.mentee_id,
        videoLink: req?.video_link ?? null,
      });
    } catch (err) {
      console.error('Failed to load session detail', err);
    } finally {
      setSessionDetailLoading(false);
    }
  };

  const openEditBlock = (event: CalendarEvent) => {
    if (event.type !== 'block') return;
    setEditingEvent(event);
    setTitle(event.title ?? 'Blocked');
    setStartAt(new Date(event.start));
    setEndAt(new Date(event.end));
    setModalOpen(true);
  };

  const handleSaveBlock = async () => {
    if (!canSubmit) {
      Alert.alert('Invalid time range', 'End time must be after start time.');
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    if (editingEvent) {
      const { error } = await supabase
        .from('calendar')
        .update({
          title: title.trim().length ? title.trim() : 'Blocked',
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
        })
        .eq('id', editingEvent.id)
        .eq('mentor_id', user.id)
        .eq('type', 'block');

      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('calendar').insert({
        mentor_id: user.id,
        mentee_id: null,
        type: 'block',
        title: title.trim().length ? title.trim() : 'Blocked',
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      });

      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }
    }

    setModalOpen(false);
    resetModalState();
    loadEvents();
  };

  const handleDeleteBlock = async () => {
    if (!editingEvent) return;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { error } = await supabase
      .from('calendar')
      .delete()
      .eq('id', editingEvent.id)
      .eq('mentor_id', user.id)
      .eq('type', 'block');

    if (error) {
      Alert.alert('Delete failed', error.message);
      return;
    }

    setModalOpen(false);
    resetModalState();
    loadEvents();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Mentor" highlight="Calendar" />

      

      <View style={styles.monthHeader}>
        <Pressable
          style={[styles.monthNav, { backgroundColor: isDark ? '#1e2636' : '#eef0f4' }]}
          onPress={() => setVisibleStart(addDays(visibleStart, -stepDays[viewMode]))}
        >
          <Text style={[styles.monthNavText, { color: theme.tint }]}>‹</Text>
        </Pressable>

        <Pressable onPress={() => {
          setMonthPickerYear(visibleStart.getFullYear());
          setMonthPickerMonth(visibleStart.getMonth());
          setMonthPickerOpen(true);
        }}>
          <Text style={[styles.monthText, { color: theme.text }]}>{formatMonth(visibleStart)}</Text>
        </Pressable>

        <Pressable
          style={[styles.monthNav, { backgroundColor: isDark ? '#1e2636' : '#eef0f4' }]}
          onPress={() => setVisibleStart(addDays(visibleStart, stepDays[viewMode]))}
        >
          <Text style={[styles.monthNavText, { color: theme.tint }]}>›</Text>
        </Pressable>
      </View>

      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <Pressable style={styles.mpOverlay} onPress={() => setMonthPickerOpen(false)}>
          <Pressable style={[styles.mpCard, { backgroundColor: isDark ? '#111524' : '#fff' }]} onPress={() => {}}>
            {/* Year row */}
            <View style={styles.mpYearRow}>
              <Pressable
                onPress={() => setMonthPickerYear(y => Math.max(minYear, y - 1))}
                style={styles.mpYearChevron}
              >
                <Text style={[styles.mpYearChevronText, { color: theme.tint }]}>‹</Text>
              </Pressable>
              <Text style={[styles.mpYearLabel, { color: theme.text }]}>{monthPickerYear}</Text>
              <Pressable
                onPress={() => setMonthPickerYear(y => Math.min(maxYear, y + 1))}
                style={styles.mpYearChevron}
              >
                <Text style={[styles.mpYearChevronText, { color: theme.tint }]}>›</Text>
              </Pressable>
            </View>

            {/* Month grid — 4 columns × 3 rows */}
            <View style={styles.mpGrid}>
              {monthNames.map((m, i) => {
                const isSelected = monthPickerMonth === i;
                const isCurrentMonth =
                  i === new Date().getMonth() && monthPickerYear === new Date().getFullYear();
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMonthPickerMonth(i)}
                    style={[
                      styles.mpCell,
                      isSelected && { backgroundColor: theme.tint },
                      !isSelected && isCurrentMonth && {
                        borderWidth: 1.5,
                        borderColor: theme.tint,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.mpCellText,
                        { color: isSelected ? '#fff' : theme.text },
                        !isSelected && isCurrentMonth && { color: theme.tint, fontWeight: '700' },
                      ]}
                    >
                      {m.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.mpActions}>
              <Pressable
                style={[styles.mpBtn, { backgroundColor: isDark ? '#1f2937' : '#e9eaef' }]}
                onPress={() => setMonthPickerOpen(false)}
              >
                <Text style={[styles.mpBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.mpBtn, { backgroundColor: theme.tint, flex: 1 }]}
                onPress={() => {
                  setVisibleStart(new Date(monthPickerYear, monthPickerMonth, 1));
                  setMonthPickerOpen(false);
                }}
              >
                <Text style={[styles.mpBtnText, { color: '#fff' }]}>Go to {monthNames[monthPickerMonth].slice(0, 3)} {monthPickerYear}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    

      <View
        style={[styles.calendarWrap, { backgroundColor: calendarBg, borderColor }]}
        onLayout={(e) => setCalendarHeight(e.nativeEvent.layout.height)}
      >
        <BigCalendar
          events={events}
          height={calendarHeight || 420}
          mode={viewMode}
          date={visibleStart}
          calendarCellStyle={(date?: Date, hourRowIndex?: number) => {
            const day = date ? date.getDay() : 0;
            const row = hourRowIndex ?? 0;
            const useA = (day + row) % 2 === 0;
            return { backgroundColor: useA ? checkerA : checkerB };
          }}
          swipeEnabled={false}
          showAllDayEventCell={false}
          calendarContainerStyle={{
            paddingRight: 18,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: borderColor,
            backgroundColor: calendarBg,
          }}
          bodyContainerStyle={{ paddingRight: 0, marginRight: 0, backgroundColor: calendarBg }}
          headerContainerStyle={{ height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }}
          headerContentStyle={{ paddingTop: 4, paddingBottom: 4 }}
          dayHeaderStyle={{ marginTop: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}
          dayHeaderHighlightColor={todayHighlightColor}
          weekDayHeaderHighlightColor={todayHighlightColor}
          hourStyle={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}
          theme={calendarTheme}
          isLoading={loading}
          eventCellTextColor={isDark ? '#e2e8f0' : '#1e293b'}
          renderEvent={(event: CalendarEvent, touchableOpacityProps: TouchableOpacityProps) => {
            const { key, ...restProps } = touchableOpacityProps as any;
            return (
              <TouchableOpacity key={key} {...restProps} style={[restProps.style, { overflow: 'hidden' }]}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {event.title}
                </Text>
              </TouchableOpacity>
            );
          }}
          onPressEvent={(event: CalendarEvent) => {
            if (event.type === 'block') openEditBlock(event);
            if (event.type === 'session') openSessionDetail(event);
          }}
          eventCellStyle={(event: CalendarEvent) => {
            const isBlock = event.type === 'block';
            return {
              backgroundColor: isBlock
                ? (isDark ? '#2a3346' : '#e8eaf2')
                : (isDark ? '#1a3a38' : '#e8f5f4'),
              borderLeftWidth: 3,
              borderLeftColor: isBlock ? '#6b7fff' : '#34d399',
              borderRadius: 8,
              padding: 4,
              shadowColor: '#000',
              shadowOpacity: isDark ? 0.3 : 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 2,
            };
          }}
        />
      </View>

      

      <View style={styles.toolbarBelow}>

        <Pressable style={[styles.addButton, { backgroundColor: theme.tint }]} onPress={openCreateBlock}>
          <Text style={styles.addButtonText}>+ Block time</Text>
        </Pressable>
        
        <View style={styles.modeSelector}>
          {modeLabels.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[
                styles.modePill,
                { backgroundColor: viewMode === key ? theme.tint : (isDark ? '#1f2937' : '#e5e7eb') },
              ]}
              onPress={() => setViewMode(key)}
            >
              <Text style={[
                styles.modePillText,
                { color: viewMode === key ? '#fff' : theme.text },
              ]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      


      

      

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingEvent ? 'Edit block' : 'Create block'}
            </Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Block title"
              placeholderTextColor="#7f8186"
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            />

            <Pressable
              style={styles.pickerButton}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  LayoutAnimation.configureNext(pickerAnim);
                  setShowStartPicker((prev) => !prev);
                } else {
                  setPickerTarget('start');
                  setShowDatePicker(true);
                }
              }}
            >
              <Text style={styles.pickerLabel}>Start</Text>
              <Text style={styles.pickerValue}>{startAt.toLocaleString()}</Text>
            </Pressable>

            {Platform.OS === 'ios' && showStartPicker && (
              <DateTimePicker
                value={startAt}
                mode="datetime"
                display="spinner"
                onChange={(_event: DateTimePickerEvent, date?: Date) => {
                  if (date) setStartAt(date);
                }}
              />
            )}

            <Pressable
              style={styles.pickerButton}
              onPress={() => {
                if (Platform.OS === 'ios') {
                  LayoutAnimation.configureNext(pickerAnim);
                  setShowEndPicker((prev) => !prev);
                } else {
                  setPickerTarget('end');
                  setShowDatePicker(true);
                }
              }}
            >
              <Text style={styles.pickerLabel}>End</Text>
              <Text style={styles.pickerValue}>{endAt.toLocaleString()}</Text>
            </Pressable>

            {Platform.OS === 'ios' && showEndPicker && (
              <DateTimePicker
                value={endAt}
                mode="datetime"
                display="spinner"
                onChange={(_event: DateTimePickerEvent, date?: Date) => {
                  if (date) setEndAt(date);
                }}
              />
            )}

            {Platform.OS === 'android' && showDatePicker && (
              <DateTimePicker
                value={pickerTarget === 'start' ? startAt : endAt}
                mode="date"
                onChange={(_event: DateTimePickerEvent, date?: Date) => {
                  setShowDatePicker(false);
                  if (!date) return;
                  const base = pickerTarget === 'start' ? startAt : endAt;
                  const merged = new Date(date);
                  merged.setHours(base.getHours(), base.getMinutes(), 0, 0);
                  setTempDate(merged);
                  setShowTimePicker(true);
                }}
              />
            )}

            {Platform.OS === 'android' && showTimePicker && (
              <DateTimePicker
                value={tempDate ?? (pickerTarget === 'start' ? startAt : endAt)}
                mode="time"
                onChange={(_event: DateTimePickerEvent, date?: Date) => {
                  setShowTimePicker(false);
                  if (!date) return;
                  const merged = new Date(tempDate ?? date);
                  merged.setHours(date.getHours(), date.getMinutes(), 0, 0);

                  if (pickerTarget === 'start') setStartAt(merged);
                  if (pickerTarget === 'end') setEndAt(merged);
                  setTempDate(null);
                  setPickerTarget(null);
                }}
              />
            )}

            <View style={styles.modalActions}>
              {editingEvent && (
                <Pressable style={[styles.deleteButton]} onPress={handleDeleteBlock}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              )}

              <View style={{ flex: 1 }} />

              <Pressable style={styles.cancelButton} onPress={() => { setModalOpen(false); resetModalState(); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.saveButton, { opacity: canSubmit ? 1 : 0.5 }]}
                onPress={handleSaveBlock}
                disabled={!canSubmit}
              >
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Session detail modal */}
      <Modal visible={sessionModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            {sessionDetailLoading ? (
              <Text style={{ color: theme.text, textAlign: 'center' }}>Loading...</Text>
            ) : sessionDetail ? (
              <>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Session Details</Text>

                <View style={styles.sessionDetailHeader}>
                  <View style={styles.sessionDetailAvatar}>
                    {sessionDetail.menteePhoto ? (
                      <Image source={{ uri: sessionDetail.menteePhoto }} style={styles.sessionDetailAvatarImg} />
                    ) : (
                      <Text style={styles.sessionDetailAvatarText}>
                        {sessionDetail.menteeName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionDetailName, { color: theme.text }]}>
                      {sessionDetail.menteeName}
                    </Text>
                    <Text style={styles.sessionDetailTime}>
                      {new Date(sessionDetail.scheduledStart).toLocaleDateString()} at{' '}
                      {new Date(sessionDetail.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(sessionDetail.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                {sessionDetail.description ? (
                  <View style={styles.sessionDetailDescBlock}>
                    <Text style={styles.sessionDetailDescLabel}>Needs help with:</Text>
                    <Text style={[styles.sessionDetailDesc, { color: theme.text }]}>
                      {sessionDetail.description}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.sessionDetailDescLabel}>No description provided.</Text>
                )}

                <View style={styles.modalActions}>
                  {sessionDetail.threadId && sessionDetail.menteeId ? (
                    <Pressable
                      style={[styles.saveButton, { flex: 1 }]}
                      onPress={() => {
                        setSessionModalOpen(false);
                        router.push({
                          pathname: '/(app)/Mentor/chat' as any,
                          params: {
                            threadId: String(sessionDetail.threadId),
                            otherId: sessionDetail.menteeId!,
                            name: sessionDetail.menteeName,
                          },
                        });
                      }}
                    >
                      <Text style={styles.saveText}>Open Chat</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[styles.cancelButton, { flex: 1 }]}
                    onPress={() => setSessionModalOpen(false)}
                  >
                    <Text style={[styles.cancelText, { textAlign: 'center' }]}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={{ color: theme.text, textAlign: 'center' }}>Could not load session details.</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 130,
  },
  calendarWrap: {
    flex: 1,
    minHeight: 380,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toolbarBelow: {
    marginTop: 12,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 6,
  },
  modePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  monthHeader: {
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  monthNav: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavText: {
    fontSize: 24,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerButton: {
    backgroundColor: '#efefef',
    padding: 10,
    borderRadius: 10,
  },
  pickerLabel: {
    fontSize: 12,
    color: '#555',
  },
  pickerValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  cancelText: {
    color: '#111',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#333f5c',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
  sessionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sessionDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionDetailAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sessionDetailAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sessionDetailName: {
    fontSize: 16,
    fontWeight: '700',
  },
  sessionDetailTime: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  sessionDetailDescBlock: {
    gap: 4,
  },
  sessionDetailDescLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  sessionDetailDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  /* ── Month/Year picker ── */
  mpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mpCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  mpYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  mpYearChevron: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mpYearChevronText: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: -2,
  },
  mpYearLabel: {
    fontSize: 22,
    fontWeight: '800',
    minWidth: 70,
    textAlign: 'center',
  },
  mpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  mpCell: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  mpCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mpActions: {
    flexDirection: 'row',
    gap: 10,
  },
  mpBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mpBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});






/*
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { commonStyles } from '../../../src/styles/common';

export default function MentorCalendarScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Calendar"
        subtitle="Mentors will see upcoming calls and set availability here."
      />
      {// Later: calendar UI / availability picker}
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 120,
  },
});
*/
