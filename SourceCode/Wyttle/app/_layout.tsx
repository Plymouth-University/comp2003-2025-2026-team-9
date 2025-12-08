import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NavigationHistoryProvider } from '../src/lib/navigation-history';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [fontsLoaded] = useFonts({
    'Montserrat-Light': require('@/assets/fonts/Montserrat/static/Montserrat-Light.ttf'),
    'Montserrat-LightItalic': require('@/assets/fonts/Montserrat/static/Montserrat-LightItalic.ttf'),
    'Montserrat-Regular': require('@/assets/fonts/Montserrat/static/Montserrat-Regular.ttf'),
    'Montserrat-Italic': require('@/assets/fonts/Montserrat/static/Montserrat-Italic.ttf'),
    'Montserrat-Medium': require('@/assets/fonts/Montserrat/static/Montserrat-Medium.ttf'),
    'Montserrat-MediumItalic': require('@/assets/fonts/Montserrat/static/Montserrat-MediumItalic.ttf'),
    'Montserrat-SemiBold': require('@/assets/fonts/Montserrat/static/Montserrat-SemiBold.ttf'),
    'Montserrat-SemiBoldItalic': require('@/assets/fonts/Montserrat/static/Montserrat-SemiBoldItalic.ttf'),
    'Montserrat-Bold': require('@/assets/fonts/Montserrat/static/Montserrat-Bold.ttf'),
    'Montserrat-BoldItalic': require('@/assets/fonts/Montserrat/static/Montserrat-BoldItalic.ttf'),

    'SpaceGrotesk-Light': require('@/assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Light.otf'),
    'SpaceGrotesk-Regular': require('@/assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Regular.otf'),
    'SpaceGrotesk-Medium': require('@/assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Medium.otf'),
    'SpaceGrotesk-SemiBold': require('@/assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-SemiBold.otf'),
'SpaceGrotesk-Bold': require('@/assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Bold.otf'),

    'Verdana': require('@/assets/fonts/Verdana/Verdana.ttf'),
    'Verdana-Italic': require('@/assets/fonts/Verdana/Verdana-Italic.ttf'),
    'Verdana-Bold': require('@/assets/fonts/Verdana/Verdana-Bold.ttf'),
    'Verdana-BoldItalic': require('@/assets/fonts/Verdana/Verdana-BoldItalic.ttf'),

    // Glacial Indifference
    'GlacialIndifference-Regular': require('@/assets/fonts/glacial-indifference/GlacialIndifference-Regular.otf'),
    'GlacialIndifference-Bold': require('@/assets/fonts/glacial-indifference/GlacialIndifference-Bold.otf'),
  });

  if (!fontsLoaded) return null;

  return (
    <NavigationHistoryProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            // Global transition animation between screens
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              animation: 'fade_from_bottom',
              title: 'Modal',
            }}
          />
        </Stack>
        <StatusBar
          style={colorScheme === 'dark' ? 'light' : 'dark'}
          backgroundColor={theme.background}
        />
      </ThemeProvider>
    </NavigationHistoryProvider>
  );
}
