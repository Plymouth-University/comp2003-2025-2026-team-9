import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Text,
  Image,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { commonStyles } from '../../../src/styles/common';
import { font } from '../../../src/lib/fonts';
import { supabase } from '../../../src/lib/supabase';

type Mentor = {
  id: string;
  full_name?: string;
  title?: string;
  industry?: string;
  photo_url?: string;
  role?: string;
};

/**
 * Layout tuning:
 * - CARD_WIDTH: fixed card width in px
 * - GAP: horizontal & vertical gap between cards (px)
 * - H_PADDING: horizontal screen padding (matches container paddingHorizontal)
 *
 * Adjust CARD_WIDTH / GAP to taste. The component will:
 * - compute how many columns fit in the available width,
 * - build an inner container sized to exactly hold that many columns,
 * - center that inner container horizontally,
 * - append invisible placeholders so the last row aligns with full rows.
 */


const CARD_WIDTH = 100;
const GAP = 15;
const H_PADDING = 18;

export default function MentorHub() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);

  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    const fetchMentors = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, title, industry, photo_url') //price when column is added
        .eq('role', 'mentor');

      if (error) {
        console.error('Error loading mentors', error);
      } else {
        setMentors(data as Mentor[]);
      }

      setLoading(false);
    };

    fetchMentors();
  }, []);

  const filteredMentors = mentors.filter((m) =>
    (m.full_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    (m.industry ?? '').toLowerCase().includes(query.toLowerCase())
  );

  // compute layout: columns, contentWidth, placeholders to fill last row
  const { columns, contentWidth, placeholderCount } = useMemo(() => {
    // available width inside the horizontal padding
    const available = Math.max(0, screenWidth - H_PADDING * 2);

    // how many columns fit (account for GAP between cards)
    const computedColumns = Math.max(
      1,
      Math.floor((available + GAP) / (CARD_WIDTH + GAP))
    );

    const contentW = computedColumns * CARD_WIDTH + (computedColumns - 1) * GAP;

    const remainder = filteredMentors.length % computedColumns;
    const placeholders = remainder === 0 ? 0 : computedColumns - remainder;

    return {
      columns: computedColumns,
      contentWidth: contentW,
      placeholderCount: placeholders,
    };
  }, [screenWidth, filteredMentors.length]);

  // build render list with placeholders appended (typed to avoid implicit any)
  const renderItems: Array<Mentor | { __placeholder: true; key: string }> = useMemo(() => {
    const items: Array<Mentor | { __placeholder: true; key: string }> = [
      ...filteredMentors,
    ];
    for (let i = 0; i < placeholderCount; i++) {
      items.push({ __placeholder: true, key: `ph-${i}` });
    }
    return items;
  }, [filteredMentors, placeholderCount]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScreenHeader
        title="Mentor"
        highlight="Hub"
      />

      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Search..."
            placeholderTextColor="#7f8186"
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { backgroundColor: theme.card, color: theme.text }]}
            returnKeyType="search"
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable style={[styles.filterButton, { backgroundColor: theme.card }]}>
            <Text style={[styles.filterText, {color: theme.text}]}>Industry...</Text>
            <Text style={styles.chev}>▾</Text>
          </Pressable>

          <Pressable style={[styles.filterButton, { backgroundColor: theme.card }]}>
            <Text style={[styles.filterText, {color: theme.text}]}>Distance...</Text>
            <Text style={styles.chev}>▾</Text>
          </Pressable>
        </View>
      </View>

      {/* ScrollView centers the inner grid block via contentContainerStyle alignItems:'center' */}
      <ScrollView 
      contentContainerStyle={[
          styles.scrollContainer,
          { paddingHorizontal: H_PADDING, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={true}
      >
        {/* centered block with fixed width exactly matching the columns */}
        <View style={[styles.innerContainer, { width: contentWidth }]}>
          {renderItems.map((item, index) => {
            const isPlaceholder = '__placeholder' in item;
            const key = isPlaceholder ? (item as { __placeholder: true; key: string }).key : (item as Mentor).id;
            const isLastColumn = (index % columns) === (columns - 1);

            return (
              <View
                key={key ?? index}
                pointerEvents={isPlaceholder ? 'none' : 'auto'}
                style={[
                  styles.card,
                  {
                    width: CARD_WIDTH,
                    marginRight: isLastColumn ? 0 : GAP,
                    marginBottom: GAP,
                    opacity: isPlaceholder ? 0 : 1,
                  },
                ]}
              >
                {isPlaceholder ? null : (
                  <>
                    {(item as Mentor).photo_url ? (
                      <Image source={{ uri: (item as Mentor).photo_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatar} />
                    )}

                    <Text style={[styles.name, { color: theme.text }]}>
                      {(item as Mentor).full_name ?? 'Unnamed mentor'}
                    </Text>

                    {(item as Mentor).title && (
                      <Text style={[styles.subtitle, { color: theme.text }]}>
                        {(item as Mentor).title}
                      </Text>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const AVATAR_SIZE = 56;
const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: H_PADDING,
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  controls: {
    width: '100%',
    gap: 12,
    marginBottom: 8,
  },
  searchRow: {
    width: '100%',
  },
  searchInput: {
    width: '100%',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 18,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  filterButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  filterText: {
    color: '#3b3b3b',
    fontSize: 16,
  },
  chev: {
    color: '#3b3b3b',
    fontSize: 20,
  },

  // Scroll container centers the innerContainer which has exact contentWidth
  scrollContainer: {
    alignItems: 'center',
    paddingTop: 12,
  },

  // innerContainer width is set dynamically in-line (contentWidth)
  innerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },

  // card wrapper: width overridden in-line to CARD_WIDTH; contents are centered
  card: {
    alignItems: 'center',
    position: 'relative',
  },

  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#d9d9d9',
    marginBottom: 6,
  },
  name: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
    opacity: 0.7,
  },
  priceTag: {
    position: 'absolute',
    right: 4,
    top: 8,
    backgroundColor: '#ffd24d',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    flexDirection: 'row',
  },
  priceEmoji: {
    marginRight: 4,
    fontSize: 14,
  },
  priceText: {
    fontWeight: '700',
    fontSize: 12,
  },
  priceUnit: {
    fontSize: 10,
    color: '#333',
    marginLeft: 4,
  },
});