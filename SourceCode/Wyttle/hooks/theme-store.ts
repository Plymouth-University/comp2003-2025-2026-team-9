import { useSyncExternalStore } from 'react';

export type ThemeOverride = 'light' | 'dark' | null;

let themeOverride: ThemeOverride = null;
let textSize: number = 16;
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

function getTextSizeSnapshot(): number {
  return textSize;
}

export function setThemeOverride(value: ThemeOverride) {
  themeOverride = value;
  listeners.forEach((listener) => listener());
}

export function setTextSize(value: number) {
  textSize = value;
  listeners.forEach((listener) => listener());
}

export function useThemeOverride(): ThemeOverride {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTextSize(): number {
  return useSyncExternalStore(subscribe, getTextSizeSnapshot, getTextSizeSnapshot);
}
