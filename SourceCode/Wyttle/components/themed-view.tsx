import { View, type ViewProps } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

/**
 * Simple themed wrapper around React Native's View.
 *
 * Usage:
 *   <ThemedView style={...}>
 *     ...
 *   </ThemedView>
 */
export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...rest
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <View style={[{ backgroundColor }, style]} {...rest} />;
}
