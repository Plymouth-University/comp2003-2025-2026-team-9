import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type HeightCallback = ((height: number) => void) | undefined;

type MenteeBottomNavHeightContextValue = {
  onHeightChange?: (height: number) => void;
  registerOnHeightChange: (callback: HeightCallback) => void;
};

const MenteeBottomNavHeightContext = createContext<MenteeBottomNavHeightContextValue | undefined>(
  undefined,
);

export function MenteeBottomNavHeightProvider({ children }: { children: React.ReactNode }) {
  const [onHeightChange, setOnHeightChange] = useState<HeightCallback>(undefined);

  const registerOnHeightChange = useCallback((callback: HeightCallback) => {
    setOnHeightChange(() => callback);
  }, []);

  const value = useMemo(
    () => ({
      onHeightChange,
      registerOnHeightChange,
    }),
    [onHeightChange, registerOnHeightChange],
  );

  return (
    <MenteeBottomNavHeightContext.Provider value={value}>
      {children}
    </MenteeBottomNavHeightContext.Provider>
  );
}

export function useMenteeBottomNavHeight() {
  const context = useContext(MenteeBottomNavHeightContext);
  if (!context) {
    throw new Error('useMenteeBottomNavHeight must be used within MenteeBottomNavHeightProvider');
  }
  return context;
}
