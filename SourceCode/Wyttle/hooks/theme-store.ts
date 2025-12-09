import { useSyncExternalStore } from 'react';

export type ThemeOverride = 'light' | 'dark' | null;

let themeOverride: ThemeOverride = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeOverride {
  return themeOverride;
}

export function setThemeOverride(value: ThemeOverride) {
  themeOverride = value;
  listeners.forEach((listener) => listener());
}

export function useThemeOverride(): ThemeOverride {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
