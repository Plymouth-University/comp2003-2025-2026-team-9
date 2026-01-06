import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
} from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../../../src/lib/fonts';
import { commonStyles } from '../../../src/styles/common';
import { supabase } from '../../../src/lib/supabase';

type TokenPackage = {
  id: string;
  tokens: number;
  price: number; // USD
  popular?: boolean;
};

const PACKAGES: TokenPackage[] = [
  { id: 'pack-10', tokens: 10, price: 9.99 },
  { id: 'pack-25', tokens: 25, price: 19.99, popular: true },
  { id: 'pack-50', tokens: 50, price: 34.99 },
  { id: 'pack-100', tokens: 100, price: 59.99 },
];

export default function BuyTokensScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('tokens_balance')
          .eq('id', user.id)
          .maybeSingle();

        setCurrentBalance(profile?.tokens_balance ?? 0);
      } catch (err) {
        console.warn('Failed to load token balance', err);
      }
    };
    loadBalance();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setLoading(true);

    // Mock purchase delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        setLoading(false);
        return;
      }

      // In production, this would go through Stripe/payment gateway
      // For now, just increment the balance directly (mock)
      const newBalance = (currentBalance ?? 0) + selectedPackage.tokens;

      const { error } = await supabase
        .from('profiles')
        .update({ tokens_balance: newBalance })
        .eq('id', user.id);

      if (error) throw error;

      setCurrentBalance(newBalance);
      setSelectedPackage(null);

      Alert.alert(
        'Purchase Complete!',
        `${selectedPackage.tokens} tokens added to your account.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      console.error('Failed to purchase tokens', err);
      Alert.alert('Purchase Failed', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        <BackButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Buy Tokens"
          subtitle="Purchase tokens to book mentorship sessions."
        />

        <View style={styles.balanceCard}>
          <Text style={[styles.balanceLabel, { color: theme.text }]}>
            Current Balance
          </Text>
          <Text style={[styles.balanceAmount, { color: theme.text }]}>
            {currentBalance ?? 0} tokens
          </Text>
        </View>

        <Text
          style={[
            styles.sectionTitle,
            font('GlacialIndifference', '800'),
            { color: theme.text },
          ]}
        >
          Select a package
        </Text>

        {PACKAGES.map((pkg) => {
          const isSelected = selectedPackage?.id === pkg.id;
          return (
            <TouchableOpacity
              key={pkg.id}
              style={[
                styles.packageCard,
                { backgroundColor: theme.card },
                isSelected && styles.packageCardSelected,
                pkg.popular && styles.packageCardPopular,
              ]}
              onPress={() => setSelectedPackage(pkg)}
              activeOpacity={0.8}
            >
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>POPULAR</Text>
                </View>
              )}

              <View style={styles.packageInfo}>
                <Text
                  style={[
                    styles.packageTokens,
                    font('GlacialIndifference', '800'),
                    { color: theme.text },
                  ]}
                >
                  {pkg.tokens} tokens
                </Text>
                <Text style={[styles.packagePrice, { color: theme.text }]}>
                  ${pkg.price.toFixed(2)}
                </Text>
              </View>

              {isSelected && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {selectedPackage && (
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              loading && { opacity: 0.6 },
            ]}
            onPress={handlePurchase}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.purchaseButtonText}>
              {loading
                ? 'Processing...'
                : `Purchase ${selectedPackage.tokens} tokens for $${selectedPackage.price.toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            🔒 This is a mock purchase screen. In production, payments would be processed securely via Stripe.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#333f5c',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#e0dfd5',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  packageCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  packageCardSelected: {
    borderColor: '#333f5c',
  },
  packageCardPopular: {
    borderColor: '#968c6c',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#968c6c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  packageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageTokens: {
    fontSize: 20,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  purchaseButton: {
    marginTop: 24,
    backgroundColor: '#333f5c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#f0eee5',
    borderRadius: 10,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
  },
});
