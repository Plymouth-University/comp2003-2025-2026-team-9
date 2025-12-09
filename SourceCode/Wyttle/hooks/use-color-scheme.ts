import { useColorScheme as _useColorScheme } from 'react-native';
import { useThemeOverride } from './theme-store';

// App-wide theme hook that prefers a user override when set, otherwise
// falls back to the system color scheme. In development, default to
// light unless an explicit override is chosen.
export function useColorScheme(): 'light' | 'dark' | null {
  const systemScheme = _useColorScheme();
  const override = useThemeOverride();

  if (override) return override;

  if (__DEV__) {
    return 'light';
  }
  return systemScheme;
}
