import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { font } from '../../src/lib/fonts';

export type ScreenHeaderProps = {
  title: string;
  /** Optional word to highlight at the end of the title, e.g. "Hub" in "Mentor Hub" */
  highlight?: string;
  subtitle?: string;
  /** align header text; top-level tabs often want 'left', some screens 'center' */
  align?: 'left' | 'center';
};

export function ScreenHeader({ title, highlight, subtitle, align = 'left' }: ScreenHeaderProps) {
  const alignItems = align === 'center' ? 'center' : 'flex-start';

  return (
    <View style={[styles.header, { alignItems }]}>
      <ThemedText style={[styles.title, font('SpaceGrotesk', '400')]}> 
        {title}
        {highlight ? ' ' : ''}
        {highlight ? (
          <Text style={[styles.titleBold, font('SpaceGrotesk', '600')]}> 
            {highlight}
          </Text>
        ) : null}
      </ThemedText>

      {subtitle ? (
        <ThemedText style={[styles.subtitle, font('GlacialIndifference', '400')]}> 
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
  },
  titleBold: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#8f8e8e',
  },
});
