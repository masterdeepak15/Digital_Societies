/**
 * Minimal global declarations for Expo / React Native environment.
 * Expo's babel transform replaces process.env.EXPO_PUBLIC_* at build time.
 */
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};
