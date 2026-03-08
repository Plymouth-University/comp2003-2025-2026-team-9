import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';

export default function initializeRevenueCat() {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

  // Platform-specific API keys (prefixed with EXPO_PUBLIC_ in .env)
  //const iosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  //const androidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

  const iosApiKey = appl_yHKdhPpSapIfDmCxttrlDNqMJcE;
  const androidApiKey = goog_djydSEqGgwdevzrJyAlnHTZPPdy;

  if (Platform.OS === 'ios') {
    Purchases.configure({ apiKey: iosApiKey });
  } else if (Platform.OS === 'android') {
    Purchases.configure({ apiKey: androidApiKey });
  } else {
    console.error('RevenueCat API key is missing for the current platform.');
  }
}