import React, { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import MenteeBottomNav from '../../../src/components/nav/MenteeBottomNav';
import OnboardingOverlay from '../../../src/components/OnboardingOverlay';
import { MenteeBottomNavHeightProvider, useMenteeBottomNavHeight } from '../../../src/lib/mentee-bottom-nav-height';
import { MENTEE_STEPS, hasSeenOnboarding, markOnboardingSeen } from '../../../src/lib/onboarding';
import { supabase } from '../../../src/lib/supabase';

export default function MenteeLayout() {
  return (
    <MenteeBottomNavHeightProvider>
      <MenteeLayoutContent />
    </MenteeBottomNavHeightProvider>
  );
}

function MenteeLayoutContent() {
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
        <Stack.Screen name="discovery" />
        <Stack.Screen name="mentor-hub" />
        <Stack.Screen name="settings" />
        {/* Other screens (e.g. chat) will also use fade animation */}
      </Stack>
      <MenteeBottomNav onHeightChange={onHeightChange} />
      <OnboardingOverlay
        visible={showOnboarding}
        steps={MENTEE_STEPS}
        onComplete={handleOnboardingComplete}
      />
    </View>
  );
}
