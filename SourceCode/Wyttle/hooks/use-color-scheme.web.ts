import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeOverride } from './theme-store';

/**
 * Web variant of useColorScheme that still respects the global theme
 * override, and only falls back to the RN color scheme after hydration.
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const override = useThemeOverride();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (override) return override;

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
