import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, LayoutAnimation, Modal, Platform, Pressable, StyleSheet, Text, TextInput, UIManager, View } from 'react-native';
import { Calendar as BigCalendar, ICalendarEventBase } from 'react-native-big-calendar';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/src/lib/supabase';
import { commonStyles } from '@/src/styles/common';
import { Background } from '@react-navigation/elements';
import { setStatusBarBackgroundColor } from 'expo-status-bar';

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
  const lineColor = isDark ? '#2f3948' : '#444444'; // darker-but-subtle on dark, stronger on light
  const borderColor = lineColor;
  const todayHighlightColor = isDark ? undefined : theme.tint; // preserve dark "today", use tint in light
  const calendarBlueBase = isDark ? '#122b57' : '#eaf2ff';
  const checkerBlueA = isDark ? '#24508f' : '#cfe0ff'; //Left is dark mode first cell color, right is light mode first cell 
  const checkerBlueB = isDark ? '#000000' : '#ffffff'; //Left is dark mode second cell color, right is light mode second cell 

  const calendarTheme = {
    palette: {
      primary: { main: theme.tint, contrastText: '#fff' },
      nowIndicator: '#ff3b30',
      gray: {
        '100': isDark ? '#111827' : '#f3f4f6', 
        '200': isDark ? '#1f2937' : '#8b8b8b',
        '300': isDark ? '#374151' : '#cbd5e1',
        '500': isDark ? '#2f3948' : '#2e2e2e', //cell borders for light mode
        '800': isDark ? '#d1d5db' : '#6b7280',
      },
      moreLabel: isDark ? '#cbd5e1' : '#6b7280',
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
    loadEvents();
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
        .eq('mentor_id', user.id);

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

    const { error } = await supabase
      .from('calendar')
      .delete()
      .eq('id', editingEvent.id);

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
          style={styles.monthNav}
          onPress={() => setVisibleStart(addDays(visibleStart, -stepDays[viewMode]))}
        >
          <Text style={styles.monthNavText}>‹</Text>
        </Pressable>

        <Pressable onPress={() => {
          setMonthPickerYear(visibleStart.getFullYear());
          setMonthPickerMonth(visibleStart.getMonth());
          setMonthPickerOpen(true);
        }}>
          <Text style={[styles.monthText, { color: theme.text }]}>{formatMonth(visibleStart)}</Text>
        </Pressable>

        <Pressable
          style={styles.monthNav}
          onPress={() => setVisibleStart(addDays(visibleStart, stepDays[viewMode]))}
        >
          <Text style={styles.monthNavText}>›</Text>
        </Pressable>
      </View>

      <Modal visible={monthPickerOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, minWidth: 280, alignItems: 'center' }]}> 
            <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 8 }]}>Select Month & Year</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Pressable onPress={() => setMonthPickerYear(y => Math.max(minYear, y - 1))} style={{ padding: 8 }}>
                <Text style={{ fontSize: 20, color: theme.text }}>‹</Text>
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.text, minWidth: 60, textAlign: 'center' }}>{monthPickerYear}</Text>
              <Pressable onPress={() => setMonthPickerYear(y => Math.min(maxYear, y + 1))} style={{ padding: 8 }}>
                <Text style={{ fontSize: 20, color: theme.text }}>›</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
              {monthNames.map((m, i) => (
                <Pressable
                  key={m}
                  onPress={() => setMonthPickerMonth(i)}
                  style={{
                    margin: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: monthPickerMonth === i ? theme.tint : (isDark ? '#1f2937' : '#e5e7eb'),
                  }}
                >
                  <Text style={{ color: monthPickerMonth === i ? '#fff' : theme.text }}>{m}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                style={[styles.cancelButton, { minWidth: 80 }]}
                onPress={() => setMonthPickerOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, { minWidth: 80 }]}
                onPress={() => {
                  setVisibleStart(new Date(monthPickerYear, monthPickerMonth, 1));
                  setMonthPickerOpen(false);
                }}
              >
                <Text style={styles.saveText}>Go</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    

      <View
        style={[styles.calendarWrap, {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor,
          paddingRight: 0,
        }]}
        onLayout={(e) => setCalendarHeight(e.nativeEvent.layout.height)}
      >
        <BigCalendar
          events={events}
          height={calendarHeight || 420}
          mode={viewMode}
          date={visibleStart}
          calendarCellStyle={(date, hourRowIndex ) => {
            const day = date ? date.getDay() : 0;
            const row = hourRowIndex ?? 0;
            const useA = (day + row) % 2 === 0;
            return { backgroundColor: useA ? checkerBlueA : checkerBlueB };
          }}
          onChangeDate={(range: Date[] | Date) => {
            const next = Array.isArray(range) ? range[0] : range;
            if (next) setVisibleStart(new Date(next));
          }}
          swipeEnabled={false}
          showAllDayEventCell={false}
          calendarContainerStyle={{
            paddingRight: 18,
            borderRightWidth: StyleSheet.hairlineWidth,
            borderRightColor: borderColor,
            backgroundColor: calendarBlueBase,
          }}
          bodyContainerStyle={{ paddingRight: 0, marginRight: 0, backgroundColor: calendarBlueBase, }}
          headerContainerStyle={{ height: 40 }}
          headerContentStyle={{ paddingTop: 0, paddingBottom: 0 }}
          dayHeaderStyle={{ marginTop: -2, fontSize: 12, color: theme.text }}
          dayHeaderHighlightColor={todayHighlightColor}
          weekDayHeaderHighlightColor={todayHighlightColor}
          hourStyle={{ color: isDark ? '#eaf2ff' : '#1e3a8a'  }}
          theme={calendarTheme}
          isLoading={loading}
          onPressEvent={(event: CalendarEvent) => {
            if (event.type === 'block') openEditBlock(event);
          }}
          eventCellStyle={(event: CalendarEvent) => {
            return {
              backgroundColor: event.type === 'block' ? '#333f5c' : '#4b8f8c',
              borderRadius: 6,
              padding: 2,
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
    minHeight: 380, // adjust to raise/lower bottom edge
    //paddingLeft: 40, // visual alignment tweak
    paddingRight: 0,
    //paddingBottom: 120,
  },
  toolbarBelow: {
    marginTop: 8,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  monthHeader: {
    paddingVertical: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
  },
  monthNav: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
  },
  monthNavText: {
    fontSize: 22,
    fontWeight: '700',
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
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
