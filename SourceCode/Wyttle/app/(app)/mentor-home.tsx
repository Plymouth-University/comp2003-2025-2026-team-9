import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';

import { supabase } from '../../src/lib/supabase';

export default function MentorsHome() {
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      setName(data?.full_name ?? '');
    })();
  }, []);

  return (
    <View style={{ padding: 20, gap: 12, marginTop: 50 }}>
      <Text>Welcome mentor {name || 'there'} 👋</Text>
      <Button title="Go to mentee home" onPress={() => router.push('/(app)/mentee-home')} />
    </View>
  );
}
