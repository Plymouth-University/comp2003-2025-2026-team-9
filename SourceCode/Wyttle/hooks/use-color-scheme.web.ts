import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeOverride } from './theme-store';

/**
 * Web variant of useColorScheme that still respects the global theme
 * override, and only falls back to the RN color scheme after hydration.
 */
export function useColorScheme(): 'light' | 'dark' | null {
  const [hasHydrated, setHasHydrated] = useState(false);
  const override = useThemeOverride();
  const colorScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Always call all hooks above; only branch in returns below.
  if (override) {
    return override;
  }

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
