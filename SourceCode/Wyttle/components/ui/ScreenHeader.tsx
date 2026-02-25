import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { font } from '../../src/lib/fonts';
import { Logo } from '@/components/Logo';

export type ScreenHeaderProps = {
  title: string;
  /** Optional word to highlight at the end of the title, e.g. "Hub" in "Mentor Hub" */
  highlight?: string;
  subtitle?: string;
  /** align header text; top-level tabs often want 'left', some screens 'center' */
  align?: 'left' | 'center';
  /** Render the app logo to the left of the title. Defaults to true. */
  logo?: boolean;
  /** Optional base logo size in px */
  logoSize?: number;
  /** Whether the logo should scale with the system text-size (fontScale). Defaults to true. */
  scaleLogoWithText?: boolean;
};

export function ScreenHeader({
  title,
  highlight,
  subtitle,
  align = 'left',
  logo = true,
  logoSize = 36,
  scaleLogoWithText = true,
}: ScreenHeaderProps) {
  const { fontScale } = useWindowDimensions();
  const effectiveLogoSize = Math.max(12, Math.round(logoSize * (scaleLogoWithText ? fontScale : 1)));

  const alignItems = align === 'center' ? 'center' : 'flex-start';

  return (
    <View style={[styles.header, { alignItems }]}>
      {logo ? (
        <View style={styles.row}>
          <Logo size={effectiveLogoSize} style={styles.logo} />
          <ThemedText style={[styles.title, font('SpaceGrotesk', '400')]}> 
            {title}
            {highlight ? ' ' : ''}
            {highlight ? (
              <Text style={[styles.titleBold, font('SpaceGrotesk', '600')]}> 
                {highlight}
              </Text>
            ) : null}
          </ThemedText>
        </View>
      ) : (
        <ThemedText style={[styles.title, font('SpaceGrotesk', '400')]}> 
          {title}
          {highlight ? ' ' : ''}
          {highlight ? (
            <Text style={[styles.titleBold, font('SpaceGrotesk', '600')]}> 
              {highlight}
            </Text>
          ) : null}
        </ThemedText>
      )}

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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    marginRight: 12,
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
