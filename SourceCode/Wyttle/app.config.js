import 'dotenv/config';

const getEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export default {
  expo: {
    name: 'Wyttle',
    slug: 'Wyttle',
    version: '1.0.7',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'wyttle',
    extra: {
      supabaseUrl: getEnv('EXPO_PUBLIC_SUPABASE_URL'),
      supabaseAnonKey: getEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
      dailyApiKey: getEnv('DAILY_API_KEY'),
      revenueCatIosApiKey: getEnv('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'),
      revenueCatAndroidApiKey: getEnv('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY'),
      router: {},
      eas: {
        projectId: 'f1d6f35c-7be5-4c01-b141-78978c028ed7',
      },
    },
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      buildNumber: '27',
      bundleIdentifier: 'com.wyttle.wyttleapp',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.wyttle.wyttleapp',
      versionCode: 27,
      permissions: [
        'com.android.vending.BILLING',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Wyttle uses your photo library so you can choose and upload a profile photo.',
          cameraPermission: 'Wyttle uses your camera so you can take and upload a profile photo.',
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/Montserrat/Montserrat-Italic-VariableFont_wght.ttf',
            './assets/fonts/Montserrat/Montserrat-VariableFont_wght.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Black.ttf',
            './assets/fonts/Montserrat/static/Montserrat-BlackItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Bold.ttf',
            './assets/fonts/Montserrat/static/Montserrat-BoldItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-ExtraBold.ttf',
            './assets/fonts/Montserrat/static/Montserrat-ExtraBoldItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-ExtraLight.ttf',
            './assets/fonts/Montserrat/static/Montserrat-ExtraLightItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Italic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Light.ttf',
            './assets/fonts/Montserrat/static/Montserrat-LightItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Medium.ttf',
            './assets/fonts/Montserrat/static/Montserrat-MediumItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Regular.ttf',
            './assets/fonts/Montserrat/static/Montserrat-SemiBold.ttf',
            './assets/fonts/Montserrat/static/Montserrat-SemiBoldItalic.ttf',
            './assets/fonts/Montserrat/static/Montserrat-Thin.ttf',
            './assets/fonts/Montserrat/static/Montserrat-ThinItalic.ttf',
            './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Bold.otf',
            './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Light.otf',
            './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Medium.otf',
            './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Regular.otf',
            './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-SemiBold.otf',
            './assets/fonts/Verdana/Verdana-Bold.ttf',
            './assets/fonts/Verdana/Verdana-BoldItalic.ttf',
            './assets/fonts/Verdana/Verdana-Italic.ttf',
            './assets/fonts/Verdana/Verdana.ttf',
          ],
          android: {
            fonts: [
              {
                fontFamily: 'Montserrat',
                fontDefinitions: [
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Thin.ttf',
                    weight: 100,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-ThinItalic.ttf',
                    weight: 100,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-ExtraLight.ttf',
                    weight: 200,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-ExtraLightItalic.ttf',
                    weight: 200,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Light.ttf',
                    weight: 300,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-LightItalic.ttf',
                    weight: 300,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Regular.ttf',
                    weight: 400,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Italic.ttf',
                    weight: 400,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Medium.ttf',
                    weight: 500,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-MediumItalic.ttf',
                    weight: 500,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-SemiBold.ttf',
                    weight: 600,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-SemiBoldItalic.ttf',
                    weight: 600,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Bold.ttf',
                    weight: 700,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-BoldItalic.ttf',
                    weight: 700,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-ExtraBold.ttf',
                    weight: 800,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-ExtraBoldItalic.ttf',
                    weight: 800,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-Black.ttf',
                    weight: 900,
                  },
                  {
                    path: './assets/fonts/Montserrat/static/Montserrat-BlackItalic.ttf',
                    weight: 900,
                    style: 'italic',
                  },
                ],
              },
              {
                fontFamily: 'SpaceGrotesk',
                fontDefinitions: [
                  {
                    path: './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Light.otf',
                    weight: 300,
                  },
                  {
                    path: './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Regular.otf',
                    weight: 400,
                  },
                  {
                    path: './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Medium.otf',
                    weight: 500,
                  },
                  {
                    path: './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-SemiBold.otf',
                    weight: 600,
                  },
                  {
                    path: './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Bold.otf',
                    weight: 700,
                  },
                ],
              },
              {
                fontFamily: 'Verdana',
                fontDefinitions: [
                  {
                    path: './assets/fonts/Verdana/Verdana.ttf',
                    weight: 400,
                  },
                  {
                    path: './assets/fonts/Verdana/Verdana-Italic.ttf',
                    weight: 400,
                    style: 'italic',
                  },
                  {
                    path: './assets/fonts/Verdana/Verdana-Bold.ttf',
                    weight: 700,
                  },
                  {
                    path: './assets/fonts/Verdana/Verdana-BoldItalic.ttf',
                    weight: 700,
                    style: 'italic',
                  },
                ],
              },
            ],
          },
          ios: {
            fonts: [
              './assets/fonts/Montserrat/Montserrat-Italic-VariableFont_wght.ttf',
              './assets/fonts/Montserrat/Montserrat-VariableFont_wght.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Black.ttf',
              './assets/fonts/Montserrat/static/Montserrat-BlackItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Bold.ttf',
              './assets/fonts/Montserrat/static/Montserrat-BoldItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-ExtraBold.ttf',
              './assets/fonts/Montserrat/static/Montserrat-ExtraBoldItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-ExtraLight.ttf',
              './assets/fonts/Montserrat/static/Montserrat-ExtraLightItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Italic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Light.ttf',
              './assets/fonts/Montserrat/static/Montserrat-LightItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Medium.ttf',
              './assets/fonts/Montserrat/static/Montserrat-MediumItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Regular.ttf',
              './assets/fonts/Montserrat/static/Montserrat-SemiBold.ttf',
              './assets/fonts/Montserrat/static/Montserrat-SemiBoldItalic.ttf',
              './assets/fonts/Montserrat/static/Montserrat-Thin.ttf',
              './assets/fonts/Montserrat/static/Montserrat-ThinItalic.ttf',
              './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Bold.otf',
              './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Light.otf',
              './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Medium.otf',
              './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-Regular.otf',
              './assets/fonts/Space-Grotesk-Regular/otf/SpaceGrotesk-SemiBold.otf',
              './assets/fonts/Verdana/Verdana-Bold.ttf',
              './assets/fonts/Verdana/Verdana-BoldItalic.ttf',
              './assets/fonts/Verdana/Verdana-Italic.ttf',
              './assets/fonts/Verdana/Verdana.ttf',
            ],
          },
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Allow Wyttle to access your location while you use the app so you can quickly fill in your profile location and help other members and mentors see where you are based.',
        },
      ],
      'expo-web-browser',
      [
        'expo-notifications',
        {
          defaultChannel: 'default',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    platforms: ['ios', 'android', 'web'],
    androidStatusBar: {
      backgroundColor: '#ffffff',
    },
  },
};
