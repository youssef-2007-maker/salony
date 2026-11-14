// Dynamic Expo config. Reads SALONY_API_URL from the build environment so
// production builds point at the hosted backend instead of localhost.
//
// Local dev:                          leaves the default localhost URL
// `eas build --profile production`:   pulls env from eas.json → production.env
//
// Anything user-visible (icon, splash, name, bundle ID, store URLs) lives in
// this file — eas.json only carries build/submit secrets and env vars.

module.exports = ({ config }) => ({
  ...config,
  expo: {
    name: 'Salony',
    slug: 'salony',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'salony',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#651331',
    },
    assetBundlePatterns: ['**/*'],

    // Required for OTA updates via EAS Update. Safe to leave even if you
    // don't ship OTA — the runtime defaults to the bundled JS.
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: process.env.EAS_UPDATE_URL || undefined,
      fallbackToCacheTimeout: 0,
    },

    ios: {
      supportsTablet: true,
      // CHANGE BEFORE SUBMISSION: must be a bundle ID you own / have registered
      // with Apple. com.salony.app is a placeholder.
      bundleIdentifier: process.env.SALONY_IOS_BUNDLE_ID || 'com.salony.app',
      buildNumber: '1',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Salony uses your location to recommend nearby salons and barbers.',
        NSCameraUsageDescription:
          'Salony uses your camera to take a selfie for the AI hairstyle try-on and to attach photos to reviews.',
        NSPhotoLibraryUsageDescription:
          'Salony uses your photo library to attach a selfie to the AI hairstyle try-on and to upload review photos.',
        NSPhotoLibraryAddUsageDescription:
          'Salony saves your generated hairstyle previews to your photo library when you tap Save.',
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#651331',
      },
      package: process.env.SALONY_ANDROID_PACKAGE || 'com.salony.app',
      versionCode: 1,
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'READ_MEDIA_IMAGES',
      ],
    },

    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },

    plugins: [
      'expo-font',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Salony uses your location to recommend nearby salons and barbers.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Salony needs access to your photos to upload a selfie for AI hairstyle previews and to attach photos to reviews.',
          cameraPermission:
            'Salony needs access to your camera to take a selfie for AI hairstyle previews.',
        },
      ],
    ],

    extra: {
      apiUrl: process.env.SALONY_API_URL || 'http://localhost:4000',
      env: process.env.SALONY_ENV || 'development',

      // Store-listing URLs surfaced inside the app (settings, about pages).
      // These get linked from the store listing too, so the URLs in eas.json /
      // app.config.js / store metadata must all match what's actually live.
      privacyPolicyUrl: process.env.SALONY_PRIVACY_URL || 'https://salony.app/privacy',
      termsUrl: process.env.SALONY_TERMS_URL || 'https://salony.app/terms',
      supportUrl: process.env.SALONY_SUPPORT_URL || 'https://salony.app/support',
      supportEmail: process.env.SALONY_SUPPORT_EMAIL || 'support@salony.app',

      // Fill via `eas init` — this binds the local repo to an EAS project.
      eas: { projectId: process.env.EAS_PROJECT_ID || '' },
    },
  },
});
