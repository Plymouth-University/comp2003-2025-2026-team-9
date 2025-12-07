import { useState } from 'react';
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

const SCREEN_WIDTH = Dimensions.get('window').width;

const MOCK_MENTORS = [
  { id: '1', name: 'J. Doe, PhD', price: 10 },
  { id: '2', name: 'A. Banfield', price: 10 },
  { id: '3', name: 'J. Pinder', price: 20 },
  { id: '4', name: 'R. Grixti', price: 10 },
  { id: '5', name: 'A. Lee', price: 30 },
  { id: '6', name: 'R. Chen', price: 10 },
  { id: '7', name: '', price: 0 },
  { id: '8', name: '', price: 0 },
  { id: '9', name: '', price: 0 },
];

export default function MentorHub() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
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
            style={[styles.searchInput, { backgroundColor: theme.card }]}
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
        {MOCK_MENTORS.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.avatar} />
            <Text style={[styles.name,{color: theme.text}]}>{m.name}</Text>
            {m.price > 0 ? (
              <View style={styles.priceTag}>
                <Text style={styles.priceEmoji}>💎</Text>
                <Text style={styles.priceText}>{m.price}</Text>
                <Text style={styles.priceUnit}>/session</Text>
              </View>
            ) : null}
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
    color: '#111',
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