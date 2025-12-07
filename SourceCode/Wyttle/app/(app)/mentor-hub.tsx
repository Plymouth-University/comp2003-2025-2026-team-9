import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Text,
  Image,
  Dimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { commonStyles } from '../../src/styles/common';
import { font } from '../../src/lib/fonts';
import { supabase } from '../../src/lib/supabase';
import { BackButton } from '@/components/ui/BackButton';

const SCREEN_WIDTH = Dimensions.get('window').width;

type Mentor = {
  id: string;
  full_name?: string;
  title?: string;
  industry?: string;
  photo_url?: string;
  role?: string;
};

export default function MentorHub() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMentors = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, title, industry, photo_url')
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


  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <BackButton />
      <View style={styles.headerWrap}>
        <ThemedText style={[styles.title, font('SpaceGrotesk', '400'), {color: theme.text}]}>Mentor <Text style={[styles.titleBold, {color: theme.text}]}>Hub</Text></ThemedText>
      </View>

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

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={true}>
        {loading && (
        <Text style={{ marginTop: 12, color: theme.text }}>Loading mentors…</Text>
        )}

        {!loading && filteredMentors.map((m) => (
        <View key={m.id} style={styles.card}>
            {m.photo_url ? (
            <Image source={{ uri: m.photo_url }} style={styles.avatar} />
            ) : (
            <View style={styles.avatar} />
            )}

            <Text style={[styles.name, { color: theme.text }]}>
            {m.full_name ?? 'Unnamed mentor'}
            </Text>

            {m.title && (
            <Text style={[styles.subtitle, { color: theme.text }]}>
                {m.title}
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
        </View>
        ))}

      </ScrollView>
    </View>
  );
}

const AVATAR_SIZE = 56;
const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingTop: 36,
    paddingHorizontal: 18,
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    color: '#111',
  },
  titleBold: {
    fontWeight: '700',
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 120,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  card: {
    width: (SCREEN_WIDTH - 18 * 2 - 12 * 2) / 3,
    alignItems: 'center',
    marginBottom: 18,
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