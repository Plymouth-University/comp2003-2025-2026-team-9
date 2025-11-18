import { useColorScheme as _useColorScheme } from 'react-native';

// In development, force light mode so styling is consistent
export function useColorScheme(): 'light' | 'dark' | null {
  if (__DEV__) {
    return 'light';
  }
  return _useColorScheme();
}
