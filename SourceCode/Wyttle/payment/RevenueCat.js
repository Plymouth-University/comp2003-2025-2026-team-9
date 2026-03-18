import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

function getRevenueCatApiKey() {
  const extra = Constants.expoConfig?.extra ?? {};
  const iosApiKey = extra.revenueCatIosApiKey;
  const androidApiKey = extra.revenueCatAndroidApiKey;

  if (Platform.OS === 'ios') return iosApiKey;
  if (Platform.OS === 'android') return androidApiKey;
  return null;
}

export default function initializeRevenueCat() {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    console.error('RevenueCat API key is missing from Expo config extra for the current platform.');
    return;
  }

  Purchases.configure({ apiKey });
}
