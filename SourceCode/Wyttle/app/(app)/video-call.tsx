import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completeSession } from '../../src/lib/sessions';

export default function VideoCallScreen() {
  const params = useLocalSearchParams<{ roomUrl?: string; requestId?: string }>();
  const roomUrl = typeof params.roomUrl === 'string' ? params.roomUrl : null;
  const requestId = params.requestId ? Number(params.requestId) : null;

  const [opened, setOpened] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleOpenCall = async () => {
    if (!roomUrl) return;
    try {
      await Linking.openURL(roomUrl);
      setOpened(true);
    } catch (err) {
      Alert.alert('Error', 'Could not open the video call link.');
    }
  };

  const handleEndCall = async () => {
    if (ending) return;
    setEnding(true);

    if (requestId) {
      try {
        await completeSession(requestId);
      } catch (err) {
        console.error('Failed to complete session', err);
      }
    }

    Alert.alert('Call Ended', 'The session has been marked as complete.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (!roomUrl) {
    return (
      <View style={styles.container}>
        <Ionicons name="videocam-off" size={64} color="#555" />
        <Text style={styles.infoText}>No video call link available.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>? Back</Text>
      </Pressable>

      <View style={styles.content}>
        <Ionicons name="videocam" size={72} color="#333f5c" />
        <Text style={styles.title}>Video Call</Text>
        <Text style={styles.infoText}>
          {opened
            ? 'Your call has been opened in the browser.\nReturn here when you are finished.'
            : 'Tap below to join the video call in your browser.'}
        </Text>

        <Pressable style={styles.joinBtn} onPress={handleOpenCall}>
          <Ionicons name="open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.joinBtnText}>{opened ? 'Rejoin Call' : 'Join Call'}</Text>
        </Pressable>

        {opened && (
          <Pressable
            style={[styles.endBtn, ending && { opacity: 0.5 }]}
            onPress={handleEndCall}
            disabled={ending}
          >
            <Ionicons
              name="call"
              size={20}
              color="#fff"
              style={{ marginRight: 8, transform: [{ rotate: '135deg' }] }}
            />
            <Text style={styles.endBtnText}>End Call</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333f5c',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333f5c',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 8,
  },
  joinBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c43b3b',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 4,
  },
  endBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#333f5c',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
  },
  backLinkText: {
    fontSize: 16,
    color: '#333f5c',
    fontWeight: '600',
  },
});
