import { useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { router } from 'expo-router';

export default function Index(){
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/(app)/home' : '/(auth)/sign-in');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      router.replace(s ? '/(app)/home' : '/(auth)/sign-in');
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
