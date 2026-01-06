import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTextScale } from '@/hooks/theme-store';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const textScale = useTextScale();

  // Extract fontSize from style prop if it exists
  const styleArray = Array.isArray(style) ? style : [style];
  let existingFontSize: number | undefined;
  
  for (const s of styleArray) {
    if (s && typeof s === 'object' && 'fontSize' in s) {
      existingFontSize = s.fontSize as number;
    }
  }

  // If there's an existing fontSize, scale it; otherwise use type-based defaults
  const baseFontSize = existingFontSize ?? (() => {
    switch (type) {
      case 'title':
        return 32;
      case 'subtitle':
        return 20;
      default:
        return 16;
    }
  })();

  const scaledFontSize = baseFontSize * textScale;

  return (
    <Text
      style={[
        { color },
        type === 'default' ? styles.default : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? styles.link : undefined,
        style,
        { fontSize: scaledFontSize },
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    lineHeight: 24,
  },
  defaultSemiBold: {
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontWeight: 'bold',
    lineHeight: 32,
  },
  subtitle: {
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    color: '#0a7ea4',
  },
});
