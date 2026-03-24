import React, { useEffect } from 'react';

import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


import { useNavigationHistory } from '../../src/lib/navigation-history';
import { supabase } from '../../src/lib/supabase';
import { commonStyles } from '../../src/styles/common';


export default function Profile() {
  const { history, resetHistory } = useNavigationHistory();

  // If viewing "my profile" (this screen), redirect to the profile-view.tsx
  // so the layout and chips logic are shared. Uses router.replace to avoid adding history
  useEffect(() => {
    const redirectToMyProfile = async () => {
      try {
        const res = await supabase.auth.getUser();
        const user = (res as any)?.data?.user ?? null;
        if (user?.id) {
          const previousAppRoute = [...history]
            .reverse()
            .find((route) => route !== '/(app)/profile' && route.startsWith('/(app)/'));

          const routeFromContext = previousAppRoute?.includes('/Mentor/')
            ? '/(app)/Mentor/profile-view'
            : previousAppRoute?.includes('/Mentee/')
              ? '/(app)/Mentee/profile-view'
              : null;

          if (routeFromContext) {
            router.replace({
              pathname: routeFromContext as any,
              params: { userId: user.id },
            });
            return;
          }

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .maybeSingle();

            const roleRaw = (profile as any)?.role ?? '';
            const roleNormalised = typeof roleRaw === 'string' && 
              roleRaw.toLocaleLowerCase().startsWith('mentor') ? 'Mentor' : 'Mentee';


            router.replace({
              pathname: `/${roleNormalised}/profile-view`,
              params: {userId: user.id},
            });

          } catch {

            router.replace({
              pathname: '/(app)/Mentee/profile-view',
              params: { userId: user.id },
            });

          }

        }
      } catch (err) {
        // ignore redirect errors for now
        console.warn('Profile redirect skipped', err);
      }
    };

    // run once
    redirectToMyProfile();
  }, [history]);

  const onLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore logout errors for now; navigation is enough for testing
    }

    resetHistory('/');
    router.replace({ pathname: '/', params: { from: 'logout' } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...commonStyles.screen,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  logoutButton: {
    ...commonStyles.primaryButton,
  },
  logoutText: {
    ...commonStyles.primaryButtonText,
  },
});
