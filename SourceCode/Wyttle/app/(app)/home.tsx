import { useEffect, useState } from 'react';
import { View, Text, Button } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { router } from 'expo-router';

export default function Home(){
  const [name,setName]=useState('');
  useEffect(() => { (async () => {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    setName(data?.full_name ?? '');
  })(); }, []);
  return (
    <View style={{ padding:20, gap:12 }}>
      <Text>Welcome {name || 'there'} 👋</Text>
      <Button title="Discovery" onPress={() => router.push('/(app)/discovery')} />
      <Button title="Mentor Hub" onPress={() => router.push('/(app)/mentors')} />
    </View>
  );
}
