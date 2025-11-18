import { useEffect, useState } from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function Discovery(){
  const [rows,setRows]=useState<any[]>([]);
  const [me,setMe]=useState<string>('');
  useEffect(() => { (async () => {
    const { data:{ user } } = await supabase.auth.getUser(); if (!user) return; setMe(user.id);
    const { data } = await supabase.from('profiles')
      .select('id, full_name, title, industry').neq('id', user.id);
    setRows(data ?? []);
  })(); }, []);
  const send = async (receiver:string) =>
    supabase.from('handshakes').insert({ sender: me, receiver, comment: 'Hi!' });
  return (
    <FlatList data={rows} keyExtractor={(r)=>r.id}
      renderItem={({item}) => (
        <View style={{padding:12, borderBottomWidth:1}}>
          <Text>{item.full_name} — {item.title}</Text>
          <Button title="Handshake" onPress={() => send(item.id)} />
        </View>
      )}/>
  );
}
