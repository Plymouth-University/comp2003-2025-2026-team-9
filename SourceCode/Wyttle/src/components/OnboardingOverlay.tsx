import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { font } from '../lib/fonts';
import type { OnboardingStep } from '../lib/onboarding';
import { uploadProfilePhoto } from '../lib/supabase';
import { NavBlankShape } from './nav/NavBlankShape';

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  steps: OnboardingStep[];
  onComplete: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingOverlay({ visible, steps, onComplete }: Props) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const [currentStep, setCurrentStep] = useState(0);

  const bottomInset = insets.bottom > 0 ? insets.bottom : 0;
  const bottomFillHeight = bottomInset;

  // Photo picker state
  const [pickedPhotoUri, setPickedPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setCurrentStep((prev) => prev + 1);
  }, [isLast, onComplete]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // ── Photo picker action ──────────────────────────────────────────────────

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    const uri = result.assets[0].uri;
    setPickedPhotoUri(uri);

    // Upload immediately
    try {
      setUploadingPhoto(true);
      await uploadProfilePhoto(uri);
      setPhotoUploaded(true);
    } catch (e) {
      console.warn('Failed to upload photo during onboarding', e);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!step) return null;

  const overlayBg = isDark ? 'rgba(5,7,11,1)' : 'rgba(255,255,255,1)';
  const dotActiveColor = isDark ? '#9da8ff' : '#333f5c';
  const dotInactiveColor = isDark ? '#2a2f40' : '#d1d1d6';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: overlayBg }]}>
                {/* Decorative nav + safe area fill */}
        <View style={styles.bottomDecoration} pointerEvents="none">
          <NavBlankShape
            width={Dimensions.get('window').width}
            showCenter={true}
            color={isDark ? '#20263a' : '#d9deea'}
          />
          <View
            style={[
              styles.bottomFill,
              {
                height: bottomFillHeight + 2,
                backgroundColor: isDark ? '#20263a' : '#d9deea',
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
          {/* Skip button */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={[styles.skipText, { color: isDark ? '#9da8ff' : '#968c6c' }]}>
              Skip
            </Text>
          </TouchableOpacity>

          {/* Step indicator dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <AnimatedDot
                key={i}
                isActive={i === currentStep}
                activeColor={dotActiveColor}
                inactiveColor={dotInactiveColor}
              />
            ))}
          </View>

          {/* Animated step content */}
          <Animated.View
            key={currentStep}
            entering={FadeIn.duration(250)}
            exiting={FadeOut.duration(150)}
            style={styles.stepContent}
          >
            {/* Icon */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: isDark ? '#1b1f33' : '#f2f3f7' },
              ]}
            >
              <Ionicons
                name={step.icon as any}
                size={48}
                color={isDark ? '#9da8ff' : '#333f5c'}
              />
            </View>

            {/* Title */}
            <Text
              style={[
                styles.title,
                font('GlacialIndifference', '800'),
                { color: theme.text },
              ]}
            >
              {step.title}
            </Text>

            {/* Description */}
            <Text
              style={[
                styles.description,
                font('GlacialIndifference', '400'),
                { color: isDark ? '#c8cbdd' : '#555' },
              ]}
            >
              {step.description}
            </Text>

            {/* Action: photo picker */}
            {step.type === 'action' && step.actionId === 'pick_photo' && (
              <View style={styles.actionArea}>
                {pickedPhotoUri ? (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: pickedPhotoUri }} style={styles.photoPreview} />
                    <Text
                      style={[
                        styles.photoStatus,
                        font('GlacialIndifference', '400'),
                        { color: photoUploaded ? '#34c759' : theme.text },
                      ]}
                    >
                      {uploadingPhoto
                        ? 'Uploading…'
                        : photoUploaded
                          ? 'Photo saved!'
                          : 'Ready'}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: isDark ? '#333f5c' : '#333f5c' },
                    ]}
                    onPress={handlePickPhoto}
                  >
                    <Ionicons name="image-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Choose a photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {!isFirst ? (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Ionicons
                  name="arrow-back"
                  size={20}
                  color={isDark ? '#c8cbdd' : '#555'}
                />
                <Text
                  style={[
                    styles.backText,
                    font('GlacialIndifference', '400'),
                    { color: isDark ? '#c8cbdd' : '#555' },
                  ]}
                >
                  Back
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.placeholder} />
            )}

            <TouchableOpacity
              style={[
                styles.nextButton,
                { backgroundColor: isDark ? '#9da8ff' : '#333f5c' },
              ]}
              onPress={handleNext}
            >
              <Text
                style={[
                  styles.nextText,
                  font('GlacialIndifference', '800'),
                  { color: isDark ? '#05070b' : '#fff' },
                ]}
              >
                {isLast ? 'Get Started' : 'Next'}
              </Text>
              {!isLast && (
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={isDark ? '#05070b' : '#fff'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Animated Dot Component ──────────────────────────────────────────────────

type DotProps = {
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
};

function AnimatedDot({ isActive, activeColor, inactiveColor }: DotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(isActive ? 24 : 8, {
        damping: 15,
        stiffness: 150,
      }),
      backgroundColor: withSpring(isActive ? activeColor : inactiveColor, {
        damping: 20,
        stiffness: 100,
      }) as any,
    };
  }, [isActive, activeColor, inactiveColor]);

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  decorativeNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  actionArea: {
    marginTop: 28,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreviewRow: {
    alignItems: 'center',
    gap: 10,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  photoStatus: {
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
  },
  placeholder: {
    width: 60,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  nextText: {
    fontSize: 16,
  },
  bottomDecoration: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -85,
  },
  bottomFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
  },
});
