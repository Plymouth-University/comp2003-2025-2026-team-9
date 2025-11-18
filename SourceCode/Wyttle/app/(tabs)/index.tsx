import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { font } from '../../src/lib/fonts';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Hi Roman and Josh!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try me</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Custom fonts</ThemedText>

        <ThemedText>Montserrat</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '300')]}>Montserrat Light 300</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '400')]}>Montserrat Regular 400</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '500')]}>Montserrat Medium 500</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '600')]}>Montserrat SemiBold 600</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '700')]}>Montserrat Bold 700</ThemedText>
        <ThemedText style={[styles.fontSample, font('Montserrat', '400', true)]}>Montserrat Italic 400</ThemedText>

        <ThemedText>Space Grotesk</ThemedText>
        <ThemedText style={[styles.fontSample, font('SpaceGrotesk', '300')]}>Space Grotesk Light 300</ThemedText>
        <ThemedText style={[styles.fontSample, font('SpaceGrotesk', '400')]}>Space Grotesk Regular 400</ThemedText>
        <ThemedText style={[styles.fontSample, font('SpaceGrotesk', '500')]}>Space Grotesk Medium 500</ThemedText>
        <ThemedText style={[styles.fontSample, font('SpaceGrotesk', '600')]}>Space Grotesk SemiBold 600</ThemedText>
        <ThemedText style={[styles.fontSample, font('SpaceGrotesk', '700')]}>Space Grotesk Bold 700</ThemedText>

        <ThemedText>Verdana</ThemedText>
        <ThemedText style={[styles.fontSample, font('Verdana', '400')]}>Verdana Regular 400</ThemedText>
        <ThemedText style={[styles.fontSample, font('Verdana', '400', true)]}>Verdana Italic</ThemedText>
        <ThemedText style={[styles.fontSample, font('Verdana', '700')]}>Verdana Bold 700</ThemedText>
        <ThemedText style={[styles.fontSample, font('Verdana', '700', true)]}>Verdana Bold Italic</ThemedText>
      </ThemedView>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  fontSample: {
    fontSize: 18,
    lineHeight: 28,
  },
});
