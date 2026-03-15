import { Audio } from 'expo-av';
import { Platform } from 'react-native';

let audioConfigured = false;

async function ensureAudioMode() {
  if (audioConfigured || Platform.OS === 'web') return;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });

  audioConfigured = true;
}

export async function playMessageSound() {
  if (Platform.OS === 'web') return;

  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/message.mp3'),
      { shouldPlay: true },
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (!status.didJustFinish) return;
      sound.unloadAsync().catch(() => {});
    });
  } catch (error) {
    console.warn('Failed to play message sound', error);
  }
}
