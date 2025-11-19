import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ToastVariant = 'error' | 'success' | 'info';

export type ToastProps = {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  duration?: number; // ms
  variant?: ToastVariant;
};

/**
 * Reusable, animated toast that appears at the bottom of the screen.
 * - Fades/slides in when `visible` becomes true.
 * - Auto-dismisses after `duration` ms.
 * - Can be dismissed immediately by tapping.
 */
export function Toast({
  visible,
  message,
  onDismiss,
  duration = 4000,
  variant = 'error',
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    let timeout: NodeJS.Timeout | undefined;

    if (visible && message) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration) {
        timeout = setTimeout(() => handleDismiss(), duration);
      }
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [visible, message]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDismiss();
      }
    });
  };

  if (!message) return null;

  const backgroundColor =
    variant === 'success'
      ? 'rgba(0, 140, 60, 0.95)'
      : variant === 'info'
        ? 'rgba(0, 80, 140, 0.95)'
        : 'rgba(200, 0, 0, 0.95)';

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          bottom: (insets.bottom || 16) + 16,
          backgroundColor,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable onPress={handleDismiss} style={styles.pressable}>
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 999,
  },
  pressable: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
