import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native WebView origin: https://petcare.app
 * Email / web sign-in callback: https://petcare.app/auth/callback
 * iOS custom scheme: petcare://auth/callback
 */
const config: CapacitorConfig = {
  appId: 'com.wayne.petcare',
  appName: '寵物日記 Pet Care',
  webDir: 'dist',
  server: {
    hostname: 'petcare.app',
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: ['*.supabase.co', '*.supabase.in', 'accounts.google.com', 'appleid.apple.com'],
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'PetCare',
    backgroundColor: '#fff7ed',
  },
};

export default config;
