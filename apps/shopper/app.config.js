/** @type {import('expo/config').ExpoConfig} */
const applyDevConfig = require('../../expo-dev-config');
const applyDeepLinks = require('../../expo-deep-links');
const applyWhiteLabel = require('../../expo-white-label');

module.exports = {
  expo: applyDevConfig(
    applyWhiteLabel(
      applyDeepLinks({
        name: 'Kiosk Ke Shopper',
        slug: 'kiosk-shopper',
        version: '0.0.1',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        splash: {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#28a745',
        },
        assetBundlePatterns: ['**/*'],
        ios: {
          supportsTablet: true,
          bundleIdentifier: 'com.kioskke.shopper',
        },
        android: {
          adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#28a745',
          },
          package: 'com.kioskke.shopper',
        },
        web: {
          favicon: './assets/favicon.png',
        },
        plugins: [
          'expo-secure-store',
          [
            'expo-camera',
            {
              cameraPermission:
                'Allow Kiosk Ke Shopper to use your camera to scan product barcodes.',
            },
          ],
        ],
        extra: {},
      },
      'shopper'
    )
  ),
};
