import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const bundleIdentifier = process.env.REELS_BUNDLE_ID ?? 'cz.numsik.reelsfiltr';
  const nativeBlocking = process.env.REELS_NATIVE_BLOCKING === '1';
  return {
    ...config,
    name: 'Reels filtr',
    slug: 'reels-filtr',
    version: '0.3.0',
    scheme: 'reelsfiltr',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    ios: {
      bundleIdentifier,
      supportsTablet: false,
      infoPlist: { LSApplicationQueriesSchemes: ['instagram'] },
    },
    plugins: [
      'expo-font',
      ['expo-dev-client', { launchMode: 'most-recent' }],
      ['./plugins/withReelsGuard.cjs', { enabled: nativeBlocking }],
    ],
    extra: {
      nativeBlocking,
      eas: {
        build: {
          experimental: {
            ios: {
              appExtensions: nativeBlocking ? [
                { targetName: 'ReelsBroadcast', bundleIdentifier: `${bundleIdentifier}.broadcast`,
                  entitlements: { 'com.apple.security.application-groups': [`group.${bundleIdentifier}`], 'com.apple.developer.family-controls': true } },
                { targetName: 'ReelsShield', bundleIdentifier: `${bundleIdentifier}.shield`,
                  entitlements: { 'com.apple.developer.family-controls': true } },
              ] : [],
            },
          },
        },
      },
    },
  };
};
