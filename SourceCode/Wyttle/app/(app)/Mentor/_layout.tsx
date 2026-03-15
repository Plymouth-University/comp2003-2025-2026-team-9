import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MentorBottomNav from '../../../src/components/nav/MentorBottomNav';
import OnboardingOverlay from '../../../src/components/OnboardingOverlay';
import { MENTOR_STEPS, hasSeenOnboarding, markOnboardingSeen } from '../../../src/lib/onboarding';
import { supabase } from '../../../src/lib/supabase';
import { MenteeBottomNavHeightProvider, useMenteeBottomNavHeight } from '../../../src/lib/mentee-bottom-nav-height';

export default function MentorLayout() {
  return (
    <MenteeBottomNavHeightProvider>
      <MentorLayoutContent />
    </MenteeBottomNavHeightProvider>
  );
}

function MentorLayoutContent() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { onHeightChange } = useMenteeBottomNavHeight();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const seen = await hasSeenOnboarding(user.id);
      if (!seen) setShowOnboarding(true);
    })();
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    if (userId) await markOnboardingSeen(userId);
  }, [userId]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {/* Main tab screens: fade between tabs for a softer change */}
        <Stack.Screen name="connections" />
        <Stack.Screen name="waiting-room" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="settings" />
        {/* Other screens (e.g. chat) will also use fade animation */}
      </Stack>
      <MentorBottomNav onHeightChange={onHeightChange} />
      <OnboardingOverlay
        visible={showOnboarding}
        steps={MENTOR_STEPS}
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
}
