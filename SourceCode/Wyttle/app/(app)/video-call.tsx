import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { completeSession } from '../../src/lib/sessions';

// Daily SDK is loaded lazily to avoid crashing on app startup —
// the native WebRTC module initialises immediately on import which
// fails when the screen hasn't been navigated to yet.
let Daily: any = null;
let DailyMediaView: any = null;

const SESSION_DURATION_SEC = 30 * 60; // 30 minutes

export default function VideoCallScreen() {
  const params = useLocalSearchParams<{ roomUrl?: string; requestId?: string }>();
  const roomUrl = typeof params.roomUrl === 'string' ? params.roomUrl : null;
  const requestId = params.requestId ? Number(params.requestId) : null;

  const callObjectRef = useRef<any>(null);
  const [joined, setJoined] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_DURATION_SEC);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  // ── Lazy-load Daily SDK ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = require('@daily-co/react-native-daily-js');
        Daily = mod.default ?? mod;
        DailyMediaView = mod.DailyMediaView;
        if (mounted) setSdkReady(true);
      } catch (err: any) {
        console.error('Failed to load Daily SDK', err);
        if (mounted) setError('Video calling is not available on this device');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Join the room ──
  useEffect(() => {
    if (!sdkReady || !roomUrl || !Daily) return;

    let callObject: any;
    const join = async () => {
      try {
        callObject = Daily.createCallObject();
        callObjectRef.current = callObject;

        callObject.on('participant-joined', () => {
          updateTracks(callObject);
        });
        callObject.on('participant-updated', () => {
          updateTracks(callObject);
        });
        callObject.on('participant-left', () => {
          updateTracks(callObject);
        });
        callObject.on('error', (ev: any) => {
          console.error('Daily error', ev);
          setError('Call error occurred');
        });

        await callObject.join({ url: roomUrl });
        setJoined(true);
        updateTracks(callObject);
      } catch (err: any) {
        console.error('Failed to join Daily room', err);
        setError(err.message ?? 'Failed to join call');
      }
    };

    join();

    return () => {
      if (callObject) {
        callObject.leave().catch(() => {});
        callObject.destroy();
      }
    };
  }, [sdkReady, roomUrl]);

  // ── Extract local + remote tracks ──
  const updateTracks = useCallback((co: any) => {
    const participants = co.participants();
    const local = participants?.local;
    if (local?.tracks?.video?.persistentTrack) {
      setLocalVideoTrack(local.tracks.video.persistentTrack);
    }

    const remoteKey = Object.keys(participants).find((k) => k !== 'local');
    if (remoteKey) {
      const remote = participants[remoteKey];
      if (remote?.tracks?.video?.persistentTrack) {
        setRemoteVideoTrack(remote.tracks.video.persistentTrack);
      }
      if (remote?.tracks?.audio?.persistentTrack) {
        setRemoteAudioTrack(remote.tracks.audio.persistentTrack);
      }
    } else {
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
    }
  }, []);

  // ── Countdown timer ──
  useEffect(() => {
    if (!joined) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          handleEndCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [joined]);

  // ── Controls ──
  const toggleMic = () => {
    const co = callObjectRef.current;
    if (!co) return;
    co.setLocalAudio(!micOn);
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    const co = callObjectRef.current;
    if (!co) return;
    co.setLocalVideo(!camOn);
    setCamOn(!camOn);
  };

  const handleEndCall = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    const co = callObjectRef.current;
    if (co) {
      try { await co.leave(); } catch {}
      co.destroy();
      callObjectRef.current = null;
    }

    if (requestId) {
      try {
        await completeSession(requestId);
      } catch (err) {
        console.error('Failed to complete session', err);
      }
    }

    Alert.alert('Call Ended', 'The session has ended.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [requestId]);

  // ── Format timer ──
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const timerUrgent = secondsLeft < 300;

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!sdkReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.remotePlaceholderText}>Loading video...</Text>
      </View>
    );
  }

  // Render DailyMediaView only if the component was loaded
  const MediaView = DailyMediaView;

  return (
    <View style={styles.container}>
      {/* Remote video (full screen) */}
      <View style={styles.remoteContainer}>
        {remoteVideoTrack && MediaView ? (
          <MediaView
            videoTrack={remoteVideoTrack}
            audioTrack={remoteAudioTrack}
            mirror={false}
            zOrder={0}
            style={styles.remoteVideo}
          />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Ionicons name="person-outline" size={64} color="#555" />
            <Text style={styles.remotePlaceholderText}>
              {joined ? 'Waiting for other participant...' : 'Connecting...'}
            </Text>
          </View>
        )}
      </View>

      {/* Local video (picture-in-picture) */}
      <View style={styles.localContainer}>
        {localVideoTrack && camOn && MediaView ? (
          <MediaView
            videoTrack={localVideoTrack}
            audioTrack={null}
            mirror={true}
            zOrder={1}
            style={styles.localVideo}
          />
        ) : (
          <View style={styles.localPlaceholder}>
            <Ionicons name="videocam-off" size={24} color="#999" />
          </View>
        )}
      </View>

      {/* Timer */}
      <View style={[styles.timerContainer, timerUrgent && styles.timerUrgent]}>
        <Text style={[styles.timerText, timerUrgent && styles.timerTextUrgent]}>
          {timerText}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, !micOn && styles.controlBtnOff]}
          onPress={toggleMic}
        >
          <Ionicons name={micOn ? 'mic' : 'mic-off'} size={24} color="#fff" />
        </Pressable>

        <Pressable
          style={[styles.controlBtn, !camOn && styles.controlBtnOff]}
          onPress={toggleCam}
        >
          <Ionicons name={camOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
        </Pressable>

        <Pressable style={styles.endCallBtn} onPress={handleEndCall}>
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteContainer: {
    flex: 1,
  },
  remoteVideo: {
    flex: 1,
  },
  remotePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  remotePlaceholderText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  localContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
  },
  localVideo: {
    flex: 1,
  },
  localPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  timerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  timerUrgent: {
    backgroundColor: 'rgba(196,59,59,0.8)',
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: {
    color: '#fff',
  },
  controls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#333f5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnOff: {
    backgroundColor: '#555',
  },
  endCallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#c43b3b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#c43b3b',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
  backBtn: {
    alignSelf: 'center',
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
});
