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

import { router } from 'expo-router';
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

const INDUSTRIES = [
  'Accounting',
  'Advertising',
  'Aerospace',
  'Agriculture',
  'Architecture',
  'Automotive',
  'Banking',
  'Biotechnology',
  'Bricklaying',
  'Broadcasting',
  'Construction',
  'Consulting',
  'Education',
  'Electronics',
  'Energy',
  'Engineering',
  'Entertainment',
  'Fashion',
  'Finance',
  'Food & Beverage',
  'Government',
  'Healthcare',
  'Hospitality',
  'Human Resources',
  'Information Technology',
  'Insurance',
  'Legal',
  'Manufacturing',
  'Marketing',
  'Media',
  'Non-Profit',
  'Pharmaceuticals',
  'Real Estate',
  'Retail',
  'Software',
  'Sports',
  'Technology',
  'Telecommunications',
  'Transportation',
  'Travel & Tourism',
  'Utilities',
].sort(); // Already alphabetically sorted but never know

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

  //Distance filter state (null = no distance filter)
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [showDistanceOptions, setShowDistanceOptions] = useState(false);

  //Industry filter state (null = no industry filter)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [showIndustryOptions, setShowIndustryOptions] = useState(false);


  /**
   * Placeholder distance getter.
   * - Right now profiles don't have distance info in DB.
   * - When storing distances on the profile (e.g. the backend adds "distance_miles"),
   *   this function should return that numeric value in miles.
   * - For now this checks a `distance_miles` field on the profile object (if present).
   * - Return `null` when unknown.
   */
  const computeDistanceMiles = (p: Mentor): number | null => {
    // TODO: replace this with real calculation / DB-provided distance
    // For now, check a placeholder property that we can add later: distance_miles
    const asAny = p as any;
    if (typeof asAny.distance_miles === 'number') return asAny.distance_miles;
    return null;
  };

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


  // filter by query then sort alphabetically by full name (case-insensitive)
  const filteredMentors = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = mentors.filter((m) => {
      // search match
      const matchesQuery = !q || (
        (m.full_name ?? '').toLowerCase().includes(q) ||
        (m.industry ?? '').toLowerCase().includes(q)
      );
      if (!matchesQuery) return false;

      // industry filter (only apply when user selected an industry)
      if (selectedIndustry != null) {
        if (!m.industry || m.industry !== selectedIndustry) return false;
      }

      // distance filter (only apply when user selected a distance)
      if (selectedDistance != null) {
        const d = computeDistanceMiles(m);
        // currently we exclude mentors with unknown distance (d === null)
        if (d === null) return false;
        return d <= selectedDistance;
      }

      return true;
    });

    // case-insensitive sort by full_name
    return filtered.slice().sort((a, b) => {
      const aName = (a.full_name ?? '').toLowerCase();
      const bName = (b.full_name ?? '').toLowerCase();
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });
  }, [mentors, query, selectedDistance, selectedIndustry]);


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
          <Pressable 
            style={[styles.filterButton, { backgroundColor: theme.card }]}
            onPress={() => setShowIndustryOptions((s) => !s)}
          >
            <Text style={[styles.filterText, {color: theme.text}]}>{selectedIndustry || 'Industry...'}</Text>
            <Text style={styles.chev}>{showIndustryOptions ? '▴' : '▾'}</Text>
          </Pressable>

          

          <Pressable 
            style={[styles.filterButton, { backgroundColor: theme.card }]}
            onPress={() => setShowDistanceOptions((s) => !s)}
          >
            <Text style={[styles.filterText, {color: theme.text}]}>
              {selectedDistance ? `≤ ${selectedDistance} mi` : 'Distance...'}
              </Text>
            <Text style={styles.chev}>{showDistanceOptions ? '▴' : '▾' }</Text>

          </Pressable>
        </View>

        {/* Industry options - two rows that scroll together */}
        {showIndustryOptions && (
          <View style={{ marginTop: 8, maxHeight: 80 }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2, paddingVertical: 4 }}
            >
              <View style={{ flexDirection: 'column', gap: 8 }}>
                {/* First row - even indices (0, 2, 4, ...) */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setSelectedIndustry(null);
                      setShowIndustryOptions(false);
                    }}
                    style={[
                      styles.distanceOption, 
                      { marginLeft: 6 },
                      selectedIndustry === null ? styles.distanceOptionActive : undefined,
                    ]}
                  >
                    <Text style={[
                      styles.distanceOptionText,
                      selectedIndustry === null ? styles.distanceOptionTextActive : undefined
                      ]}>Any
                    </Text>
                  </Pressable>

                  {INDUSTRIES.filter((_, index) => index % 2 === 0).map((industry) => {
                    const active = selectedIndustry === industry;
                    return (
                      <Pressable
                        key={industry}
                        onPress={() => {
                          setSelectedIndustry(industry);
                          setShowIndustryOptions(false);
                        }}
                        style={[
                          styles.distanceOption,
                          active ? styles.distanceOptionActive : undefined,
                        ]}
                      >
                        <Text style={[styles.distanceOptionText, active ? styles.distanceOptionTextActive : undefined]}>
                          {industry}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Second row - odd indices (1, 3, 5, ...) */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {INDUSTRIES.filter((_, index) => index % 2 === 1).map((industry) => {
                    const active = selectedIndustry === industry;
                    return (
                      <Pressable
                        key={industry}
                        onPress={() => {
                          setSelectedIndustry(industry);
                          setShowIndustryOptions(false);
                        }}
                        style={[
                          styles.distanceOption,
                          active ? styles.distanceOptionActive : undefined,
                        ]}
                      >
                        <Text style={[styles.distanceOptionText, active ? styles.distanceOptionTextActive : undefined]}>
                          {industry}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Distance options (10-mile intervals). Visible only when showDistanceOptions === true */}
        {showDistanceOptions && (
          <View style={{ marginTop: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2 }}>

              <Pressable
                onPress={() => {
                  setSelectedDistance(null);
                  setShowDistanceOptions(false);
                }}
                style={[
                  styles.distanceOption, 
                  { marginLeft: 6 },
                  selectedDistance === null ? styles.distanceOptionActive : undefined
                ]}
              >
                <Text style={[
                  styles.distanceOptionText,
                  selectedDistance === null ? styles.distanceOptionTextActive : undefined
                ]}>
                  Any
                </Text>
              </Pressable>

              {[10, 20, 30, 40, 50, 100].map((d) => {
                const active = selectedDistance === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      setSelectedDistance(d);
                      setShowDistanceOptions(false);
                    }}
                    style={[
                      styles.distanceOption,
                      active ? styles.distanceOptionActive : undefined,
                    ]}
                  >
                    <Text style={[styles.distanceOptionText, active ? styles.distanceOptionTextActive : undefined]}>
                      {d} mi
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
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
              <Pressable
                key={key ?? index}
                onPress={() => {
                  if (!isPlaceholder) {
                    router.push({
                      pathname: '/(app)/Mentee/profile-view',
                      params: { userId: (item as Mentor).id },
                    });
                  }
                }}
                disabled={isPlaceholder}
                accessibilityRole="button"
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
                    {item.photo_url ? (
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

                    {/* When we add a price/tokens column, render it here */}
                    {/* {m.tokens_rate && m.tokens_rate > 0 && (
                    <View style={styles.priceTag}>
                        <Text style={styles.priceEmoji}>💎</Text>
                        <Text style={styles.priceText}>{m.tokens_rate}</Text>
                        <Text style={styles.priceUnit}>/session</Text>
                    </View>
                    )} */}

                  </>
                )}
              </Pressable>
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
    marginBottom: -8,
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
  distanceOption: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderRadius: 999,
    backgroundColor: '#efefef',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  distanceOptionActive: {
    backgroundColor: '#333f5c', // Taskbar colour
    borderColor: '#000000',
  },
  distanceOptionText: {
    fontSize: 13,
    color: '#333',
  },
  distanceOptionTextActive: {
    color: '#fff',
  },
});