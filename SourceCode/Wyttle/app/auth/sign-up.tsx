import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { Link } from 'expo-router';

export default function SignIn(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [msg,setMsg]=useState<string|null>(null);
  const onSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    setMsg(error?.message ?? null);
  };
  return (
    <View style={{padding:20, gap:12}}>
      <Text>Sign up</Text>
      <TextInput placeholder="Email" autoCapitalize="none" onChangeText={setEmail} />
      <TextInput placeholder="Password" secureTextEntry onChangeText={setPassword} />
      <Button title="Sign up" onPress={onSignUp} />
      {msg && <Text>{msg}</Text>}
      <Link href="/(auth)/sign-in">Sign in</Link>
    </View>
  );
}
