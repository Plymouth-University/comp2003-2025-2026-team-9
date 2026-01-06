import { useSyncExternalStore } from 'react';

export type ThemeOverride = 'light' | 'dark' | null;

let themeOverride: ThemeOverride = null;
let textScale: number = 1.0; // 1.0 = 100%, range 0.8 to 1.2
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

function getTextScaleSnapshot(): number {
  return textScale;
}

export function setThemeOverride(value: ThemeOverride) {
  themeOverride = value;
  listeners.forEach((listener) => listener());
}

export function setTextScale(value: number) {
  textScale = value;
  listeners.forEach((listener) => listener());
}

export function useThemeOverride(): ThemeOverride {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTextScale(): number {
  return useSyncExternalStore(subscribe, getTextScaleSnapshot, getTextScaleSnapshot);
}

// Legacy compatibility
export const setTextSize = setTextScale;
export const useTextSize = useTextScale;
